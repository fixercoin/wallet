import { useState, useEffect } from "react";

const STAKING_TOKENS_STORAGE_PREFIX = "staking_tokens_";

/**
 * Hook to manage which tokens are marked as staking
 * Persists preferences in localStorage per wallet
 */
export function useStakingTokens(walletPublicKey: string | null) {
  const [stakingTokens, setStakingTokens] = useState<Set<string>>(new Set());

  const storageKey = walletPublicKey
    ? `${STAKING_TOKENS_STORAGE_PREFIX}${walletPublicKey}`
    : null;

  // Load staking tokens from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          setStakingTokens(new Set(arr));
        }
      }
    } catch (e) {
      console.warn("Failed to load staking tokens preference:", e);
    }
  }, [storageKey]);

  // Persist to localStorage whenever stakingTokens changes
  const updateStakingTokens = (tokens: Set<string>) => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(tokens)));
      setStakingTokens(tokens);
    } catch (e) {
      console.warn("Failed to save staking tokens preference:", e);
    }
  };

  const toggleStakingToken = (tokenMint: string) => {
    const updated = new Set(stakingTokens);
    if (updated.has(tokenMint)) {
      updated.delete(tokenMint);
    } else {
      updated.add(tokenMint);
    }
    updateStakingTokens(updated);
  };

  const isStaking = (tokenMint: string) => stakingTokens.has(tokenMint);

  return {
    stakingTokens,
    toggleStakingToken,
    isStaking,
    updateStakingTokens,
  };
}
