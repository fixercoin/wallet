// Solana RPC Service using Web3.js and public Solflare endpoint
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://api.mainnet-beta.solflare.network";

export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export const KNOWN_TOKENS: Record<string, TokenMetadata> = {
  So11111111111111111111111111111111111111112: {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
    symbol: "USDT",
    name: "USDT TETHER",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F559a5e19be114c9d8427d6683b845144%2Fc2ea69828dbc4a90b2deed99c2291802?format=webp&width=800",
  },
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: {
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    symbol: "FIXERCOIN",
    name: "FIXERCOIN",
    decimals: 6,
    logoURI: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
  },
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: {
    mint: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
    symbol: "LOCKER",
    name: "LOCKER",
    decimals: 6,
    logoURI: "https://via.placeholder.com/64x64/8b5cf6/ffffff?text=LO",
  },
  "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump": {
    mint: "7Fnx57ztmhdpL1uAGmUY1ziwPG2UDKmG6poB4ibjpump",
    symbol: "FXM",
    name: "Fixorium",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2Feff28b05195a4f5f8e8aaeec5f72bbfe%2Fc78ec8b33eec40be819bca514ed06f2a?format=webp&width=800",
  },
};

const connection = new Connection(RPC_URL, "confirmed");
const requestQueue = new Map<string, Promise<any>>();

const MAX_RETRIES = 2;
const RETRY_DELAY = 500;

const retryableCall = async <T>(
  fn: () => Promise<T>,
  method: string,
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw (
    lastError || new Error(`${method} failed after ${MAX_RETRIES + 1} retries`)
  );
};

export const makeRpcCall = async (
  method: string,
  params: any[] = [],
): Promise<any> => {
  const requestKey = `${method}-${JSON.stringify(params)}`;

  if (requestQueue.has(requestKey)) {
    return requestQueue.get(requestKey);
  }

  const requestPromise = (async () => {
    try {
      console.log(`[RPC] Calling ${method} on Solflare`);

      switch (method) {
        case "getBalance":
          return await retryableCall(
            () => connection.getBalance(new PublicKey(params[0])),
            method,
          );

        case "getTokenAccountsByOwner": {
          const filter = params[1];
          const convertedFilter: any = {};
          if (filter.programId) {
            convertedFilter.programId =
              typeof filter.programId === "string"
                ? new PublicKey(filter.programId)
                : filter.programId;
          }
          if (filter.mint) {
            convertedFilter.mint =
              typeof filter.mint === "string"
                ? new PublicKey(filter.mint)
                : filter.mint;
          }
          return await retryableCall(
            () =>
              connection.getTokenAccountsByOwner(
                new PublicKey(params[0]),
                convertedFilter,
                params[2],
              ),
            method,
          );
        }

        case "getTokenSupply":
          return await retryableCall(
            () => connection.getTokenSupply(new PublicKey(params[0])),
            method,
          );

        case "getMultipleAccounts":
          return await retryableCall(
            () =>
              connection.getMultipleAccountsInfo(
                params[0].map((pk: string) => new PublicKey(pk)),
              ),
            method,
          );

        case "getAccountInfo":
          return await retryableCall(
            () => connection.getAccountInfo(new PublicKey(params[0])),
            method,
          );

        case "getSignaturesForAddress":
          return await retryableCall(
            () =>
              connection.getSignaturesForAddress(
                new PublicKey(params[0]),
                params[1],
              ),
            method,
          );

        case "getTransaction":
          return await retryableCall(
            () => connection.getParsedTransaction(params[0], params[1]),
            method,
          );

        default:
          throw new Error(`Unsupported RPC method: ${method}`);
      }
    } catch (error) {
      console.error(`[RPC] ${method} failed:`, error);
      throw error;
    }
  })();

  requestQueue.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    requestQueue.delete(requestKey);
  }
};

export const getWalletBalance = async (publicKey: string): Promise<number> => {
  try {
    const lamports = await connection.getBalance(new PublicKey(publicKey));
    const sol = lamports / 1_000_000_000;
    return Number.isFinite(sol) ? sol : 0;
  } catch (error) {
    console.error("[Balance] Failed to fetch balance:", error);
    return 0;
  }
};

export const getTokenAccounts = async (publicKey: string) => {
  const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

  try {
    const response = await retryableCall(
      () =>
        connection.getTokenAccountsByOwner(
          new PublicKey(publicKey),
          { programId: new PublicKey(TOKEN_PROGRAM_ID) },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ),
      "getTokenAccounts",
    );

    console.log(`[Token Accounts] Got ${response.value.length} token accounts`);

    return response.value
      .map((account: any) => {
        try {
          const parsedData = account.account.data;
          if (
            typeof parsedData === "object" &&
            "parsed" in parsedData &&
            "info" in parsedData.parsed
          ) {
            const info = (parsedData.parsed as any).info;
            const mint = info.mint;
            const decimals = info.tokenAmount.decimals;

            let balance = 0;
            if (typeof info.tokenAmount.uiAmount === "number") {
              balance = info.tokenAmount.uiAmount;
            } else if (info.tokenAmount.amount) {
              const rawAmount = BigInt(info.tokenAmount.amount);
              balance = Number(rawAmount) / Math.pow(10, decimals || 0);
            }

            const metadata = KNOWN_TOKENS[mint] || {
              mint,
              symbol: "UNKNOWN",
              name: "Unknown Token",
              decimals,
            };

            return {
              ...metadata,
              balance,
              decimals: decimals || metadata.decimals,
            };
          }
          return null;
        } catch (parseError) {
          console.error("[Token Accounts] Error parsing account:", parseError);
          return null;
        }
      })
      .filter((token) => token !== null);
  } catch (error) {
    console.error("[Token Accounts] Failed to fetch token accounts:", error);
    return [];
  }
};

export const getTokenMetadata = async (
  mint: string,
): Promise<TokenMetadata | null> => {
  if (KNOWN_TOKENS[mint]) {
    return KNOWN_TOKENS[mint];
  }

  try {
    const supplyInfo = await connection.getTokenSupply(new PublicKey(mint));
    return {
      mint,
      symbol: "UNKNOWN",
      name: "Unknown Token",
      decimals: supplyInfo.value.decimals || 9,
    };
  } catch (error) {
    console.error(`Error fetching metadata for token ${mint}:`, error);
    return null;
  }
};

export const getMultipleAccounts = async (publicKeys: string[]) => {
  try {
    return await connection.getMultipleAccountsInfo(
      publicKeys.map((pk) => new PublicKey(pk)),
    );
  } catch (error) {
    console.error("Error fetching multiple accounts:", error);
    return [];
  }
};

export const getAccountInfo = async (publicKey: string) => {
  try {
    return await connection.getAccountInfo(new PublicKey(publicKey));
  } catch (error) {
    console.error(`Error fetching account info for ${publicKey}:`, error);
    return null;
  }
};

export const addKnownToken = (metadata: TokenMetadata) => {
  KNOWN_TOKENS[metadata.mint] = metadata;
};

export const getKnownTokens = (): Record<string, TokenMetadata> => {
  return { ...KNOWN_TOKENS };
};

export const getTokenBalanceForMint = async (
  walletAddress: string,
  tokenMint: string,
): Promise<number | null> => {
  try {
    const response = await retryableCall(
      () =>
        connection.getTokenAccountsByOwner(
          new PublicKey(walletAddress),
          { mint: new PublicKey(tokenMint) },
          { encoding: "jsonParsed", commitment: "confirmed" },
        ),
      "getTokenBalanceForMint",
    );

    if (response.value.length > 0) {
      const account = response.value[0];
      const parsedData = account.account.data;
      if (
        typeof parsedData === "object" &&
        "parsed" in parsedData &&
        "info" in parsedData.parsed
      ) {
        const info = (parsedData.parsed as any).info;
        const decimals = info.tokenAmount.decimals;

        let balance = 0;
        if (typeof info.tokenAmount.uiAmount === "number") {
          balance = info.tokenAmount.uiAmount;
        } else if (info.tokenAmount.amount) {
          const rawAmount = BigInt(info.tokenAmount.amount);
          balance = Number(rawAmount) / Math.pow(10, decimals || 0);
        }

        console.log(`[Token Balance] Fetched ${tokenMint}: ${balance}`);
        return balance;
      }
    }
    return null;
  } catch (error) {
    console.error(
      `[Token Balance] Failed to fetch balance for ${tokenMint}:`,
      error,
    );
    return null;
  }
};
