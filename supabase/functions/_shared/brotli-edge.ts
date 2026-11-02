// Use Deno's native decoder; the browser JS Brotli decoder exceeds Edge memory.
import { brotliDecompressSync } from "node:zlib";
export default function decodeBrotli(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(brotliDecompressSync(bytes));
}
