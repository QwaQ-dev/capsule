import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { erc721Abi, isAddress, parseAbi, parseAbiItem } from "viem";
import { publicClient as client } from "../lib/wagmi";

const ENUMERABLE_ID = "0x780e9d63";
const enumerableAbi = parseAbi([
  "function supportsInterface(bytes4 id) view returns (bool)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
]);
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");
const MAX_NFTS = 500;

const safe = (p) => p.catch(() => undefined);
const sameAddr = (a, b) => a?.toLowerCase() === b.toLowerCase();

async function load(collection, owner) {
  const read = (functionName, args, abi = erc721Abi) => client.readContract({ address: collection, abi, functionName, args });

  const [balance, name] = await Promise.all([
    read("balanceOf", [owner]).catch(() => { throw new Error("This is not an ERC-721 collection"); }),
    safe(read("name")),
  ]);
  if (balance === 0n) return { ids: [], name };
  if (balance > BigInt(MAX_NFTS)) throw new Error(`You hold more than ${MAX_NFTS} NFTs from this collection`);

  let ids;
  if (await safe(read("supportsInterface", [ENUMERABLE_ID], enumerableAbi))) {
    ids = await Promise.all(Array.from({ length: Number(balance) }, (_, i) => read("tokenOfOwnerByIndex", [owner, BigInt(i)], enumerableAbi)));
  } else {
    const logs = await client.getLogs({ address: collection, event: transferEvent, args: { to: owner }, fromBlock: 0n, toBlock: "latest" });
    const candidates = [...new Set(logs.map((l) => l.args.tokenId))];
    const owners = await Promise.all(candidates.map((id) => safe(read("ownerOf", [id]))));
    ids = candidates.filter((_, i) => sameAddr(owners[i], owner));
  }
  return { ids: ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), name };
}

export function useOwnedNfts(collection) {
  const { address } = useConnection();
  return useQuery({
    queryKey: ["nfts", collection, address],
    queryFn: () => load(collection, address),
    enabled: !!address && isAddress(collection),
    retry: false,
  });
}