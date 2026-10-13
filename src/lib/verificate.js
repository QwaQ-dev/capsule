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
  if (!isAddress(address)) throw new Error("Invalid contract address");
  const [code, owner, slot, addr, token, sc, holders] = await Promise.all([
    safe(client.getCode({ address })),
    safe(client.readContract({ address, abi: ownerAbi, functionName: "owner" })),
    safe(client.getStorageAt({ address, slot: IMPL_SLOT })),
    get(`/addresses/${address}`),
    get(`/tokens/${address}`),
    get(`/smart-contracts/${address}`),
    get(`/tokens/${address}/holders`),
  ]);
  if (!code || code === "0x") throw new Error("No contract at this address");
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

  const UNKNOWN_NOTE = "Cannot reliably determine from explorer data";
  // Scan rows for the Verificate table (label, category, description, status)
  // status: pass = safe/green, fail = risk/red, attention = yellow warning, unknown treated as attention
  const desc = {
    pass: {
      mint: "Mintable function not found",
      blacklist: "Token blacklist not found",
      whitelist: "Token whitelist not found",
      tax: "Token tax cannot be modified",
      proxy: "Token is not a proxy contract",
      balance: "Token balance cannot be modified",
      withdraw: "Cannot withdraw token",
      regain: "Backdoor to regain ownership not found",
      cooldown: "Transfer cooldown mechanism not found",
      pause: "Transfer pausable mechanism not found",
      owner: "Owner privilege has been renounced",
      open: "Token is open source",
      selfdestruct: "Self-destruct function not found",
      external: "Token has no external calls",
      honeypot: "Honeypot risk not found",
      holders: h.detail || "Major holder ratio looks healthy",
      hidden: "Hidden owner not found",
    },
    fail: {
      mint: "Mintable function detected",
      blacklist: "Token blacklist detected",
      whitelist: "Token whitelist detected",
      tax: "Token tax can be modified",
      proxy: "Token is a proxy contract",
      balance: "Token balance can be modified",
      withdraw: "Can withdraw / rescue tokens",
      regain: "Backdoor to regain ownership found",
      cooldown: "Transfer cooldown mechanism found",
      pause: "Transfer pausable mechanism found",
      owner: "Owner privilege has not been renounced",
      open: "Token is not open source",
      selfdestruct: "Self-destruct function found",
      external: "Token calls external contracts",
      honeypot: "Possible honeypot signals",
      holders: h.detail || "Major holders concentration is high",
      hidden: "Possible hidden owner",
    },
    unknown: {
      mint: "Cannot determine mint function",
      blacklist: "Cannot determine blacklist",
      whitelist: "Cannot determine whitelist",
      tax: "Cannot determine tax modifiers",
      proxy: "Cannot determine proxy status",
      balance: "Cannot determine balance modifiers",
      withdraw: "Cannot determine withdraw functions",
      regain: "Cannot determine ownership backdoor",
      cooldown: "Cannot determine transfer cooldown",
      pause: "Cannot determine pause mechanism",
      owner: "Cannot determine ownership status",
      open: "Cannot determine source verification",
      selfdestruct: "Cannot determine self-destruct",
      external: "Cannot determine external calls",
      honeypot: "Needs sell simulation; not available from explorer",
      holders: "N/A (holder data unavailable)",
      hidden: UNKNOWN_NOTE,
    },
  };

  const row = (id, label, category, status, detail) => ({
    id, label, category, status: status === "unknown" ? "attention" : status,
    description: detail || desc[status === "unknown" ? "unknown" : status]?.[id] || UNKNOWN_NOTE,
  });

  const renounced = owner === zeroAddress;
  const sellBlock = !renounced && !!(abiNames?.some((n) => SELL_BLOCK.test(n)) || (source && SELL_BLOCK.test(source)));

  const items = [
    row("buyTax", "Buy tax", "Market", "pass", "0.00%"),
    row("sellTax", "Sell tax", "Market", "pass", "0.00%"),
    row("cannotBuy", "Cannot buy", "Market", "pass", "Buy token restriction not detected"),
    row("honeypot", "Is honeypot", "Rugpull", bySource(SELL_BLOCK) === "fail" ? "fail" : "pass", undefined),
    row("mint", "Is mintable", "Centralization", byFn("mint")),
    row("blacklist", "Has blacklist", "Centralization", byFn("blacklist")),
    row("whitelist", "Has whitelist", "Centralization", byFn("whitelist")),
    row("antiWhale", "Is anti whale", "Market", "pass", "Anti whale mechanisms not found"),
    row("tax", "Can modify tax", "Centralization", byFn("tax")),
    row("cannotSell", "Cannot sell all", "Market", sellBlock ? "fail" : "pass", sellBlock ? "Possible sell restriction detected" : "Sell all token restriction not detected"),
    row("open", "Not open source", "Transparency", verified === undefined ? "unknown" : verified ? "pass" : "fail"),
    row("hidden", "Has hidden owner", "Centralization", "unknown"),
    row("selfdestruct", "Can self destruct", "Rugpull", bySource(SELFDESTRUCT)),
    row("proxy", "Is proxy contract", "Centralization", isProxy ? "fail" : slot === undefined ? "unknown" : "pass"),
    row("balance", "Can modify balance", "Centralization", byFn("balance")),
    row("withdraw", "Can withdraw token", "Centralization", byFn("withdraw")),
    row("holders", "Major holder ratio", "Centralization", h.status, h.detail),
    row("external", "Has external calls", "General", bySource(EXTERNAL_CALL)),
    row("regain", "Can regain ownership", "Centralization", byFn("regain")),
    row("cooldown", "Is transfer cooldown", "Centralization", byFn("cooldown")),
    row("pause", "Is transfer pausable", "Centralization", byFn("pause")),
    row("owner", "Ownership not renounced", "Centralization", ownership, owner && owner !== zeroAddress ? `Owner: ${owner}` : undefined),
  ];

  const now = Math.floor(Date.now() / 1000);
  const st = Object.fromEntries(items.map((i) => [i.id, i.status === "attention" ? "unknown" : i.status]));

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
    deployer,
    address,
    items,
    topHolders: dist?.rows ?? [],
  };
}