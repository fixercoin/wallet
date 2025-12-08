/**
 * Reward Configuration
 * Used across all staking functions
 */

export const REWARD_CONFIG = {
  // Vault wallet that holds staked tokens
  vaultWallet: "5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU",

  // Wallet address that pays out staking rewards
  rewardWallet: "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",

  // APY percentage for staking rewards
  apyPercentage: 10,

  // Reward token mint address (FIXERCOIN)
  rewardTokenMint: "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",

  // KV namespace bindings
  kvNamespace: "STAKING_KV",
};

export interface Stake {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: number;
  stakePeriodDays: number;
  startTime: number;
  endTime: number;
  rewardAmount: number;
  status: "active" | "completed" | "withdrawn";
  withdrawnAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RewardDistribution {
  id: string;
  stakeId: string;
  walletAddress: string;
  rewardAmount: number;
  tokenMint: string;
  status: "pending" | "processed" | "ready_for_distribution";
  txHash?: string;
  createdAt: number;
  processedAt?: number;
}

export function calculateReward(amount: number, periodDays: number): number {
  // 10% APY
  const yearlyReward = amount * (REWARD_CONFIG.apyPercentage / 100);
  const dailyRate = yearlyReward / 365;
  return dailyRate * periodDays;
}

export function generateStakeId(): string {
  return `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
