// utils/fetchWithRetry.ts
// Simple fetch wrapper with retries for transient network issues.

export async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 3, backoffMs = 300) {
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, opts);
      if (!resp.ok) {
        // For non-2xx, still return the response (caller may want JSON error). Only throw for network errors.
        return resp;
      }
      return resp;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
}
