import { parseAbiItem, zeroAddress } from "viem";
import { publicClient as client } from "./wagmi";
import { CONTRACTS, DEPLOY_BLOCK } from "./contracts";

const vestingCreated = parseAbiItem("event VestingCreated(address indexed creator, address indexed beneficiary, address indexed wallet, address token, uint256 amount, uint64 start, uint64 duration, uint64 cliff)");
const erc20Burned = parseAbiItem("event ERC20Burned(address indexed sender, address indexed token, uint256 amount)");
const disposalLocked = parseAbiItem("event DisposalLocked(address indexed sender, address indexed asset, uint256 indexed depositId, bool isNFT, uint256 quantity, uint64 unlockAt, address vault)");

export async function loadPlatform(token) {
  if (CONTRACTS.router === zeroAddress) return { available: false };
  try {
    const base = { address: CONTRACTS.router, fromBlock: DEPLOY_BLOCK, toBlock: "latest" };
    const [v, b, d] = await Promise.all([
      client.getLogs({ ...base, event: vestingCreated }), // token не indexed — фильтруем после загрузки
      client.getLogs({ ...base, event: erc20Burned, args: { token } }),
      client.getLogs({ ...base, event: disposalLocked, args: { asset: token } }),
    ]);
    return {
      available: true,
      vestings: v.map((l) => l.args).filter((a) => a.token.toLowerCase() === token.toLowerCase()),
      burns: b.map((l) => ({ sender: l.args.sender, amount: l.args.amount })),
      disposals: d.filter((l) => !l.args.isNFT).map((l) => ({ sender: l.args.sender, amount: l.args.quantity })),
    };
  } catch {
    return { available: false };
  }
}