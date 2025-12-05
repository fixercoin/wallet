/**
 * Password management utilities for wallet encryption
 * Password is stored in sessionStorage (cleared on browser close)
 * This prevents exposure in localStorage while maintaining user session
 */

import {
  encryptWalletData,
  isEncryptedWalletStorage,
  isPlaintextWalletStorage,
} from "@/lib/secure-storage";
import type { WalletData } from "@/lib/wallet-proxy";

const PASSWORD_SESSION_KEY = "wallet_encryption_password";
const PASSWORD_REQUIRED_KEY = "wallet_requires_password";
const WALLETS_STORAGE_KEY = "solana_wallet_accounts";

/**
 * Set the wallet encryption password in session storage
 * This is temporary and cleared when browser closes
 */
export function setWalletPassword(password: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PASSWORD_SESSION_KEY, password);
  } catch (e) {
    console.warn("Failed to store password in session:", e);
  }
}

/**
 * Get the wallet encryption password from session storage
 * Returns null if not set or sessionStorage unavailable
 */
export function getWalletPassword(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PASSWORD_SESSION_KEY);
  } catch (e) {
    console.warn("Failed to retrieve password from session:", e);
    return null;
  }
}

/**
 * Clear the wallet encryption password from session storage
 */
export function clearWalletPassword(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PASSWORD_SESSION_KEY);
  } catch (e) {
    console.warn("Failed to clear password from session:", e);
  }
}

/**
 * Check if wallet requires a password
 */
export function doesWalletRequirePassword(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const value = localStorage.getItem(PASSWORD_REQUIRED_KEY);
    return value === "true";
  } catch (e) {
    return false;
  }
}

/**
 * Mark wallet as requiring password protection
 */
export function markWalletAsPasswordProtected(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PASSWORD_REQUIRED_KEY, "true");
  } catch (e) {
    console.warn("Failed to mark wallet as password protected:", e);
  }
}

/**
 * Check if password is currently available in session
 */
export function isPasswordAvailable(): boolean {
  return getWalletPassword() !== null;
}

/**
 * Encrypt currently stored wallets immediately using the password in session.
 * If wallets are already encrypted or no password is present, this is a no-op.
 */
export function encryptStoredWalletsIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    const password = getWalletPassword();
    if (!password) return;

    const stored = localStorage.getItem(WALLETS_STORAGE_KEY);
    if (!stored) return;

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    // If already encrypted, skip
    if (isEncryptedWalletStorage(parsed[0])) return;

    // Coerce and encrypt
    const plaintextWallets: WalletData[] = parsed.map((p: any) => {
      const obj = { ...p } as any;
      if (obj.secretKey && Array.isArray(obj.secretKey)) {
        obj.secretKey = Uint8Array.from(obj.secretKey);
      } else if (obj.secretKey && typeof obj.secretKey === "object") {
        const vals = Object.values(obj.secretKey).filter(
          (v) => typeof v === "number",
        ) as number[];
        if (vals.length > 0) obj.secretKey = Uint8Array.from(vals);
      }
      return obj as WalletData;
    });

    const encrypted = plaintextWallets.map((w) =>
      encryptWalletData(w, password),
    );
    localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(encrypted));

    // Notify other parts of the app (WalletContext) that wallets were encrypted
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.dispatchEvent === "function"
      ) {
        window.dispatchEvent(
          new CustomEvent("wallets_encrypted", {
            detail: { timestamp: Date.now() },
          }),
        );
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // swallow to avoid breaking settings flow
    console.warn("encryptStoredWalletsIfNeeded failed:", e);
  }
}
