// FIXERCOIN token information and configuration
export const FIXERCOIN_TOKEN_INFO = {
  name: "FIXERCOIN",
  symbol: "FIXERCOIN",
  decimals: 6,
  network: "solana",
  logo: "https://i.postimg.cc/htfMF9dD/6x2D7UQ.png",
  liquidityPool: "swap.pump.fun",
  mintAddress: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  tradePair: "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
  metadataUrl:
    "https://solana-gateway.moralis.io/token/mainnet/H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
} as const;

// Helper functions for FIXERCOIN
export const getFixercoinMintAddress = () => FIXERCOIN_TOKEN_INFO.mintAddress;
export const getFixercoinInfo = () => FIXERCOIN_TOKEN_INFO;
