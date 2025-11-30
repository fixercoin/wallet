/**
 * Retry utility with exponential backoff for fetching prices
 * Aggressively retries to ensure live prices are always fetched
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 3000,
  backoffMultiplier: 1.5,
  timeoutMs: 8000,
};

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  tokenName: string,
  options: RetryOptions = {},
): Promise<T | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      console.log(
        `[${tokenName} Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1}`,
      );

      // Add timeout to prevent hanging
      const result = await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`${tokenName} fetch timeout (${opts.timeoutMs}ms)`),
              ),
            opts.timeoutMs,
          ),
        ),
      ]);

      console.log(`[${tokenName} Retry] ✅ Success on attempt ${attempt + 1}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[${tokenName} Retry] Attempt ${attempt + 1} failed: ${lastError.message}`,
      );

      // If this was the last attempt, log final failure but don't throw
      if (attempt === opts.maxRetries) {
        console.error(
          `[${tokenName} Retry] ❌ Failed after ${opts.maxRetries + 1} attempts`,
        );
        return null;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  console.error(
    `[${tokenName}] Price fetch failed completely after all retries`,
  );
  return null;
}

/**
 * Retry with aggressive settings for dev server compatibility
 * Shorter initial delays for faster feedback in development
 */
export const AGGRESSIVE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 8,
  initialDelayMs: 50,
  maxDelayMs: 2000,
  backoffMultiplier: 1.3,
  timeoutMs: 10000,
};

/**
 * Retry with Cloudflare Worker-friendly settings
 * Longer timeouts to account for cold starts and network latency
 */
export const CLOUDFLARE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 6,
  initialDelayMs: 200,
  maxDelayMs: 4000,
  backoffMultiplier: 1.5,
  timeoutMs: 12000,
};
