export function bytesFromBase64(b64: string): Uint8Array {
  if (!b64 || typeof b64 !== "string") {
    console.error(
      "[bytesFromBase64] Invalid input: expected non-empty string, got",
      typeof b64,
    );
    throw new Error(`Invalid base64 input: expected string, got ${typeof b64}`);
  }

  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(
      `[bytesFromBase64] Failed to decode base64 string (length: ${b64.length}). Error: ${errorMsg}`,
    );
    throw new Error(
      `Failed to decode base64 transaction: ${errorMsg}. The transaction data may be corrupted.`,
    );
  }
}

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice) as any);
  }
  return btoa(binary);
}
