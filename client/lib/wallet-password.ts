/**
 * Password management utilities for wallet encryption
 * Password is stored in sessionStorage (cleared on browser close)
 * This prevents exposure in localStorage while maintaining user session
 */

const PASSWORD_SESSION_KEY = "wallet_encryption_password";
const PASSWORD_REQUIRED_KEY = "wallet_requires_password";

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
