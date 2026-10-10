import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { erc20Abi, erc721Abi, formatUnits, parseAbi, zeroAddress } from "viem";
import { publicClient as client } from "../lib/wagmi";
import { CONTRACTS, DEPLOY_BLOCK } from "../lib/contracts";

// событие и имя индексированного поля с адресом пользователя
const SOURCES = [
  ["event VestingCreated(address indexed creator, address indexed beneficiary, address indexed wallet, address token, uint256 amount, uint64 start, uint64 duration, uint64 cliff)", "creator"],
  ["event Locked(address indexed creator, address indexed token, uint256 indexed tokenId, address beneficiary, uint64 unlockAt)", "creator"],
  ["event ERC20Burned(address indexed sender, address indexed token, uint256 amount)", "sender"],
  ["event ERC721Burned(address indexed sender, address indexed collection, uint256 indexed tokenId)", "sender"],
  ["event DisposalLocked(address indexed sender, address indexed asset, uint256 indexed depositId, bool isNFT, uint256 quantity, uint64 unlockAt, address vault)", "sender"],
].map(([sig, field]) => ({ event: parseAbi([sig])[0], field }));

const safe = (p) => p.catch(() => undefined);
const date = (sec) => (sec == null ? "-" : new Date(Number(sec) * 1000).toLocaleDateString("ru-RU"));

/** Приводит лог к строке таблицы; ts — время блока (сек) */
function toRow(log, ts) {
  const a = log.args;
  switch (log.eventName) {
    case "VestingCreated": {
      const lock = a.duration === 0n; // Lock = createVesting с duration 0, start = дата разблокировки
      return { nft: false, asset: a.token, action: lock ? "Lock" : "Vest", qty: a.amount, start: lock ? ts : a.start, end: lock ? a.start : a.start + a.duration };
    }
    case "Locked": return { nft: true, asset: a.token, action: "Lock", qty: 1n, start: ts, end: a.unlockAt };
    case "ERC20Burned": return { nft: false, asset: a.token, action: "Burn", qty: a.amount, start: ts };
    case "ERC721Burned": return { nft: true, asset: a.collection, action: "Burn", qty: 1n, start: ts };
    default: return { nft: a.isNFT, asset: a.asset, action: "Burn", qty: a.quantity, start: ts }; // DisposalLocked: long-lock 1000 лет
  }
}

/** [CONTRACT READ] история действий пользователя из событий AssetRouter + symbol/decimals/name активов */
async function load(user) {
  const logs = (await Promise.all(SOURCES.map(({ event, field }) =>
    client.getLogs({ address: CONTRACTS.router, event, args: { [field]: user }, fromBlock: DEPLOY_BLOCK, toBlock: "latest" })
  ))).flat().sort((x, y) => Number(y.blockNumber - x.blockNumber) || y.logIndex - x.logIndex);

  const blocks = [...new Set(logs.map((l) => l.blockNumber))];
  const times = Object.fromEntries(await Promise.all(blocks.map(async (n) => [n, (await client.getBlock({ blockNumber: n })).timestamp])));
  const rows = logs.map((l) => ({ ...toRow(l, times[l.blockNumber]), hash: l.transactionHash, key: `${l.transactionHash}-${l.logIndex}` }));

  const assets = [...new Set(rows.map((r) => r.asset))];
  const meta = Object.fromEntries(await Promise.all(assets.map(async (addr) => {
    const nft = rows.find((r) => r.asset === addr).nft;
    const read = (abi, functionName) => safe(client.readContract({ address: addr, abi, functionName }));
    return [addr, nft ? { name: await read(erc721Abi, "name") } : { symbol: await read(erc20Abi, "symbol"), decimals: await read(erc20Abi, "decimals") }];
  })));

  return rows.map((r) => {
    const m = meta[r.asset];
    return {
      key: r.key, hash: r.hash, action: r.action,
      asset: r.nft ? `NFT (${m.name ?? "collection"})` : `Token ($${m.symbol ?? "?"})`,
      quantity: r.nft ? String(r.qty) : formatUnits(r.qty, m.decimals ?? 18),
      start: date(r.start), end: date(r.end),
    };
  });
}

export function usePositions() {
  const { address } = useConnection();
  return useQuery({
    queryKey: ["positions", address],
    queryFn: () => load(address),
    enabled: !!address && CONTRACTS.router !== zeroAddress,
  });
}