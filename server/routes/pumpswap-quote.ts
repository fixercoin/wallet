export async function handlePumpswapQuote(mint: string) {
  const res = await fetch(`https://pumpportal.fun/api/quote?mint=${mint}`);
  return await res.json();
}
