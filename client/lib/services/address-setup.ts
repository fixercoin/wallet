export type PrefetchedAddressData = {
  balanceLamports?: number;
  tokenAccounts?: any[];
  signatures?: any[];
};

const rpcPost = async (method: string, params: any[]): Promise<any> => {
  const body = { jsonrpc: "2.0", id: Date.now(), method, params };
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  try {
    const resp = await fetch("/api/solana-rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await resp.text().catch(() => "");
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!resp.ok || (data && data.error)) {
      throw new Error(
        (data && data.error && data.error.message) ||
          resp.statusText ||
          "RPC error",
      );
    }
    return data?.result ?? data;
  } finally {
    clearTimeout(timeout);
  }
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
