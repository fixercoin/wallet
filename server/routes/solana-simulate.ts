export async function handleSolanaSimulate(txBase64: string) {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "simulateTransaction",
    params: [txBase64, { encoding: "base64", commitment: "processed" }],
  };

  const response = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return await response.json();
}
