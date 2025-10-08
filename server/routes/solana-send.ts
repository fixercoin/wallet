export async function handleSolanaSend(rawTx: string) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [rawTx, { skipPreflight: false, preflightCommitment: "confirmed" }],
  };

  const response = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return await response.json();
}
