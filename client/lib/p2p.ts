export const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

export type P2PPost = {
  id: string;
  type: "buy" | "sell";
  token: string;
  pricePkr: number;
  pricePerUSDC?: number | null;
  pricePerSOL?: number | null;
  minToken: number;
  maxToken: number;
  paymentMethod: string;
  walletAddress?: string;
  paymentDetails?: {
    accountName: string;
    accountNumber: string;
  };
  createdAt: number;
  updatedAt: number;
};
