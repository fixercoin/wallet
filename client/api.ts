import { resolveApiUrl } from "@/client/lib/api-client";

export async function callSolanaRpc(payload: any) {
  const res = await fetch(resolveApiUrl("/api/solana-rpc"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Error calling Solana RPC: ${res.status}`);
  return res.json();
}
