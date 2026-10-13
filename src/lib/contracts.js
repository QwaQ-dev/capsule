import { parseAbi } from "viem";

export const CONTRACTS = {
  // AssetRouter on Elysium Testnet (no-hive/capsule_contracts)
  router: "0x12c7BE246E4E9391065343a2a201cC667bAC3088",
};

// Reward paid per action when wantsReward is true (10 * 10^18 base units)
export const ACTION_REWARD = 10n * 10n ** 18n;

export const routerAbi = parseAbi([
  // --- create vesting / lock (ERC-20) ---
  "function createVesting(address token, uint256 amount, address beneficiary, uint64 start, uint64 duration, uint64 cliff) returns (address wallet)",
  "function createVesting(address token, uint256 amount, address beneficiary, uint64 start, uint64 duration, uint64 cliff, bool wantsReward) returns (address wallet)",
  // --- NFT lock ---
  "function lock(address collection, uint256 tokenId, address beneficiary, uint64 unlockAt)",
  "function lock(address collection, uint256 tokenId, address beneficiary, uint64 unlockAt, bool wantsReward)",
  // --- batch transfer ---
  "function distribute(address token, address[] recipients, uint256[] amounts)",
  "function distribute(address token, address[] recipients, uint256[] amounts, bool wantsReward)",
  // --- dispose / burn ---
  "function disposeERC20(address token, uint256 amount, bool nativeBurn)",
  "function disposeERC20(address token, uint256 amount, bool nativeBurn, bool wantsReward)",
  "function disposeERC721(address collection, uint256 tokenId, bool nativeBurn)",
  "function disposeERC721(address collection, uint256 tokenId, bool nativeBurn, bool wantsReward)",
  // --- views ---
  "function disposalVault() view returns (address)",
  "function rewardToken() view returns (address)",
  "function ACTION_REWARD() view returns (uint256)",
  "function locks(address collection, uint256 tokenId) view returns (address beneficiary, uint64 unlockAt)",
  // --- release vesting ---
  "function releaseVesting(address wallet, address token)",
  "function releaseVesting(address wallet, address token, bool wantsReward)",
  "function releaseVestingNative(address wallet)",
  "function releaseVestingNative(address wallet, bool wantsReward)",
  // --- release NFT lock ---
  "function release(address collection, uint256 tokenId)",
  "function release(address collection, uint256 tokenId, bool wantsReward)",
  "function releaseTo(address collection, uint256 tokenId, address destination)",
  "function releaseTo(address collection, uint256 tokenId, address destination, bool wantsReward)",
  // --- release disposal lock ---
  "function releaseDisposalLock(uint256 id)",
  "function releaseDisposalLock(uint256 id, bool wantsReward)",
  "function releaseDisposalLockTo(uint256 id, address destination)",
  "function releaseDisposalLockTo(uint256 id, address destination, bool wantsReward)",
]);

export const vestingWalletAbi = parseAbi([
  "function releasable(address token) view returns (uint256)",
  "function owner() view returns (address)",
]);

export const DAY = 86400n;
export const toUnix = (date) => BigInt(Math.floor(new Date(date).getTime() / 1000));
export const days = (v) => BigInt(Math.floor(Number(v || 0))) * DAY;

/** Returns true when the given date is at least ~5 minutes in the future. */
export const isFuture = (date) => !!date && toUnix(date) > BigInt(Math.floor(Date.now() / 1000)) + 300n;

export const BURN_METHODS = { "Native burn()": true, "Long-term lock (1000 years)": false };

export const DEPLOY_BLOCK = BigInt(import.meta.env.VITE_DEPLOY_BLOCK || 0);