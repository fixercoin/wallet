import * as nacl from "tweetnacl";
import { WalletData } from "./wallet-proxy";

const STORAGE_VERSION = "1";
const ENCRYPTION_ALGORITHM = "nacl.secretbox";

export interface EncryptedWalletStorage {
  version: string;
  algorithm: string;
  encryptedData: string; // base64 encoded
  nonce: string; // base64 encoded
  salt: string; // base64 encoded
}

export interface WalletStorageData {
  publicKey: string;
  secretKey: number[]; // Serialized Uint8Array
  mnemonic?: string;
  label?: string;
}

/**
 * Derive a 32-byte key from password using BLAKE2b hash
 * This ensures the same password always produces the same key
 */
function deriveKeyFromPassword(password: string, salt: Uint8Array): Uint8Array {
  const passwordBytes = new TextEncoder().encode(password);
  const combined = new Uint8Array(passwordBytes.length + salt.length);
  combined.set(passwordBytes);
  combined.set(salt, passwordBytes.length);

  // Use BLAKE2b hash for key derivation
  const hash = nacl.hash(combined);
  // Return first 32 bytes for secretbox key
  return hash.slice(0, 32);
}

/**
 * Convert Uint8Array to base64 string (browser-compatible)
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

/**
 * Convert base64 string to Uint8Array (browser-compatible)
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt wallet data with a password
 * Returns encrypted blob that can be stored safely
 */
export function encryptWalletData(
  walletData: WalletData,
  password: string,
): EncryptedWalletStorage {
  if (!password || password.trim().length === 0) {
    throw new Error("Password is required for wallet encryption");
  }

  // Generate random salt for this encryption
  const salt = nacl.randomBytes(16);

  // Derive encryption key from password and salt
  const key = deriveKeyFromPassword(password, salt);

  // Prepare wallet data for encryption
  const dataToEncrypt: WalletStorageData = {
    publicKey: walletData.publicKey,
    secretKey: Array.from(walletData.secretKey), // Convert Uint8Array to number[]
    mnemonic: walletData.mnemonic,
    label: walletData.label,
  };

  // Serialize to JSON
  const jsonString = JSON.stringify(dataToEncrypt);
  const plaintext = new TextEncoder().encode(jsonString);

  // Generate random nonce
  const nonce = nacl.randomBytes(24);

  // Encrypt using secretbox
  const encrypted = nacl.secretbox(plaintext, nonce, key);

  // Return encrypted blob with metadata
  return {
    version: STORAGE_VERSION,
    algorithm: ENCRYPTION_ALGORITHM,
    encryptedData: bytesToBase64(encrypted),
    nonce: bytesToBase64(nonce),
    salt: bytesToBase64(salt),
  };
}

/**
 * Decrypt wallet data using password
 * Throws error if password is incorrect or data is corrupted
 */
export function decryptWalletData(
  encrypted: EncryptedWalletStorage,
  password: string,
): WalletData {
  if (!password || password.trim().length === 0) {
    throw new Error("Password is required to decrypt wallet");
  }

  try {
    // Decode from base64
    const encryptedData = base64ToBytes(encrypted.encryptedData);
    const nonce = base64ToBytes(encrypted.nonce);
    const salt = base64ToBytes(encrypted.salt);

    // Derive the same key using password and salt
    const key = deriveKeyFromPassword(password, salt);

    // Decrypt using secretbox
    const plaintext = nacl.secretbox.open(encryptedData, nonce, key);

    if (!plaintext) {
      throw new Error("Invalid password or corrupted wallet data");
    }

    // Decode JSON
    const jsonString = new TextDecoder().decode(plaintext);
    const data: WalletStorageData = JSON.parse(jsonString);

    // Convert secretKey back to Uint8Array
    return {
      publicKey: data.publicKey,
      secretKey: Uint8Array.from(data.secretKey),
      mnemonic: data.mnemonic,
      label: data.label,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid password or corrupted wallet data"
    ) {
      throw error;
    }
    throw new Error(
      "Failed to decrypt wallet: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
  }
}

/**
 * Check if stored wallet data is encrypted (has encryption metadata)
 */
export function isEncryptedWalletStorage(
  data: any,
): data is EncryptedWalletStorage {
  return (
    data &&
    typeof data === "object" &&
    data.version === STORAGE_VERSION &&
    data.algorithm === ENCRYPTION_ALGORITHM &&
    typeof data.encryptedData === "string" &&
    typeof data.nonce === "string" &&
    typeof data.salt === "string"
  );
}

/**
 * Check if wallet data is in old plaintext format (migration)
 */
export function isPlaintextWalletStorage(data: any): data is WalletData {
  return (
    data &&
    typeof data === "object" &&
    typeof data.publicKey === "string" &&
    (data.secretKey instanceof Uint8Array || Array.isArray(data.secretKey))
  );
}
