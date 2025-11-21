import { SOLANA_RPC_URL } from "../../utils/solanaConfig";
import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import type { WalletData } from "@/lib/wallet-proxy";

export type FixoriumProviderEvent =
  | "connect"
  | "disconnect"
  | "accountChanged"
  | "error";

export interface FixoriumRequest {
  method: string;
  params?: unknown[];
}

const ICON_URL =
  "https://cdn.builder.io/api/v1/image/assets%2F3a15ce16386647f69de330d7428809d3%2F91b2877faec14ea19595368b705b1709?format=webp&width=128";

const DEFAULT_COMMITMENT: SendOptions["preflightCommitment"] = "confirmed";

const encoder = new TextEncoder();

export class FixoriumWalletProvider {
  readonly isFixorium = true;
  readonly name = "Fixorium Wallet";
  readonly icon = ICON_URL;
  readonly url = "https://wallet.fixorium.com.pk";
  readonly version = "1.0.0";
  autoApprove = false;

  private wallet: WalletData | null = null;
  private publicKeyCache: PublicKey | null = null;
  private connected = false;
  private defaultConnection: Connection | null = null;
  private readonly listeners = new Map<
    FixoriumProviderEvent,
    Set<(...args: any[]) => void>
  >();
  private initializedEventDispatched = false;

  get publicKey(): PublicKey | null {
    return this.publicKeyCache;
  }

  get isConnected(): boolean {
    return this.connected && !!this.wallet;
  }

  setDefaultConnection(connection: Connection | null) {
    this.defaultConnection = connection;
  }

  setWallet(nextWallet: WalletData | null) {
    const previousKey = this.publicKeyCache?.toBase58() ?? null;

    this.wallet = nextWallet;
    this.publicKeyCache = nextWallet
      ? new PublicKey(nextWallet.publicKey)
      : null;

    if (!nextWallet) {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected) {
        this.emit("disconnect");
      }
      this.emit("accountChanged", null);
      return;
    }

    if (previousKey && previousKey !== nextWallet.publicKey && this.connected) {
      this.emit("accountChanged", this.publicKeyCache);
    }
  }

  dispatchInitializedOnce(windowObj: Window & typeof globalThis) {
    if (this.initializedEventDispatched) return;
    this.initializedEventDispatched = true;
    windowObj.dispatchEvent(new Event("solana#initialized"));
  }

  async connect(options?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey: PublicKey }> {
    if (!this.wallet || !this.publicKeyCache) {
      throw new Error(
        "No Fixorium wallet is available. Please create or import a wallet first.",
      );
    }

    if (options?.onlyIfTrusted && !this.connected) {
      throw new Error("Fixorium wallet is not trusted yet.");
    }

    if (!this.connected) {
      this.connected = true;
      this.emit("connect", this.publicKeyCache);
    }

    return { publicKey: this.publicKeyCache };
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> {
    this.assertReady();
    const keypair = this.getKeypair();

    if ("version" in transaction) {
      (transaction as VersionedTransaction).sign([keypair]);
      return transaction;
    }

    (transaction as Transaction).partialSign(keypair);
    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ): Promise<T[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array | string): Promise<Uint8Array> {
    this.assertReady();
    const payload =
      typeof message === "string" ? encoder.encode(message) : message;
    const signature = nacl.sign.detached(payload, this.wallet!.secretKey);
    return signature;
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection?: Connection,
    options?: SendOptions,
  ): Promise<TransactionSignature> {
    const signed = await this.signTransaction(transaction);
    const resolvedConnection = connection ?? this.ensureConnection();
    const serialized =
      "version" in signed
        ? (signed as VersionedTransaction).serialize()
        : (signed as Transaction).serialize({ requireAllSignatures: false });

    return resolvedConnection.sendRawTransaction(serialized, {
      skipPreflight: options?.skipPreflight ?? false,
      preflightCommitment: options?.preflightCommitment ?? DEFAULT_COMMITMENT,
      maxRetries: options?.maxRetries,
      minContextSlot: options?.minContextSlot,
    });
  }

  async request(args: FixoriumRequest): Promise<unknown> {
    const params = args.params ?? [];
    switch (args.method) {
      case "connect":
        return this.connect(
          params[0] as { onlyIfTrusted?: boolean } | undefined,
        );
      case "disconnect":
        return this.disconnect();
      case "signTransaction":
        return this.signTransaction(
          params[0] as Transaction | VersionedTransaction,
        );
      case "signAllTransactions":
        return this.signAllTransactions(
          (params[0] as (Transaction | VersionedTransaction)[]) ?? [],
        );
      case "signMessage":
        return this.signMessage(params[0] as Uint8Array | string);
      case "sendTransaction":
        return this.sendTransaction(
          params[0] as Transaction | VersionedTransaction,
          params[1] as Connection | undefined,
          params[2] as SendOptions | undefined,
        );
      default:
        throw new Error(
          `Unsupported Fixorium wallet request method: ${args.method}`,
        );
    }
  }

  on(event: FixoriumProviderEvent, handler: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return this;
  }

  once(event: FixoriumProviderEvent, handler: (...args: any[]) => void): this {
    const onceHandler = (...args: any[]) => {
      this.off(event, onceHandler);
      handler(...args);
    };
    return this.on(event, onceHandler);
  }

  off(event: FixoriumProviderEvent, handler: (...args: any[]) => void): this {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  addListener(
    event: FixoriumProviderEvent,
    handler: (...args: any[]) => void,
  ): this {
    return this.on(event, handler);
  }

  removeListener(
    event: FixoriumProviderEvent,
    handler: (...args: any[]) => void,
  ): this {
    return this.off(event, handler);
  }

  removeAllListeners(event?: FixoriumProviderEvent): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenersFor(event: FixoriumProviderEvent): ((...args: any[]) => void)[] {
    return Array.from(this.listeners.get(event) ?? []);
  }

  private emit(event: FixoriumProviderEvent, ...args: any[]) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        if (event !== "error") {
          this.emit(
            "error",
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    });
  }

  private ensureConnection(): Connection {
    if (this.defaultConnection) return this.defaultConnection;
    this.defaultConnection = new Connection(SOLANA_RPC_URL, {
      commitment: DEFAULT_COMMITMENT,
    });
    return this.defaultConnection;
  }

  private getKeypair(): Keypair {
    if (!this.wallet) {
      throw new Error("Fixorium wallet is not available.");
    }
    return Keypair.fromSecretKey(this.wallet.secretKey);
  }

  private assertReady(): void {
    if (!this.wallet || !this.publicKeyCache) {
      throw new Error("Fixorium wallet is not ready. Connect a wallet first.");
    }
    if (!this.connected) {
      throw new Error(
        "Fixorium wallet is not connected. Call connect() before signing.",
      );
    }
  }
}

let providerInstance: FixoriumWalletProvider | null = null;

export const ensureFixoriumProvider = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (providerInstance) {
    providerInstance.dispatchInitializedOnce(window);
    return providerInstance;
  }

  providerInstance = new FixoriumWalletProvider();

  const win = window as unknown as {
    solana?: any;
    fixorium?: FixoriumWalletProvider;
  } & Window;

  const existing = win.solana;
  if (!existing) {
    win.solana = providerInstance;
  } else if (existing && typeof existing === "object") {
    if (Array.isArray(existing.providers)) {
      if (!existing.providers.includes(providerInstance)) {
        existing.providers.push(providerInstance);
      }
    } else {
      const uniqueProviders = new Set<unknown>();
      uniqueProviders.add(existing);
      uniqueProviders.add(providerInstance);
      existing.providers = Array.from(uniqueProviders);
    }
  } else {
    win.solana = providerInstance;
  }

  win.fixorium = providerInstance;
  providerInstance.dispatchInitializedOnce(window);

  return providerInstance;
};
