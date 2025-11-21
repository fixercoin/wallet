import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { SOLANA_RPC_URL } from "../../utils/solanaConfig";

export {
  type WalletData,
  type TokenInfo,
  DEFAULT_TOKENS,
  generateWallet,
  recoverWallet,
  getBalance,
  getTokenAccounts,
  shortenAddress,
  copyToClipboard,
} from "./wallet-proxy";

// Lazily create a single shared Connection instance
let _connection: Connection | null = null;
export const connection: Connection = (() => {
  try {
    if (!_connection) {
      _connection = new Connection(SOLANA_RPC_URL, {
        commitment: "confirmed",
      });
    }
    return _connection;
  } catch {
    // In environments where web3 isn't available, this will be set later by context
    return _connection as any as Connection;
  }
})();

export function importWalletFromPrivateKey(input: string) {
  // Accept base58 or JSON array of numbers
  let secretKey: Uint8Array;
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith("[")) {
      const arr = JSON.parse(trimmed);
      secretKey = Uint8Array.from(arr);
    } else {
      secretKey = bs58.decode(trimmed);
    }
    const kp = Keypair.fromSecretKey(secretKey);
    return {
      publicKey: kp.publicKey.toString(),
      secretKey: kp.secretKey,
    };
  } catch (e) {
    throw new Error(
      "Invalid private key. Provide a base58 string or a JSON array of bytes.",
    );
  }
}
