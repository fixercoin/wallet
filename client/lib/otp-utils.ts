/**
 * OTP (One-Time Password) utilities for transaction verification
 * Generates and validates 6-digit OTP codes with expiration
 */

export interface OTPSession {
  code: string;
  phoneNumber: string;
  generatedAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTPCode(): string {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/**
 * Create a new OTP session
 */
export function createOTPSession(phoneNumber: string): OTPSession {
  const now = Date.now();
  return {
    code: generateOTPCode(),
    phoneNumber: normalizePhoneNumber(phoneNumber),
    generatedAt: now,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
  };
}

/**
 * Verify an OTP code against a session
 */
export function verifyOTP(
  session: OTPSession,
  enteredCode: string,
): {
  valid: boolean;
  error?: string;
} {
  const now = Date.now();

  // Check if expired
  if (now > session.expiresAt) {
    return {
      valid: false,
      error: "OTP code has expired. Please request a new one.",
    };
  }

  // Check if max attempts exceeded
  if (session.attempts >= session.maxAttempts) {
    return {
      valid: false,
      error: `Maximum attempts (${session.maxAttempts}) exceeded. Please request a new OTP.`,
    };
  }

  // Verify code
  const valid = enteredCode.trim() === session.code;

  if (!valid) {
    session.attempts += 1;
    const remaining = session.maxAttempts - session.attempts;
    return {
      valid: false,
      error: `Invalid code. ${remaining} attempts remaining.`,
    };
  }

  return { valid: true };
}

/**
 * Get time remaining for OTP (in seconds)
 */
export function getOTPTimeRemaining(session: OTPSession): number {
  const remaining = session.expiresAt - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Format phone number to E.164 format (or similar)
 * Removes spaces, dashes, parentheses
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Mask phone number for display (show last 4 digits)
 */
export function maskPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length < 4) return phone;
  return `**** ${normalized.slice(-4)}`;
}

/**
 * Validate phone number format (basic check)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Basic check: should be between 10-15 digits
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Store OTP session in sessionStorage
 */
export function storeOTPSession(session: OTPSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("otp_session", JSON.stringify(session));
  } catch (e) {
    console.warn("Failed to store OTP session:", e);
  }
}

/**
 * Get OTP session from sessionStorage
 */
export function getStoredOTPSession(): OTPSession | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem("otp_session");
    if (!stored) return null;
    return JSON.parse(stored) as OTPSession;
  } catch (e) {
    console.warn("Failed to retrieve OTP session:", e);
    return null;
  }
}

/**
 * Clear OTP session from sessionStorage
 */
export function clearOTPSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem("otp_session");
  } catch (e) {
    console.warn("Failed to clear OTP session:", e);
  }
}
