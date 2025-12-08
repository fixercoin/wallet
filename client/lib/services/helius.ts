// Solana Web3.js Service for blockchain data
// Uses Solflare public RPC endpoint (no API key required)
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://api.mainnet-beta.solflare.network";

export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Basic known token list
const KNOWN_TOKENS: Record<string, TokenMetadata> = {
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
    name: "USD TETHER",
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

class SolanaAPI {
  private connection: Connection;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 100;

  constructor() {
    this.connection = new Connection(RPC_URL, "confirmed");
  }

  private async throttleRequest(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  async getWalletBalance(publicKey: string): Promise<number> {
    try {
      console.log(`Fetching SOL balance for ${publicKey}...`);
      await this.throttleRequest();
      const lamports = await this.connection.getBalance(
        new PublicKey(publicKey),
      );
      const solBalance = lamports / 1e9;
      console.log(`SOL Balance: ${solBalance}`);
      return solBalance;
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      throw error;
    }
  }

  async getTokenAccounts(publicKey: string) {
    try {
      console.log(`Fetching token accounts for ${publicKey}...`);
      await this.throttleRequest();

      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        new PublicKey(publicKey),
        {
          programId: new PublicKey(
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          ),
        },
        { encoding: "jsonParsed" },
      );

      console.log(`Found ${tokenAccounts.value.length} token accounts`);

      return tokenAccounts.value
        .map((account) => {
          try {
            const parsedData = account.account.data;
            if (
              typeof parsedData === "object" &&
              "parsed" in parsedData &&
              "info" in parsedData.parsed
            ) {
              const info = (parsedData.parsed as any).info;
              const mint = info.mint;
              const decimals = info.tokenAmount?.decimals || 6;
              let balance = 0;

              if (typeof info.tokenAmount?.uiAmount === "number") {
                balance = info.tokenAmount.uiAmount;
              } else if (info.tokenAmount?.amount) {
                const rawAmount = BigInt(info.tokenAmount.amount);
                balance = Number(rawAmount) / Math.pow(10, decimals);
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
            console.error("Error parsing token account:", parseError);
            return null;
          }
        })
        .filter((token) => token !== null);
    } catch (error) {
      console.error("Error fetching token accounts:", error);
      throw error;
    }
  }

  async getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
    if (KNOWN_TOKENS[mint]) {
      return KNOWN_TOKENS[mint];
    }

    try {
      await this.throttleRequest();
      const mintPublicKey = new PublicKey(mint);
      const info = await this.connection.getTokenSupply(mintPublicKey);

      return {
        mint,
        symbol: "UNKNOWN",
        name: "Unknown Token",
        decimals: info.value.decimals || 9,
      };
    } catch (error) {
      console.error(`Error fetching metadata for token ${mint}:`, error);
      return null;
    }
  }

  async getMultipleAccounts(publicKeys: string[]) {
    try {
      await this.throttleRequest();
      return await this.connection.getMultipleAccountsInfo(
        publicKeys.map((pk) => new PublicKey(pk)),
      );
    } catch (error) {
      console.error("Error fetching multiple accounts:", error);
      return [];
    }
  }

  async getAccountInfo(publicKey: string) {
    try {
      await this.throttleRequest();
      return await this.connection.getAccountInfo(new PublicKey(publicKey));
    } catch (error) {
      console.error(`Error fetching account info for ${publicKey}:`, error);
      return null;
    }
  }

  addKnownToken(metadata: TokenMetadata) {
    KNOWN_TOKENS[metadata.mint] = metadata;
  }

  getKnownTokens(): Record<string, TokenMetadata> {
    return { ...KNOWN_TOKENS };
  }

  async getSignaturesForAddress(
    publicKey: string,
    limit: number = 20,
  ): Promise<
    Array<{
      signature: string;
      blockTime: number | null;
      err: any | null;
    }>
  > {
    try {
      console.log(
        `Fetching ${limit} transaction signatures for ${publicKey}...`,
      );
      await this.throttleRequest();
      return await this.connection.getSignaturesForAddress(
        new PublicKey(publicKey),
        { limit },
      );
    } catch (error) {
      console.error("Error fetching signatures for address:", error);
      throw error;
    }
  }

  async getParsedTransaction(signature: string): Promise<any> {
    try {
      console.log(`Fetching parsed transaction: ${signature}`);
      await this.throttleRequest();
      return await this.connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
    } catch (error) {
      console.error("Error fetching parsed transaction:", error);
      return null;
    }
  }

  parseTransactionForTokenTransfers(
    tx: any,
    walletAddress: string,
  ): Array<{
    type: "send" | "receive";
    token: string;
    amount: number;
    decimals: number;
    signature: string;
    blockTime: number | null;
    mint?: string;
  }> {
    const transfers: Array<{
      type: "send" | "receive";
      token: string;
      amount: number;
      decimals: number;
      signature: string;
      blockTime: number | null;
      mint?: string;
    }> = [];

    if (!tx || !tx.transaction || !tx.transaction.message) return transfers;

    const message = tx.transaction.message;
    const blockTime = tx.blockTime;
    const signature = tx.transaction.signatures?.[0];

    if (message.instructions && Array.isArray(message.instructions)) {
      message.instructions.forEach((instr: any) => {
        if (
          instr.parsed?.type === "transfer" ||
          instr.parsed?.type === "transferChecked"
        ) {
          const info = instr.parsed.info;
          let amount = 0;
          if (info.tokenAmount) {
            if (typeof info.tokenAmount.uiAmount === "number") {
              amount = info.tokenAmount.uiAmount;
            } else if (typeof info.tokenAmount.uiAmount === "string") {
              amount = parseFloat(info.tokenAmount.uiAmount);
            } else if (info.tokenAmount.amount) {
              const decimals = info.tokenAmount.decimals || 6;
              amount =
                parseFloat(info.tokenAmount.amount) / Math.pow(10, decimals);
            }
          }
          const decimals = info.tokenAmount?.decimals || 6;
          let destination = info.destination;
          let source = info.source;

          if (typeof destination === "object" && destination?.pubkey) {
            destination = destination.pubkey;
          }
          if (typeof source === "object" && source?.pubkey) {
            source = source.pubkey;
          }

          const mint = info.mint || info.token || "UNKNOWN";

          if (destination === walletAddress) {
            transfers.push({
              type: "receive",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }

          if (source === walletAddress) {
            transfers.push({
              type: "send",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }
        }

        if (instr.program === "system" && instr.parsed?.type === "transfer") {
          const info = instr.parsed.info;
          const lamports = info.lamports || 0;
          let destination = info.destination;
          let source = info.source;

          if (typeof destination === "object" && destination?.pubkey) {
            destination = destination.pubkey;
          }
          if (typeof source === "object" && source?.pubkey) {
            source = source.pubkey;
          }

          const amount = lamports / Math.pow(10, 9);
          const decimals = 9;
          const mint = "So11111111111111111111111111111111111111112";

          if (destination === walletAddress) {
            transfers.push({
              type: "receive",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }

          if (source === walletAddress) {
            transfers.push({
              type: "send",
              token: mint,
              amount: Number.isFinite(amount) ? amount : 0,
              decimals,
              signature: signature || "",
              blockTime,
              mint,
            });
          }
        }
      });
    }

    return transfers;
  }

  async getTokenBalanceForMint(
    walletAddress: string,
    tokenMint: string,
  ): Promise<number | null> {
    try {
      await this.throttleRequest();
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        new PublicKey(walletAddress),
        { mint: new PublicKey(tokenMint) },
        { encoding: "jsonParsed" },
      );

      if (tokenAccounts.value.length > 0) {
        const account = tokenAccounts.value[0];
        const parsedData = account.account.data;
        if (
          typeof parsedData === "object" &&
          "parsed" in parsedData &&
          "info" in parsedData.parsed
        ) {
          const info = (parsedData.parsed as any).info;
          const decimals = info.tokenAmount?.decimals || 6;
          let balance = 0;

          if (typeof info.tokenAmount?.uiAmount === "number") {
            balance = info.tokenAmount.uiAmount;
          } else if (info.tokenAmount?.amount) {
            const rawAmount = BigInt(info.tokenAmount.amount);
            balance = Number(rawAmount) / Math.pow(10, decimals);
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
  }
}

export const heliusAPI = new SolanaAPI();
export { SolanaAPI };
