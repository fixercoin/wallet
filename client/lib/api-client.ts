const DEFAULT_WORKER_BASE = "https://api.fixorium.com";

const normalizeBase = (value: string | null | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const determineBase = (): string => {
  const envBase = normalizeBase(import.meta.env?.VITE_API_BASE_URL);
  if (envBase) return envBase;

  // Default to same-origin both locally and in production
  // so that Cloudflare Pages Functions at /api/* are used.
  return "";
};

let cachedBase: string | null = null;

export const getApiBaseUrl = (): string => {
  if (cachedBase === null) {
    cachedBase = determineBase();
  }
  return cachedBase;
};

export const resolveApiUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
};
