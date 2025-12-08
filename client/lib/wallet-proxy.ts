import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  generateMnemonic as generateBip39Mnemonic,
  mnemonicToSeedSync,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import * as nacl from "tweetnacl";
import { assertValidMnemonic, normalizeMnemonicInput } from "@/lib/mnemonic";
import { deriveEd25519Path } from "@/lib/solana-derivation";

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
    balance: 0,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    // USDC (Solana native)
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    balance: 0,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2F69833acc5e0c464c82791c745fdc8f9a?format=webp&width=800",
  },
  {
    // USDT (Tether USD on Solana)
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
    symbol: "USDT",
    name: "USDT TETHER",
    decimals: 6,
    balance: 0,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F21d46b908e134d9783b898bbea7e6c3d%2F672cb65517fe4c02b396825d21cef757?format=webp&width=800",
  },
  {
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
    balance: 0,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2F66c5cbe0ef78435eab9dfe4b45b5ba0d?format=webp&width=800",
  },
  {
    mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
    balance: 0,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2Fb8e7b3fa19fe464c8362834eaf1367eb?format=webp&width=800",
  },
  {
    mint: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
    symbol: "FXM",
    name: "Fixorium",
    decimals: 6,
    balance: 0,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F488bbf32d1ea45139ee8cec42e427393%2Fef8e21a960894d1b9408732e737a9d1f?format=webp&width=800",
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
    console.log(`Fetching balance for: ${publicKey}`);

    // Use server endpoint for balance fetching
    // This avoids CORS issues and ensures reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(
        `/api/wallet/balance?publicKey=${encodeURIComponent(publicKey)}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Balance endpoint returned ${response.status}:`,
          errorText,
        );
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`Raw balance response:`, data);

      // Check for API error in response
      if (data.error) {
        console.error(`Balance API error:`, data.error, data.details);
        throw new Error(
          `API error: ${data.error}${data.details ? ` - ${data.details}` : ""}`,
        );
      }

      const balance =
        data.balance !== undefined
          ? data.balance
          : data.balanceLamports !== undefined
            ? data.balanceLamports / 1_000_000_000
            : 0;

      if (typeof balance !== "number" || !isFinite(balance)) {
        console.error(`Invalid balance value: ${balance}`, data);
        throw new Error(`Invalid balance type: ${typeof balance}`);
      }

      if (balance < 0) {
        console.error(`Negative balance value: ${balance}`, data);
        throw new Error(`Negative balance: ${balance}`);
      }

      console.log(
        `✅ Balance fetched: ${balance} SOL (source: ${data.source || "unknown"})`,
      );
      return balance;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    // Re-throw error so WalletContext can use cached balance fallback
    throw error;
  }
};

export const getTokenAccounts = async (
  publicKey: string,
): Promise<TokenInfo[]> => {
  try {
    console.log(`Fetching token accounts via server API for: ${publicKey}`);

    // Try Helius-powered all-balances endpoint first (includes all tokens with accurate balances)
    try {
      console.log("[TokenAccounts] Attempting Helius all-balances endpoint...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      try {
        const response = await fetch(
          `/api/wallet/all-balances?publicKey=${encodeURIComponent(publicKey)}`,
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const allBalancesTokens = data.tokens || [];

          console.log(
            `[TokenAccounts] ✅ Helius all-balances endpoint success: ${allBalancesTokens.length} tokens`,
          );

          if (allBalancesTokens.length > 0) {
            // Enrich with logos from DEFAULT_TOKENS
            const logoMap = new Map(
              DEFAULT_TOKENS.map((t) => [t.mint, t.logoURI]),
            );
            const enrichedTokens = allBalancesTokens.map((token: any) => ({
              mint: token.mint,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              balance: token.balance || token.uiAmount || 0,
              logoURI: token.logoURI || logoMap.get(token.mint),
            }));

            // Log FXM for debugging
            const fxmToken = enrichedTokens.find((t) => t.symbol === "FXM");
            if (fxmToken) {
              console.log(
                `[TokenAccounts] ✅ FXM found via Helius: balance=${fxmToken.balance}, symbol=${fxmToken.symbol}`,
              );
            }

            console.log(
              `✅ Token accounts loaded from Helius: ${enrichedTokens.length} tokens`,
            );
            return enrichedTokens;
          }
        }
      } catch (heliusError) {
        clearTimeout(timeoutId);
        console.warn(
          "[TokenAccounts] Helius endpoint failed, falling back to Moralis:",
          heliusError instanceof Error
            ? heliusError.message
            : String(heliusError),
        );
      }
    } catch (heliusError) {
      console.warn("[TokenAccounts] Helius attempt error:", heliusError);
    }

    // Try Moralis endpoint second
    try {
      console.log("[TokenAccounts] Attempting Moralis endpoint...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(
          `/api/wallet/moralis-tokens?address=${encodeURIComponent(publicKey)}`,
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const moralisTokens = data.tokens || [];

          console.log(
            `[TokenAccounts] ✅ Moralis endpoint success: ${moralisTokens.length} tokens`,
          );

          if (moralisTokens.length > 0) {
            // Enrich with logos from DEFAULT_TOKENS and convert to TokenInfo format
            const logoMap = new Map(
              DEFAULT_TOKENS.map((t) => [t.mint, t.logoURI]),
            );
            const enrichedTokens = moralisTokens.map((token: any) => ({
              mint: token.mint,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              balance: parseFloat(token.uiAmount || "0"),
              logoURI: token.logoURI || logoMap.get(token.mint),
            }));

            // Log FXM for debugging
            const fxmToken = enrichedTokens.find((t) => t.symbol === "FXM");
            if (fxmToken) {
              console.log(
                `[TokenAccounts] FXM found via Moralis: balance=${fxmToken.balance}, symbol=${fxmToken.symbol}`,
              );
            }

            console.log(
              `✅ Token accounts loaded from Moralis: ${enrichedTokens.length} tokens`,
            );
            return enrichedTokens;
          }
        }
      } catch (moralisError) {
        clearTimeout(timeoutId);
        console.warn(
          "[TokenAccounts] Moralis endpoint failed, falling back to RPC:",
          moralisError instanceof Error
            ? moralisError.message
            : String(moralisError),
        );
      }
    } catch (moralisError) {
      console.warn("[TokenAccounts] Moralis attempt error:", moralisError);
    }

    // Fallback to RPC-based endpoint if Helius and Moralis fail
    console.log("[TokenAccounts] Using fallback RPC endpoint...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(
        `/api/wallet/token-accounts?publicKey=${encodeURIComponent(publicKey)}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const tokenAccounts = data.tokens || [];
      const isUsingFallback =
        data.warning && data.warning.includes("unavailable");

      console.log(`[TokenAccounts] RPC response:`, {
        publicKey,
        tokenCount: tokenAccounts.length,
        firstToken: tokenAccounts[0],
        solTokenBalance: tokenAccounts.find((t) => t.symbol === "SOL")?.balance,
      });

      if (isUsingFallback) {
        console.warn(
          `[TokenAccounts] Server returned fallback data:`,
          data.warning,
        );
      }

      // Enrich tokens with logos from DEFAULT_TOKENS
      const logoMap = new Map(DEFAULT_TOKENS.map((t) => [t.mint, t.logoURI]));
      const allTokens = tokenAccounts.map((token) => ({
        ...token,
        logoURI: token.logoURI || logoMap.get(token.mint),
      }));

      // Log FXM and special tokens for debugging
      const fxmToken = allTokens.find((t) => t.symbol === "FXM");
      if (fxmToken) {
        console.log(
          `[TokenAccounts] FXM token found (RPC): balance=${fxmToken.balance}, decimals=${fxmToken.decimals}`,
        );
      }

      // Ensure SOL is present with proper balance
      const solIndex = allTokens.findIndex(
        (t) => t.mint === "So11111111111111111111111111111111111111112",
      );
      if (solIndex >= 0) {
        // Ensure SOL balance is a valid number
        const solBalance = allTokens[solIndex].balance;
        if (
          typeof solBalance !== "number" ||
          !isFinite(solBalance) ||
          solBalance < 0
        ) {
          console.warn(
            `[TokenAccounts] SOL balance is invalid: ${solBalance}, will fetch from dedicated endpoint`,
          );
          allTokens[solIndex].balance = 0;
        }
      } else {
        // If SOL not found from RPC, add it with 0 balance (will be fetched later)
        allTokens.unshift({
          mint: "So11111111111111111111111111111111111111112",
          symbol: "SOL",
          name: "Solana",
          decimals: 9,
          balance: 0,
          logoURI:
            "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
        });
      }

      console.log(
        `✅ Token accounts loaded from RPC: ${allTokens.length} tokens (SOL balance: ${
          allTokens.find((t) => t.symbol === "SOL")?.balance ?? "not found"
        })`,
      );
      return allTokens;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("Failed to fetch token accounts:", error);
    // Return at least SOL on error
    return [
      {
        mint: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        balance: 0,
        logoURI:
          "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
      },
    ];
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
