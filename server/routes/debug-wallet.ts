export async function handleDebug(publicKey: string) {
  const res = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [publicKey],
    }),
  });

  return await res.json();
}
