import { isAddress, parseAbi, toFunctionSelector, zeroAddress } from "viem";
import { publicClient as client } from "./wagmi";

// Blockscout Elysium Testnet (его же использует Chainstack в туториалах). Conduit-эксплорер публичного API не имеет
const API = import.meta.env.VITE_EXPLORER_API ?? "https://elysium.kinetiq.xyz/api/v2";

const DEAD = "0x000000000000000000000000000000000000dead";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"; // EIP-1967
const MINIMAL_PROXY = "0x363d3d373d3d3d363d73"; // EIP-1167
const ownerAbi = parseAbi(["function owner() view returns (address)"]);

const safe = (p) => p.catch(() => undefined);
const get = (path) =>
  fetch(API + path, { signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : undefined)).catch(() => undefined);
const sel = (sig) => toFunctionSelector(sig).slice(2).toLowerCase();

// Эвристики по именам функций из ABI (если контракт верифицирован) или по селекторам в байткоде
const FN = {
  mint: { names: /^mint/i, sigs: ["mint(address,uint256)", "mint(uint256)", "mintTo(address,uint256)"] },
  blacklist: { names: /black.?list|block.?list|isBot|setBots?|addBot/i, sigs: ["addBlacklist(address)", "blacklist(address)", "setBlacklist(address,bool)", "isBlacklisted(address)", "addToBlacklist(address)"] },
  whitelist: { names: /white.?list|allow.?list/i, sigs: ["addWhitelist(address)", "whitelist(address)", "setWhitelist(address,bool)", "isWhitelisted(address)", "addToWhitelist(address)"] },
  tax: { names: /(set|update|change|modify).*(tax|fee)/i, sigs: ["setTax(uint256)", "setFee(uint256)", "setFees(uint256,uint256)", "setTaxFee(uint256)", "setBuyFee(uint256)", "setSellFee(uint256)", "setBuyTax(uint256)", "setSellTax(uint256)"] },
  balance: { names: /(set|update|modify|adjust).*balance|force.?transfer|claw.?back|seize/i, sigs: ["setBalance(address,uint256)", "forceTransfer(address,address,uint256)", "clawback(address,address,uint256)"] },
  withdraw: { names: /withdraw.*token|rescue|recover.*token|sweep/i, sigs: ["withdrawToken(address,uint256)", "rescueTokens(address,uint256)", "rescueERC20(address,address,uint256)", "recoverTokens(address,uint256)", "sweep(address)"] },
  regain: { names: /(reclaim|regain|recover|restore|take).*owner/i, sigs: ["reclaimOwnership()", "regainOwnership()", "takeOwnership()"] },
  cooldown: { names: /cooldown|transfer.?delay|trading.?delay|holding.?period/i, sigs: ["setCooldown(uint256)", "cooldownEnabled()", "transferDelayEnabled()", "setTransferDelay(uint256)"] },
  pause: { names: /^(pause|unpause|paused)$/i, sigs: ["pause()", "unpause()", "paused()"] },
};

const SELFDESTRUCT = /\b(selfdestruct|suicide)\s*\(/;
const EXTERNAL_CALL = /\.(call|delegatecall|staticcall)\s*[({]/;

/** Вес = сколько баллов снимается, если проверка провалена. Правь под себя */
const W = {
  open: 25, honeypot: 40, mint: 10, balance: 12, selfdestruct: 10, holders: 10, hidden: 10, blacklist: 8,
  tax: 8, proxy: 8, owner: 6, regain: 6, whitelist: 5, withdraw: 5, pause: 5, cooldown: 3, external: 3,
};
const UNVERIFIED_CAP = 60; // без исходников контракт не проанализировать — выше этого балла не даём

function holdersCheck(token, holders) {
  const total = token?.total_supply ? BigInt(token.total_supply) : 0n;
  const list = holders?.items;
  if (!total || !list?.length) return { status: "unknown" };
  const top = list
    .filter((h) => ![zeroAddress, DEAD].includes(h.address.hash.toLowerCase()))
    .slice(0, 5)
    .reduce((s, h) => s + BigInt(h.value), 0n);
  const pct = Number((top * 10000n) / total) / 100;
  return { status: pct > 50 ? "fail" : "pass", detail: `Top-5 holders: ${pct}%` };
}

/** [CONTRACT READ] RPC (код, owner, слот прокси) + Blockscout API (верификация, ABI, холдеры, дата деплоя) */
export async function analyzeToken(address) {
  if (!isAddress(address)) throw new Error("Некорректный адрес контракта");
  const [code, owner, slot, addr, token, sc, holders] = await Promise.all([
    safe(client.getCode({ address })),
    safe(client.readContract({ address, abi: ownerAbi, functionName: "owner" })),
    safe(client.getStorageAt({ address, slot: IMPL_SLOT })),
    get(`/addresses/${address}`),
    get(`/tokens/${address}`),
    get(`/smart-contracts/${address}`),
    get(`/tokens/${address}/holders`),
  ]);
  if (!code || code === "0x") throw new Error("По этому адресу нет контракта");
  const bytecode = code.toLowerCase();

  // для прокси анализируем реализацию
  const implRef = sc?.implementations?.[0];
  const implAddr = implRef?.address_hash ?? implRef?.address;
  const implSc = implAddr ? await get(`/smart-contracts/${implAddr}`) : undefined;
  const proxySignals = [!!sc?.proxy_type && sc.proxy_type !== "unknown", !!slot && !/^0x0*$/.test(slot), bytecode.startsWith(MINIMAL_PROXY)];
  const isProxy = proxySignals.some(Boolean);

  const src = implSc ?? sc;
  const abiNames = Array.isArray(src?.abi) && !(isProxy && !implSc)
    ? src.abi.filter((x) => x.type === "function").map((x) => x.name)
    : undefined;
  const source = [src?.source_code, ...(src?.additional_sources ?? []).map((f) => f.source_code)].filter(Boolean).join("\n");
  const verified = sc?.is_verified ?? addr?.is_verified;

  const byFn = (key) => {
    const { names, sigs } = FN[key];
    if (abiNames) return abiNames.some((n) => names.test(n)) ? "fail" : "pass";
    return sigs.some((s) => bytecode.includes(sel(s))) ? "fail" : "unknown"; // селектор не найден ≠ функции нет
  };
  const bySource = (re) => (source ? (re.test(source) ? "fail" : "pass") : "unknown");

  let ownership;
  if (owner) ownership = owner === zeroAddress ? "pass" : "fail";
  else ownership = bytecode.includes(sel("owner()")) ? "unknown" : "pass";
  const h = holdersCheck(token, holders);

  const UNKNOWN_NOTE = "Нельзя надёжно определить по данным эксплорера";
  const items = [
    { id: "owner", group: "Centralization", label: "Ownership Not Renounced", status: ownership, detail: owner && owner !== zeroAddress ? `Owner: ${owner}` : undefined },
    { id: "holders", group: "Centralization", label: "Major Holders Ratio", status: h.status, detail: h.detail },
    { id: "mint", group: "Centralization", label: "Is Mintable", status: byFn("mint") },
    { id: "blacklist", group: "Centralization", label: "Has Blacklist", status: byFn("blacklist") },
    { id: "whitelist", group: "Centralization", label: "Has Whitelist", status: byFn("whitelist") },
    { id: "tax", group: "Centralization", label: "Tax Can Be Modified", status: byFn("tax") },
    { id: "hidden", group: "Centralization", label: "Hidden Owner", status: "unknown", detail: UNKNOWN_NOTE },
    { id: "proxy", group: "Centralization", label: "Proxy Contract", status: isProxy ? "fail" : slot === undefined ? "unknown" : "pass" },
    { id: "balance", group: "Centralization", label: "Can Modify Balance", status: byFn("balance") },
    { id: "withdraw", group: "Centralization", label: "Can Withdraw Token", status: byFn("withdraw") },
    { id: "regain", group: "Centralization", label: "Can Regain Ownership", status: byFn("regain") },
    { id: "cooldown", group: "Centralization", label: "Is Transfer Cooldown", status: byFn("cooldown") },
    { id: "pause", group: "Centralization", label: "Is Transfer Pausable", status: byFn("pause") },
    { id: "external", group: "Transparency", label: "Has External Calls", status: bySource(EXTERNAL_CALL) },
    { id: "honeypot", group: "Transparency", label: "Is Honeypot", status: "unknown", detail: "Нужна симуляция продажи, по данным эксплорера не определить" },
    { id: "open", group: "Transparency", label: "Not Open Source", status: verified === undefined ? "unknown" : verified ? "pass" : "fail" },
    { id: "selfdestruct", group: "Transparency", label: "Can Self Destruct", status: bySource(SELFDESTRUCT) },
  ].map((i) => ({ ...i, weight: W[i.id] }));

  const failed = items.filter((i) => i.status === "fail");
  let score = 100 - failed.reduce((s, i) => s + i.weight, 0);
  if (verified === false) score = Math.min(score, UNVERIFIED_CAP);

  const txHash = addr?.creation_transaction_hash ?? addr?.creation_tx_hash;
  const tx = txHash ? await get(`/transactions/${txHash}`) : undefined;

  return {
    score: Math.max(0, score),
    standard: token?.type ?? "Unknown",
    deployedDaysAgo: tx?.timestamp ? Math.floor((Date.now() - Date.parse(tx.timestamp)) / 86_400_000) : undefined,
    owner,
    items,
    failed,
    conclusive: items.filter((i) => i.status !== "unknown").length,
  };
}