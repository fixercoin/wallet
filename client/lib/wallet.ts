export async function getBalance(pubkey: string) {
  const body = { jsonrpc: "2.0", id: 1, method: "getBalance", params: [pubkey] };
  const res = await fetch("/api/solana-rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json?.result?.value || 0;
}
