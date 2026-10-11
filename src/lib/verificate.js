import { erc20Abi, isAddress, parseAbi, toFunctionSelector, zeroAddress } from "viem";
import { publicClient as client } from "./wagmi";
import { CONTRACTS, routerAbi } from "./contracts";
import { loadPlatform } from "./platform";
import { agePoints, computeScore, creatorPoints, creatorShare, distribution, supplyPoints } from "./scoring";

const API = import.meta.env.VITE_EXPLORER_API ?? "https://elysium.kinetiq.xyz/api/v2";

const DEAD = "0x000000000000000000000000000000000000dead";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"; 
const MINIMAL_PROXY = "0x363d3d373d3d3d363d73"; 
const ownerAbi = parseAbi(["function owner() view returns (address)"]);

const safe = (p) => p.catch(() => undefined);
const get = (path) =>
  fetch(API + path, { signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : undefined)).catch(() => undefined);
const sel = (sig) => toFunctionSelector(sig).slice(2).toLowerCase();

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

const DELEGATECALL = /\.delegatecall\s*[({]/;
const SELL_BLOCK = /(block|disable|stop)Sell|canSell|sellEnabled|sellingEnabled|isHoneypot|tradingEnabled|tradingOpen|enableTrading|tradeEnabled/i;

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
    return sigs.some((s) => bytecode.includes(sel(s))) ? "fail" : "unknown"; 
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
  ];

  const now = Math.floor(Date.now() / 1000);
  const st = Object.fromEntries(items.map((i) => [i.id, i.status]));
  const renounced = owner === zeroAddress;

  const txHash = addr?.creation_transaction_hash ?? addr?.creation_tx_hash;
  const tx = txHash ? await get(`/transactions/${txHash}`) : undefined;
  const ageDays = tx?.timestamp ? (Date.now() - Date.parse(tx.timestamp)) / 86_400_000 : undefined;

  const deployer = addr?.creator_address_hash;
  const authors = [...new Set([deployer, owner].filter((a) => a && a !== zeroAddress).map((a) => a.toLowerCase()))];
  const bal = (a) => safe(client.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [a] }));
  const routerSet = CONTRACTS.router !== zeroAddress;
  const [platform, vault, authorBals, zeroBal, deadBal] = await Promise.all([
    loadPlatform(address),
    routerSet ? safe(client.readContract({ address: CONTRACTS.router, abi: routerAbi, functionName: "disposalVault" })) : undefined,
    Promise.all(authors.map(bal)),
    bal(zeroAddress),
    bal(DEAD),
  ]);
  const wallets = platform.available ? [...new Set(platform.vestings.map((v) => v.wallet))].slice(0, 100) : [];
  const walletBalances = new Map(await Promise.all(wallets.map(async (w) => [w.toLowerCase(), await bal(w)])));
  for (const [k, v] of walletBalances) if (v === undefined) walletBalances.delete(k);

  const creator = platform.available
    ? creatorShare({ platform, authors: new Set(authors), creatorBalance: authorBals.reduce((x, b) => x + (b ?? 0n), 0n), now })
    : undefined;
  const totalSupply = token?.total_supply ? BigInt(token.total_supply) : undefined;
  const dist = totalSupply && holders?.items
    ? distribution({
        holders: holders.items, totalSupply, burned: (zeroBal ?? 0n) + (deadBal ?? 0n), platform,
        exclude: new Set([CONTRACTS.router, vault].filter(Boolean).map((a) => a.toLowerCase())), walletBalances, now,
      })
    : undefined;

  const code_ = (label, max, ok) => ({ label, max, points: verified && ok ? max : 0, available: verified !== undefined });
  const dangerous = st.selfdestruct === "pass" && bySource(DELEGATECALL) === "pass";
  const sellBlock = !renounced && !!(abiNames?.some((n) => SELL_BLOCK.test(n)) || (source && SELL_BLOCK.test(source)));

  const result = computeScore([
    { id: "platform", title: "Platform", max: 30, parts: [
      { label: "LP burned/locked", max: 15, points: 0, available: false }, // TODO: нужна фабрика DEX на Elysium, чтобы найти LP-пару
      { label: "Creator tokens locked/burned", max: 15, points: creator === undefined ? 0 : creatorPoints(creator), available: creator !== undefined },
    ] },
    { id: "code", title: "Code", max: 40, parts: [
      code_("Verified", 10, true),
      code_("No mint", 6, st.mint === "pass" || renounced),
      code_("No blacklist/whitelist/pause", 6, [st.blacklist, st.whitelist, st.pause].every((x) => x === "pass")),
      code_("Tax fixed", 6, st.tax === "pass"),
      code_("Not a proxy", 6, st.proxy === "pass"),
      code_("No selfdestruct/delegatecall", 6, dangerous),
    ] },
    { id: "nft", title: "Hyperliquid NFT", max: 10, parts: [
      { label: "Author holds NFT > 30 days", max: 10, points: 0, available: false }, // TODO: адрес NFT-коллекции и сеть
    ] },
    { id: "age", title: "Age", max: 10, parts: [
      { label: "Token age", max: 10, points: ageDays === undefined ? 0 : agePoints(ageDays), available: ageDays !== undefined },
    ] },
    { id: "supply", title: "Distribution", max: 10, parts: [
      { label: "Top-10 share", max: 10, points: dist ? supplyPoints(dist.share) : 0, available: !!dist },
    ] },
  ], sellBlock);

  return {
    ...result,
    sellBlock,
    standard: token?.type ?? "Unknown",
    deployedDaysAgo: ageDays === undefined ? undefined : Math.floor(ageDays),
    owner,
    items,
    topHolders: dist?.rows ?? [],
  };
}