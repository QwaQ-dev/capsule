import { parseAbi } from "viem";

export const CONTRACTS = {
  router: "0x31a006Cb09B5814dcbe5550087EAd28f50c4DA7a",
};

export const routerAbi = parseAbi([
  "function createVesting(address token, uint256 amount, address beneficiary, uint64 start, uint64 duration, uint64 cliff) returns (address wallet)",
  "function lock(address collection, uint256 tokenId, address beneficiary, uint64 unlockAt)",
  "function distribute(address token, address[] recipients, uint256[] amounts)",
  "function disposeERC20(address token, uint256 amount, bool nativeBurn)",
  "function disposeERC721(address collection, uint256 tokenId, bool nativeBurn)",
  "function disposalVault() view returns (address)",
]);

export const DAY = 86400n;
export const toUnix = (date) => BigInt(Math.floor(new Date(date).getTime() / 1000));
export const days = (v) => BigInt(Math.floor(Number(v || 0))) * DAY;

export const isFuture = (date) => !!date && toUnix(date) > BigInt(Math.floor(Date.now() / 1000)) + 300n;

export const BURN_METHODS = { "Native burn()": true, "Long-term lock (1000 years)": false };

export const DEPLOY_BLOCK = 0n;