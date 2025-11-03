// Production deployment defaults
const CLOUDFLARE_WORKER_BASE =
  "https://fixorium-proxy.khanbabusargodha.workers.dev";

const normalizeBase = (value: string | null | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
};

const determineBase = (): string => {
  const envBase = normalizeBase(import.meta.env?.VITE_API_BASE_URL);
  if (envBase) return envBase;

  // Development: localhost uses local Express backend
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return "";
  }

  // Production on Netlify: use local /api (proxied to netlify functions)
  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes("netlify.app")
  ) {
    return "";
  }

  // Custom domain deployment: use local /api proxy
  if (
    typeof window !== "undefined" &&
    (window.location.hostname.includes("fixorium.com.pk") ||
     window.location.hostname.includes("fixorium.com"))
  ) {
    return "";
  }

  // Production on Cloudflare Pages: use Cloudflare Worker
  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes("pages.dev")
  ) {
    return CLOUDFLARE_WORKER_BASE;
  }

  // Fallback to Cloudflare Worker
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
  if (!base) return normalizedPath;
  return `${base}${normalizedPath}`;
};
