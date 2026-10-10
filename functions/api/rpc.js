// Cloudflare Pages Function: POST /api/rpc — прокси JSON-RPC к ноде Elysium.
// Секретный URL ноды (с ключом) лежит в env ELYSIUM_RPC_URL и в браузер не попадает.

// Только методы, нужные dApp. Debug/trace и админские методы закрыты
const ALLOWED = new Set([
  "eth_chainId", "net_version", "eth_blockNumber", "eth_getBalance", "eth_getCode", "eth_getStorageAt",
  "eth_call", "eth_estimateGas", "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory",
  "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getTransactionByHash", "eth_getTransactionReceipt",
  "eth_getTransactionCount", "eth_getLogs", "eth_sendRawTransaction",
]);
const MAX_BODY = 100_000; // байт
const MAX_BATCH = 50;

const rpcError = (id, code, message, status) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

export async function onRequestPost({ request, env }) {
  if (!env.ELYSIUM_RPC_URL) return rpcError(null, -32000, "RPC is not configured", 500);
  // необязательно: пустить только свой сайт (ALLOWED_ORIGIN=https://capsule.example.com). Кошельки при этом ходят мимо прокси
  if (env.ALLOWED_ORIGIN && request.headers.get("origin") !== env.ALLOWED_ORIGIN) return rpcError(null, -32000, "Forbidden", 403);

  const text = await request.text();
  if (text.length > MAX_BODY) return rpcError(null, -32600, "Request too large", 413);

  let body;
  try { body = JSON.parse(text); } catch { return rpcError(null, -32700, "Parse error", 400); }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > MAX_BATCH) return rpcError(null, -32600, "Batch too large", 400);
  for (const c of calls) {
    if (!ALLOWED.has(c?.method)) return rpcError(c?.id, -32601, `Method not allowed: ${c?.method}`, 403);
  }

  const upstream = await fetch(env.ELYSIUM_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: text,
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const onRequest = () => new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });