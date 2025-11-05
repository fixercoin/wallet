// Production deployment defaults
const CLOUDFLARE_WORKER_BASE = "https://proxy.fixorium.com.pk";

const normalizeBase = (value: string | null | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const determineBase = (): string => {
  const envBase = normalizeBase(import.meta.env?.VITE_API_BASE_URL);
  if (envBase) return envBase;
  // Always use remote Cloudflare Worker in dev and production
  return CLOUDFLARE_WORKER_BASE;
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
  if (!base) {
    // When no base is configured, ensure /api prefix is present for local routes
    return normalizedPath.startsWith("/api")
      ? normalizedPath
      : `/api${normalizedPath}`;
  }
  // When base is set (e.g., https://wallet.fixorium.com.pk/api), don't duplicate /api
  if (normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.substring(4)}`; // Remove /api prefix from path
  }
  return `${base}${normalizedPath}`;
};
