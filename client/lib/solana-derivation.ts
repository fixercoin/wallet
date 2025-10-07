import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";

const HARDENED_OFFSET = 0x80000000;
const MASTER_SECRET = new TextEncoder().encode("ed25519 seed");

const toBigEndian = (value: number): Uint8Array => {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, value, false);
  return new Uint8Array(buffer);
};

const concat = (...arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  arrays.forEach((arr) => {
    result.set(arr, offset);
    offset += arr.length;
  });

  return result;
};

const deriveMasterKey = (seed: Uint8Array) => {
  const i64 = hmac.create(sha512, MASTER_SECRET).update(seed).digest();
  return {
    key: i64.slice(0, 32),
    chainCode: i64.slice(32),
  };
};

const parsePath = (path: string): number[] => {
  if (!path.startsWith("m")) {
    throw new Error("Invalid derivation path");
  }

  return path
    .split("/")
    .slice(1)
    .filter(Boolean)
    .map((segment) => {
      const hardened = segment.endsWith("'");
      const index = Number.parseInt(segment.replace("'", ""), 10);

      if (Number.isNaN(index)) {
        throw new Error(`Invalid path segment: ${segment}`);
      }

      return hardened ? index + HARDENED_OFFSET : index;
    });
};

export const deriveEd25519Path = (
  path: string,
  seed: Uint8Array,
): Uint8Array => {
  const segments = parsePath(path);
  let { key, chainCode } = deriveMasterKey(seed);

  segments.forEach((segment) => {
    const data = concat(new Uint8Array([0]), key, toBigEndian(segment));
    const digest = hmac.create(sha512, chainCode).update(data).digest();
    key = digest.slice(0, 32);
    chainCode = digest.slice(32);
  });

  return key;
};
