import { createConfig, http } from "wagmi";
import { createPublicClient, defineChain } from "viem";
import { injected } from "wagmi/connectors";

const RPC_URL = import.meta.env.VITE_ELYSIUM_RPC_URL ?? "";
if (!RPC_URL) console.warn("NO ENV VAR");

export const elysiumTestnet = defineChain({
  id: 99801,
  name: "Elysium Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Elysium Explorer", url: "https://elysium.kinetiq.xyz/" },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [elysiumTestnet],
  connectors: [injected()], 
  transports: { [elysiumTestnet.id]: http(RPC_URL) },
});

export const publicClient = createPublicClient({ chain: elysiumTestnet, transport: http(RPC_URL) });