import { handleSolanaRpc } from "./solana-proxy";

export async function handleWalletBalance(publicKey: string) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [publicKey],
  };

  const response = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return await response.json();
}

export async function handleWalletTokenAccounts(publicKey: string) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [publicKey, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }],
  };

  const response = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return await response.json();
}
