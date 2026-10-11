import { useConnection, useReadContracts } from "wagmi";
import { erc20Abi, isAddress, zeroAddress } from "viem";
import { CONTRACTS } from "../lib/contracts";

export function useTokenInfo(token) {
  const { address: account } = useConnection();
  const base = { address: token, abi: erc20Abi };
  const { data } = useReadContracts({
    contracts: [
      { ...base, functionName: "symbol" },
      { ...base, functionName: "decimals" },
      { ...base, functionName: "balanceOf", args: [account ?? zeroAddress] },
      { ...base, functionName: "allowance", args: [account ?? zeroAddress, CONTRACTS.router] },
    ],
    query: { enabled: isAddress(token ?? "") },
  });
  return { symbol: data?.[0]?.result, decimals: data?.[1]?.result, balance: data?.[2]?.result, allowance: data?.[3]?.result };
}