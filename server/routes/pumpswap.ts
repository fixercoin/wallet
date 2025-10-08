export async function handlePumpswap() {
  const res = await fetch("https://pumpportal.fun/api/swap");
  return await res.json();
}
