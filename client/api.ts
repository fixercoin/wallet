import { makeRpcCall } from "@/lib/services/solana-rpc";

export async function callSolanaRpc(payload: any) {
  // Use direct RPC call instead of proxy endpoint
  // payload should have: { method, params, jsonrpc?, id? }
  if (!payload.method) {
    throw new Error("RPC payload must include 'method'");
  }

  const result = await makeRpcCall(payload.method, payload.params || []);
  return {
    jsonrpc: "2.0",
    id: payload.id || Date.now(),
    result,
  };
}
