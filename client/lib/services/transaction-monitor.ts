import { Connection, PublicKey, ConfirmedSignatureInfo } from "@solana/web3.js";
import { connection } from "../wallet";

export interface TransactionNotification {
  signature: string;
  type: "incoming" | "outgoing";
  amount?: number;
  token?: string;
  from?: string;
  to?: string;
  timestamp: number;
}

export interface TransactionMonitorOptions {
  onTransaction?: (notification: TransactionNotification) => void;
  pollInterval?: number; // milliseconds
}

class TransactionMonitor {
  private isMonitoring = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastSignature: string | null = null;
  private walletAddress: string | null = null;
  private options: TransactionMonitorOptions = {};

  /**
   * Start monitoring transactions for a wallet address
   */
  public startMonitoring(
    walletAddress: string,
    options: TransactionMonitorOptions = {},
  ): void {
    if (this.isMonitoring && this.walletAddress === walletAddress) {
      console.log("Transaction monitoring already active for this wallet");
      return;
    }

    this.stopMonitoring(); // Stop any existing monitoring

    this.walletAddress = walletAddress;
    this.options = {
      pollInterval: 15000, // Default 15 seconds
      ...options,
    };

    this.isMonitoring = true;
    console.log(`Starting transaction monitoring for wallet: ${walletAddress}`);

    // Initial check
    this.checkForNewTransactions();

    // Setup periodic checking
    this.intervalId = setInterval(() => {
      this.checkForNewTransactions();
    }, this.options.pollInterval);
  }

  /**
   * Stop monitoring transactions
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isMonitoring = false;
    this.walletAddress = null;
    this.lastSignature = null;
    console.log("Transaction monitoring stopped");
  }

  /**
   * Check for new transactions
   */
  private async checkForNewTransactions(): Promise<void> {
    if (!this.walletAddress || !this.isMonitoring) return;

    try {
      const publicKey = new PublicKey(this.walletAddress);

      // Get recent transaction signatures
      const signatures = await connection.getSignaturesForAddress(
        publicKey,
        { limit: 10 },
        "confirmed",
      );

      if (signatures.length === 0) {
        console.log("No transactions found for wallet");
        return;
      }

      // If this is the first check, just set the last signature
      if (!this.lastSignature) {
        this.lastSignature = signatures[0].signature;
        console.log("Initial transaction check completed");
        return;
      }

      // Find new transactions since last check
      const newTransactions: ConfirmedSignatureInfo[] = [];
      for (const sig of signatures) {
        if (sig.signature === this.lastSignature) {
          break;
        }
        newTransactions.push(sig);
      }

      if (newTransactions.length > 0) {
        console.log(`Found ${newTransactions.length} new transactions`);
        this.lastSignature = signatures[0].signature;

        // Process each new transaction
        for (const txSig of newTransactions) {
          await this.processTransaction(txSig);
        }
      }
    } catch (error) {
      console.error("Error checking for new transactions:", error);
    }
  }

  /**
   * Process a transaction and determine if it's incoming/outgoing
   */
  private async processTransaction(
    txSig: ConfirmedSignatureInfo,
  ): Promise<void> {
    try {
      // Get detailed transaction info
      const transaction = await connection.getParsedTransaction(
        txSig.signature,
        { commitment: "confirmed" },
      );

      if (!transaction || !this.walletAddress) return;

      const walletPubkey = new PublicKey(this.walletAddress);

      // Check if this is an incoming or outgoing transaction
      const isIncoming = this.isIncomingTransaction(transaction, walletPubkey);
      const isOutgoing = this.isOutgoingTransaction(transaction, walletPubkey);

      if (isIncoming || isOutgoing) {
        const notification: TransactionNotification = {
          signature: txSig.signature,
          type: isIncoming ? "incoming" : "outgoing",
          timestamp: (txSig.blockTime || Date.now() / 1000) * 1000,
        };

        // Try to extract more details about the transaction
        this.enrichTransactionNotification(
          transaction,
          notification,
          walletPubkey,
        );

        console.log("Transaction notification:", notification);

        // Call the callback if provided
        if (this.options.onTransaction) {
          this.options.onTransaction(notification);
        }
      }
    } catch (error) {
      console.error("Error processing transaction:", error);
    }
  }

  /**
   * Check if transaction is incoming to the wallet
   */
  private isIncomingTransaction(
    transaction: any,
    walletPubkey: PublicKey,
  ): boolean {
    if (!transaction.meta || !transaction.transaction) return false;

    // Check post balances vs pre balances
    const accountKeys = transaction.transaction.message.accountKeys;
    const walletIndex = accountKeys.findIndex((key: any) =>
      key.pubkey.equals(walletPubkey),
    );

    if (walletIndex === -1) return false;

    const preBalance = transaction.meta.preBalances[walletIndex];
    const postBalance = transaction.meta.postBalances[walletIndex];

    // If balance increased, it's likely an incoming transaction
    return postBalance > preBalance;
  }

  /**
   * Check if transaction is outgoing from the wallet
   */
  private isOutgoingTransaction(
    transaction: any,
    walletPubkey: PublicKey,
  ): boolean {
    if (!transaction.meta || !transaction.transaction) return false;

    // Check if wallet is the fee payer (usually means outgoing)
    const feePayer = transaction.transaction.message.accountKeys[0];
    return feePayer.pubkey.equals(walletPubkey);
  }

  /**
   * Add more details to the transaction notification
   */
  private enrichTransactionNotification(
    transaction: any,
    notification: TransactionNotification,
    walletPubkey: PublicKey,
  ): void {
    try {
      // Try to extract amount and token info
      if (
        transaction.meta?.postTokenBalances &&
        transaction.meta?.preTokenBalances
      ) {
        // Token transfer
        const preTokenBalances = transaction.meta.preTokenBalances;
        const postTokenBalances = transaction.meta.postTokenBalances;

        for (const postBalance of postTokenBalances) {
          if (postBalance.owner === walletPubkey.toString()) {
            const preBalance = preTokenBalances.find(
              (pre: any) => pre.accountIndex === postBalance.accountIndex,
            );

            const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
            const postAmount = postBalance.uiTokenAmount?.uiAmount || 0;
            const difference = postAmount - preAmount;

            if (Math.abs(difference) > 0) {
              notification.amount = Math.abs(difference);
              notification.token =
                postBalance.uiTokenAmount?.uiAmountString || "Unknown";
            }
          }
        }
      } else {
        // SOL transfer
        const accountKeys = transaction.transaction.message.accountKeys;
        const walletIndex = accountKeys.findIndex((key: any) =>
          key.pubkey.equals(walletPubkey),
        );

        if (walletIndex !== -1) {
          const preBalance = transaction.meta.preBalances[walletIndex];
          const postBalance = transaction.meta.postBalances[walletIndex];
          if (
            typeof preBalance === "number" &&
            typeof postBalance === "number"
          ) {
            const difference = (postBalance - preBalance) / 1e9; // Convert lamports to SOL
            if (Number.isFinite(difference) && Math.abs(difference) > 0) {
              notification.amount = Math.abs(difference);
              notification.token = "SOL";
            }
          }
        }
      }
    } catch (error) {
      console.error("Error enriching transaction notification:", error);
    }
  }

  /**
   * Get current monitoring status
   */
  public getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      walletAddress: this.walletAddress,
      lastSignature: this.lastSignature,
      pollInterval: this.options.pollInterval,
    };
  }
}

// Export singleton instance
export const transactionMonitor = new TransactionMonitor();
