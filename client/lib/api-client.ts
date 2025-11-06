// Production deployment defaults
const FIXORIUM_API_BASE = "https://wallet.fixorium.com.pk/api";
const CLOUDFLARE_WORKER_BASE =
  "https://fixorium-proxy.khanbabusargodha.workers.dev/api";
const LOCALHOST_API_BASE = "http://localhost:5173"; // Local fallback

// Track which API base is currently working
let workingApiBase: string | null = null;
let lastFailureTime: Record<string, number> = {};

const normalizeBase = (value: string | null | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const determineBase = (): string => {
  const envBase = normalizeBase(import.meta.env?.VITE_API_BASE_URL);
  if (envBase) return envBase;
  // Use cached working base if available
  if (workingApiBase) return workingApiBase;
  // Try Fixorium API first (known working), then Cloudflare Worker as fallback
  return FIXORIUM_API_BASE;
};

let cachedBase: string | null = null;

export const getApiBaseUrl = (): string => {
  if (cachedBase === null) {
    cachedBase = determineBase();
  }
  return cachedBase;
};

// Mark an API base as failed for a period
export const markApiBaseFailed = (base: string): void => {
  lastFailureTime[base] = Date.now();
  workingApiBase = null; // Reset working base so we try alternatives
};

// Check if an API base should be retried
const canRetryApiBase = (base: string): boolean => {
  const lastFailure = lastFailureTime[base];
  if (!lastFailure) return true;
  // Retry after 30 seconds of being marked as failed
  return Date.now() - lastFailure > 30000;
};

export const resolveApiUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (!base) {
    // When no base is configured, ensure /api prefix is present for local routes
    return normalizedPath.startsWith("/api")
      ? normalizedPath
      : `/api${normalizedPath}`;
  }

  const baseNorm = base.replace(/\/+$/, "");
  // If base already includes /api at the end, avoid duplicating it
  if (baseNorm.endsWith("/api")) {
    const pathWithoutApi = normalizedPath.startsWith("/api")
      ? normalizedPath.substring(4)
      : normalizedPath;
    return `${baseNorm}${pathWithoutApi}`;
  }

  // Otherwise, append the full normalizedPath
  return `${baseNorm}${normalizedPath}`;
};

// Fetch wrapper with automatic fallback support
export const fetchWithFallback = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => {
  const url = resolveApiUrl(path);
  const currentBase = getApiBaseUrl();

  try {
    const response = await fetch(url, {
      ...options,
      // Add timeout if not present
      signal: options?.signal || AbortSignal.timeout?.(30000),
    });

    // If successful, mark this base as working
    if (response.ok) {
      workingApiBase = currentBase;
    }

    return response;
  } catch (error) {
    // Try fallback endpoint if primary fails
    const fallbackBase =
      currentBase === FIXORIUM_API_BASE
        ? CLOUDFLARE_WORKER_BASE
        : FIXORIUM_API_BASE;

    if (fallbackBase && fallbackBase !== currentBase) {
      console.warn(
        `[API] Primary endpoint (${currentBase}) failed. Trying fallback: ${fallbackBase}`,
      );

      const fallbackUrl =
        fallbackBase + (path.startsWith("/") ? "" : "/") + path;

      try {
        const fallbackResponse = await fetch(fallbackUrl, {
          ...options,
          signal: options?.signal || AbortSignal.timeout?.(30000),
        });

        if (fallbackResponse.ok) {
          workingApiBase = fallbackBase;
          cachedBase = fallbackBase;
          return fallbackResponse;
        }
      } catch (fallbackError) {
        console.warn(
          "[API] Fallback endpoint also failed:",
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
        );
      }
    }

    throw error;
  }
};
