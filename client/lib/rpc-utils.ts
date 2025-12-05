// Utility wrapper for making Solana RPC calls
// This replaces the old /api/solana-rpc proxy endpoint with direct public RPC calls

import { makeRpcCall } from "./services/solana-rpc";

/**
 * Make a Solana JSON RPC call
 * Automatically uses public RPC endpoints with fallback support
 *
 * @param method - RPC method name (e.g., "getBalance", "getTokenAccountsByOwner")
 * @param params - Array of parameters for the method
 * @returns The RPC result
 *
 * @example
 * const balance = await rpcCall("getBalance", [publicKey]);
 * const tokens = await rpcCall("getTokenAccountsByOwner", [publicKey, {programId}, {encoding}]);
 */
export async function rpcCall(
  method: string,
  params: any[] = [],
): Promise<any> {
  return makeRpcCall(method, params);
}

/**
 * Make an RPC call with a JSON-RPC formatted payload
 * This is a convenience wrapper for components that build their own payload
 *
 * @param payload - JSON-RPC payload object with method and params
 * @returns Full JSON-RPC response object
 *
 * @example
 * const result = await rpcPayload({ method: "getBalance", params: [publicKey] });
 */
export async function rpcPayload(payload: {
  jsonrpc?: string;
  id?: number;
  method: string;
  params: any[];
}): Promise<{
  jsonrpc: string;
  id: number;
  result: any;
}> {
  const result = await makeRpcCall(payload.method, payload.params);
  return {
    jsonrpc: payload.jsonrpc || "2.0",
    id: payload.id || Date.now(),
    result,
  };
}

/**
 * Type-safe wrapper for common RPC methods
 */
export const solanaRpc = {
  /**
   * Get SOL balance for a wallet address
   */
  getBalance: (publicKey: string) => rpcCall("getBalance", [publicKey]),

  /**
   * Get token accounts owned by a public key
   */
  getTokenAccountsByOwner: (
    publicKey: string,
    options?: {
      programId?: string;
      encoding?: string;
      commitment?: string;
    },
  ) =>
    rpcCall("getTokenAccountsByOwner", [
      publicKey,
      {
        programId:
          options?.programId || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
      {
        encoding: options?.encoding || "jsonParsed",
        commitment: options?.commitment || "confirmed",
      },
    ]),

  /**
   * Get signatures for a wallet address
   */
  getSignaturesForAddress: (publicKey: string, limit = 20) =>
    rpcCall("getSignaturesForAddress", [publicKey, { limit }]),

  /**
   * Get a parsed transaction
   */
  getTransaction: (signature: string, commitment = "confirmed") =>
    rpcCall("getTransaction", [
      signature,
      {
        encoding: "jsonParsed",
        commitment,
        maxSupportedTransactionVersion: 0,
      },
    ]),

  /**
   * Send a transaction
   */
  sendTransaction: (encodedTransaction: string) =>
    rpcCall("sendTransaction", [encodedTransaction]),

  /**
   * Simulate a transaction
   */
  simulateTransaction: (encodedTransaction: string, signers?: string[]) =>
    rpcCall("simulateTransaction", [encodedTransaction, { signers }]),

  /**
   * Get account info
   */
  getAccountInfo: (publicKey: string) =>
    rpcCall("getAccountInfo", [
      publicKey,
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]),

  /**
   * Get multiple accounts
   */
  getMultipleAccounts: (publicKeys: string[]) =>
    rpcCall("getMultipleAccounts", [
      publicKeys,
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]),

  /**
   * Get token supply
   */
  getTokenSupply: (mint: string) => rpcCall("getTokenSupply", [mint]),

  /**
   * Get recent blockhash
   */
  getRecentBlockhash: () => rpcCall("getRecentBlockhash", []),

  /**
   * Get transaction fee estimate
   */
  getFeeForMessage: (message: string) => rpcCall("getFeeForMessage", [message]),
};
