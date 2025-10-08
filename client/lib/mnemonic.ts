import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

const WORD_COUNT_OPTIONS = new Set([12, 24]);

export const normalizeMnemonicInput = (input: string): string => {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .trim()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .join(" ");
};

export const assertValidMnemonic = (input: string): string => {
  const normalized = normalizeMnemonicInput(input);
  const wordCount = normalized ? normalized.split(" ").length : 0;

  if (!WORD_COUNT_OPTIONS.has(wordCount)) {
    throw new Error("Recovery phrase must contain 12 or 24 valid words.");
  }

  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error("Invalid recovery phrase. Check for typos and try again.");
  }

  return normalized;
};
