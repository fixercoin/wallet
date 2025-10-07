import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import {
  generateMnemonic as generateBip39Mnemonic,
  mnemonicToSeedSync,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import * as nacl from "tweetnacl";
import { assertValidMnemonic, normalizeMnemonicInput } from "@/lib/mnemonic";
import { deriveEd25519Path } from "@/lib/solana-derivation";

// Solana mainnet RPC endpoints - using reliable public providers
const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",

  "https://solana.blockpi.network/v1/rpc/public",
];

// Try endpoints in order until one works
let currentRpcUrl = RPC_ENDPOINTS[0];
export const connection = new Connection(currentRpcUrl, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  httpHeaders: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// RPC endpoint failover function
const tryRpcEndpoints = async <T>(
  operation: (connection: Connection) => Promise<T>,
): Promise<T> => {
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    try {
      const rpcUrl = RPC_ENDPOINTS[i];
      const testConnection = new Connection(rpcUrl, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
        disableRetryOnRateLimit: false,
        httpHeaders: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const result = await operation(testConnection);

      // If successful, update the global connection
      if (currentRpcUrl !== rpcUrl) {
        currentRpcUrl = rpcUrl;
      }

      return result;
    } catch (error) {
      console.warn(`RPC endpoint ${RPC_ENDPOINTS[i]} failed:`, error);

      // If this is the last endpoint, throw the error
      if (i === RPC_ENDPOINTS.length - 1) {
        throw error;
      }
    }
  }

  throw new Error("All RPC endpoints failed");
};

export interface WalletData {
  publicKey: string;
  secretKey: Uint8Array;
  mnemonic?: string;
}

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  liquidity?: number;
}

// Default tokens including SOL and FIXERCOIN
export const DEFAULT_TOKENS: TokenInfo[] = [
  {
    mint: "So11111111111111111111111111111111111111112", // SOL wrapped
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
    logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
  },
  {
    mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F1dcb0d36c5bf4efdba0ee3bc71943ae3%2F36cba9baf32f4d82b64307dac9f5b70a?format=webp&width=800",
  },
];

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'" as const;

export const generateMnemonic = (): string => {
  return normalizeMnemonicInput(generateBip39Mnemonic(wordlist));
};

export const mnemonicToKeypair = (mnemonic: string): Keypair => {
  const normalized = normalizeMnemonicInput(mnemonic);
  const seed = mnemonicToSeedSync(normalized);
  const derivedSeed = deriveEd25519Path(SOLANA_DERIVATION_PATH, seed);
  const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);
  return Keypair.fromSecretKey(keypair.secretKey);
};

export const generateWallet = (): WalletData => {
  const mnemonic = generateMnemonic();
  const keypair = mnemonicToKeypair(mnemonic);

  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: keypair.secretKey,
    mnemonic,
  };
};

export const recoverWallet = (mnemonicInput: string): WalletData => {
  const mnemonic = assertValidMnemonic(mnemonicInput);
  const keypair = mnemonicToKeypair(mnemonic);

  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: keypair.secretKey,
    mnemonic,
  };
};

export const getBalance = async (publicKey: string): Promise<number> => {
  try {
    const pubKey = new PublicKey(publicKey);

    const balance = await tryRpcEndpoints(async (conn) => {
      return await conn.getBalance(pubKey);
    });

    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error fetching balance:", error);
    return 0;
  }
};

export const getTokenAccounts = async (
  publicKey: string,
): Promise<TokenInfo[]> => {
  try {
    const pubKey = new PublicKey(publicKey);

    const tokenAccounts = await tryRpcEndpoints(async (conn) => {
      return await conn.getParsedTokenAccountsByOwner(pubKey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      });
    });

    // Process token accounts and return with balance info
    const tokens = await Promise.all(
      tokenAccounts.value.map(async (account) => {
        const parsedInfo = account.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount.uiAmount || 0;
        const decimals = parsedInfo.tokenAmount.decimals;

        // Try to get token metadata
        let tokenInfo: TokenInfo = {
          mint,
          symbol: "UNKNOWN",
          name: "Unknown Token",
          decimals,
          balance,
        };

        // Check if it's a known token from DEFAULT_TOKENS
        const knownToken = DEFAULT_TOKENS.find((t) => t.mint === mint);
        if (knownToken) {
          tokenInfo = {
            ...knownToken,
            balance,
            decimals: decimals || knownToken.decimals,
          };
        } else {
          // Try to fetch metadata from Jupiter API
          try {
            const response = await fetch(`https://token.jup.ag/strict/${mint}`);
            if (response.ok) {
              const metadata = await response.json();
              tokenInfo = {
                mint,
                symbol: metadata.symbol || "UNKNOWN",
                name: metadata.name || "Unknown Token",
                decimals: metadata.decimals || decimals,
                logoURI: metadata.logoURI,
                balance,
              };
            }
          } catch (metadataError) {
            console.warn(
              `Failed to fetch metadata for token ${mint}:`,
              metadataError,
            );
          }
        }

        console.log(
          `Token found: ${tokenInfo.symbol} (${tokenInfo.name}) - Balance: ${balance}`,
        );
        return tokenInfo;
      }),
    );

    // Include all tokens that exist in accounts (even with 0 balance) and default tokens
    const filteredTokens = tokens.filter(
      (token) =>
        token.balance !== undefined ||
        DEFAULT_TOKENS.some((dt) => dt.mint === token.mint),
    );

    console.log(`Returning ${filteredTokens.length} tokens with balances`);
    return filteredTokens;
  } catch (error) {
    console.error("Error fetching token accounts:", error);
    return [];
  }
};

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const importWalletFromPrivateKey = (input: string): WalletData => {
  const raw = input.trim();
  let secret: Uint8Array | null = null;

  // Try JSON array [..]
  if (!secret) {
    try {
      if (raw.startsWith("[") && raw.endsWith("]")) {
        const arr = JSON.parse(raw) as number[];
        if (Array.isArray(arr) && arr.every((n) => typeof n === "number")) {
          secret = Uint8Array.from(arr);
        }
      }
    } catch {}
  }

  // Try base58
  if (!secret) {
    try {
      secret = bs58.decode(raw);
    } catch {}
  }

  // Try base64
  if (!secret) {
    try {
      const bin = atob(raw);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      secret = out;
    } catch {}
  }

  // Try hex
  if (!secret) {
    try {
      const cleaned = raw.toLowerCase().replace(/^0x/, "");
      if (cleaned.length % 2 === 0 && /^[0-9a-f]+$/.test(cleaned)) {
        const len = cleaned.length / 2;
        const out = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
        }
        secret = out;
      }
    } catch {}
  }

  if (!secret) {
    throw new Error(
      "Unsupported private key format. Use base58, base64, hex, or JSON array.",
    );
  }

  // Normalize to 64-byte secret key
  let fullSecret: Uint8Array;
  if (secret.length === 64) {
    fullSecret = secret;
  } else if (secret.length === 32) {
    const kp = nacl.sign.keyPair.fromSeed(secret);
    fullSecret = kp.secretKey;
  } else {
    throw new Error("Invalid secret key length. Expected 32 or 64 bytes.");
  }

  const keypair = Keypair.fromSecretKey(fullSecret);
  return {
    publicKey: keypair.publicKey.toString(),
    secretKey: keypair.secretKey,
  };
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  // First try the modern Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("Modern Clipboard API failed, trying fallback:", error);
    }
  }

  // Fallback to legacy method using document.execCommand
  try {
    // Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Style the textarea to be invisible
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.setAttribute("readonly", "");

    // Add to DOM, select text, copy, and remove
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    } else {
      throw new Error("document.execCommand('copy') was unsuccessful");
    }
  } catch (error) {
    console.error("All clipboard methods failed:", error);

    // Final fallback - prompt user to copy manually
    if (window.prompt) {
      window.prompt("Copy this text manually:", text);
      return true; // Assume user copied it
    }

    return false;
  }
};
