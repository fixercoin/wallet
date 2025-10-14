import type { FixoriumWalletProvider } from "./lib/fixorium-provider";

interface ImportMetaEnv {
  readonly VITE_MORALIS_API_KEY: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    solana?:
      | (FixoriumWalletProvider & {
          providers?: FixoriumWalletProvider[];
          isPhantom?: boolean;
          isSolflare?: boolean;
        })
      | undefined;
    fixorium?: FixoriumWalletProvider;
  }
}

export {};
