import { Buffer } from "buffer";
import process from "process";

// Ensure Node-like globals for browser bundles that expect them
// Must run BEFORE any other imports that might use Buffer/process
if (typeof window !== "undefined") {
  (window as any).global = globalThis as any;
  (window as any).Buffer = Buffer;
  (window as any).process = process;
}
