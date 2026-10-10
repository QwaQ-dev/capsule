import { useConnection, useReadContracts } from "wagmi";
import { erc20Abi, isAddress, zeroAddress } from "viem";

/** [CONTRACT READ] symbol, decimals и баланс кошелька для ERC-20 по адресу токена */
export function useTokenInfo(token) {
  const { address: account } = useConnection();
  const base = { address: token, abi: erc20Abi };
  const { data } = useReadContracts({
    contracts: [
      { ...base, functionName: "symbol" },
      { ...base, functionName: "decimals" },
      { ...base, functionName: "balanceOf", args: [account ?? zeroAddress] },
    ],
    query: { enabled: isAddress(token ?? "") },
  });
  return { symbol: data?.[0]?.result, decimals: data?.[1]?.result, balance: data?.[2]?.result };
}