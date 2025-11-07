// API base resolution is via VITE_API_BASE_URL; otherwise same-origin /api

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
  if (workingApiBase) return workingApiBase;
  // Default to same-origin relative API
  return "";
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
    // No external fallback; surface the error to caller
    throw error as any;
  }
};
