import { makeRpcCall } from "./solana-rpc";

export type PrefetchedAddressData = {
  balanceLamports?: number;
  tokenAccounts?: any[];
  signatures?: any[];
};

const rpcPost = async (method: string, params: any[]): Promise<any> => {
  // Use direct RPC call instead of proxy endpoint
  return makeRpcCall(method, params);
};

/**
 * Prefetch wallet address data via our RPC proxy which fans out to Helius, Moralis, etc.
 * Fire-and-forget friendly: will not throw; returns partial data when available.
 */
export const prefetchWalletAddressData = async (
  publicKey: string,
): Promise<PrefetchedAddressData> => {
  const result: PrefetchedAddressData = {};

  const tasks = [
    rpcPost("getBalance", [publicKey])
      .then((lamports) => {
        if (typeof lamports === "number") result.balanceLamports = lamports;
        else if (typeof lamports?.value === "number")
          result.balanceLamports = lamports.value;
      })
      .catch(() => undefined),
    rpcPost("getTokenAccountsByOwner", [
      publicKey,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ])
      .then((val) => {
        const items = Array.isArray(val?.value) ? val.value : [];
        result.tokenAccounts = items;
      })
      .catch(() => undefined),
    rpcPost("getSignaturesForAddress", [publicKey, { limit: 10 }])
      .then((sigs) => {
        result.signatures = Array.isArray(sigs) ? sigs : [];
      })
      .catch(() => undefined),
  ];

  await Promise.allSettled(tasks);
  return result;
};
