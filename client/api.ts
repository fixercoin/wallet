import { resolveApiUrl } from "@/client/lib/api-client";

export async function getWalletBalance(publicKey: string) {
  const res = await fetch(resolveApiUrl(`/api/wallet/balance?publicKey=${publicKey}`));
  if (!res.ok) throw new Error(`Error fetching balance: ${res.status}`);
  const data = await res.json();
  return data.balance;
}

export async function getSPLTokens(publicKey: string) {
  const res = await fetch(resolveApiUrl(`/api/wallet/spl-tokens?publicKey=${publicKey}`));
  if (!res.ok) throw new Error(`Error fetching SPL tokens: ${res.status}`);
  return res.json();
}

export async function getTokenPrice(symbol: string) {
  const res = await fetch(resolveApiUrl(`/api/dexscreener/tokens?symbol=${symbol}`));
  if (!res.ok) throw new Error(`Error fetching token price: ${res.status}`);
  const data = await res.json();
  return data.price;
}
