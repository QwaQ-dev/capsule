import { createConfig, http } from "wagmi";
import { createPublicClient, defineChain } from "viem";
import { injected } from "wagmi/connectors";

// RPC тестнета Kinetiq Elysium публично не опубликован — берём из .env (например, endpoint Chainstack)
const RPC_URL = import.meta.env.VITE_ELYSIUM_RPC_URL ?? "";
if (!RPC_URL) console.warn("VITE_ELYSIUM_RPC_URL не задан: чтение из контрактов и добавление сети в кошелёк не заработают");

// Не импортируем elysiumTestnet из viem/chains — это другая сеть (Vulcan Forged, id 1338, LAVA)
export const elysiumTestnet = defineChain({
  id: 99801,
  name: "Elysium Testnet",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Elysium Explorer", url: "https://explorer-elysium-testnet.t.conduit.xyz" },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [elysiumTestnet],
  connectors: [injected()], // MetaMask и другие браузерные кошельки; для WalletConnect нужен projectId
  transports: { [elysiumTestnet.id]: http(RPC_URL) },
});

// клиент для чтения логов (позиции пользователя), не зависит от версии wagmi
export const publicClient = createPublicClient({ chain: elysiumTestnet, transport: http(RPC_URL) });