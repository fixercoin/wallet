/**
 * Fetch with timeout and retry logic for Cloudflare Pages Functions
 */

export interface FetchWithRetryOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Fetch with timeout - aborts if request takes too long
 */
async function fetchWithTimeout(
  url: string,
  options: FetchWithRetryOptions = {},
  timeoutMs: number = 55000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch with timeout and exponential backoff retry logic
 * Default: 55s timeout, 2 retries, 1s initial delay
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 55000,
    maxRetries = 2,
    retryDelayMs = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions, timeoutMs);

      // Return successful response
      if (response.ok) {
        return response;
      }

      // Non-2xx responses shouldn't retry
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTimeout =
        lastError.name === "AbortError" ||
        lastError.message.includes("timeout");

      console.warn(
        `Attempt ${attempt + 1} failed (${isTimeout ? "timeout" : "error"}): ${lastError.message}`,
      );

      if (attempt < maxRetries) {
        const backoffDelay = retryDelayMs * Math.pow(2, attempt);
        console.log(
          `Retrying in ${backoffDelay}ms... (${maxRetries - attempt} retries left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error(`Failed after ${maxRetries + 1} attempts`);
}

/**
 * Simple timeout wrapper without retries
 */
export async function withTimeout(
  fn: () => Promise<Response>,
  timeoutMs: number = 55000,
): Promise<Response> {
  return Promise.race([
    fn(),
    new Promise<Response>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}
