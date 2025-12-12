/**
 * Backendless Configuration
 * Manages connection to Backendless database for P2P storage
 */

const BACKENDLESS_APP_ID = process.env.BACKENDLESS_APP_ID || "";
const BACKENDLESS_API_KEY = process.env.BACKENDLESS_API_KEY || "";
const BACKENDLESS_URL =
  process.env.BACKENDLESS_URL || "https://api.backendless.com";

export const BACKENDLESS_TABLES = {
  ORDERS: "p2p_orders",
  PAYMENT_METHODS: "p2p_payment_methods",
  NOTIFICATIONS: "p2p_notifications",
  ESCROW: "p2p_escrow",
  DISPUTES: "p2p_disputes",
  MATCHES: "p2p_matches",
  ROOMS: "p2p_rooms",
  MESSAGES: "p2p_messages",
  MERCHANT_STATS: "p2p_merchant_stats",
  STAKING: "staking_records",
  REWARDS: "staking_rewards",
};

export function initializeBackendless(): {
  appId: string;
  apiKey: string;
  url: string;
} {
  if (!BACKENDLESS_APP_ID || !BACKENDLESS_API_KEY) {
    throw new Error(
      "Backendless credentials missing: BACKENDLESS_APP_ID, BACKENDLESS_API_KEY",
    );
  }

  return {
    appId: BACKENDLESS_APP_ID,
    apiKey: BACKENDLESS_API_KEY,
    url: BACKENDLESS_URL,
  };
}

export function getBackendlessConfig() {
  return initializeBackendless();
}
