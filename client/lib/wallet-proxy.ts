import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  generateMnemonic as generateBip39Mnemonic,
  mnemonicToSeedSync,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import * as nacl from "tweetnacl";
import { assertValidMnemonic, normalizeMnemonicInput } from "@/lib/mnemonic";
import { deriveEd25519Path } from "@/lib/solana-derivation";
import {
  getWalletBalance as getSolanaBalance,
  getTokenAccounts as getSolanaTokenAccounts,
} from "@/lib/services/solana-rpc";

const fetchJsonWithTimeout = async (url: string, ms = 10000) => {
  let id: any;
  const timeoutResult = { ok: false, json: {}, error: "timeout" } as any;

  const timeoutPromise = new Promise<{ ok: boolean; json: any }>((resolve) => {
    id = setTimeout(() => resolve(timeoutResult), ms);
  });

  const fetchPromise = (async () => {
    try {
      const resp = await fetch(url);
      const json = await resp.json().catch(() => ({}));
      return { ok: resp.ok, json } as { ok: boolean; json: any };
    } catch (err) {
      console.warn(`fetchJsonWithTimeout failed for ${url}:`, err);
      return {
        ok: false,
        json: {},
        error: err instanceof Error ? err.message : String(err),
      } as any;
    }
  })();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  clearTimeout(id);
  return result as { ok: boolean; json: any };
};

export interface WalletData {
  publicKey: string;
  secretKey: Uint8Array;
  mnemonic?: string;
  label?: string;
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

// Default tokens including SOL, USDC, USDT, and FIXERCOIN
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
    // USDC (Solana native)
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    // USDT (Tether USD on Solana)
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F559a5e19be114c9d8427d6683b845144%2Fc2ea69828dbc4a90b2deed99c2291802?format=webp&width=800",
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
      "https://i.postimg.cc/J7p1FPbm/IMG-20250425-004450-removebg-preview-modified-2-6.png",
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
  // Try our REST endpoint first
  try {
    const url = `/api/wallet/balance?publicKey=${encodeURIComponent(publicKey)}`;
    const { ok, json } = await fetchJsonWithTimeout(url, 10000);
    if (ok && json && typeof json.balance === "number") {
      console.log(`✅ Wallet balance endpoint successful: ${json.balance} SOL`);
      return json.balance;
    }
  } catch (err) {
    // Silently fail and try fallback
  }
  // Fallback to RPC service
  try {
    console.log(`Fetching balance via Solana RPC for: ${publicKey}`);
    const balance = await getSolanaBalance(publicKey);
    console.log(`✅ Solana RPC successful: ${balance} SOL`);
    return balance;
  } catch (error) {
    console.error("Solana RPC failed for balance:", error);
    return 0;
  }
};

export const getTokenAccounts = async (
  publicKey: string,
): Promise<TokenInfo[]> => {
  try {
    console.log(`Fetching token accounts via Solana RPC for: ${publicKey}`);

    const tokenAccounts = await getSolanaTokenAccounts(publicKey);

    // Merge with default tokens to ensure all known tokens are included
    const allTokens = [...DEFAULT_TOKENS];

    // Update balances for tokens we found on-chain
    tokenAccounts.forEach((tokenAccount) => {
      const existingTokenIndex = allTokens.findIndex(
        (t) => t.mint === tokenAccount.mint,
      );
      if (existingTokenIndex >= 0) {
        allTokens[existingTokenIndex] = {
          ...allTokens[existingTokenIndex],
          balance: tokenAccount.balance,
        };
      } else {
        allTokens.push(tokenAccount);
      }
    });

    console.log(`✅ Solana RPC successful: ${allTokens.length} tokens`);
    return allTokens;
  } catch (error) {
    console.error("Solana RPC failed for token accounts:", error);
    return DEFAULT_TOKENS.map((token) => ({ ...token, balance: 0 }));
  }
};

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
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
