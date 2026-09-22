import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const PDFJS_VERSION = "6.3.289";
const ASSET_TYPES: Record<string, RegExp> = {
  cmaps: /^[A-Za-z0-9_-]+\.bcmap$/,
  standard_fonts: /^[A-Za-z0-9_-]+\.(?:ttf|pfb)$/,
  wasm: /^[A-Za-z0-9_-]+\.(?:wasm|js)$/,
};

// Serve the pinned PDF renderer's public fonts/codecs locally. No document
// contents leave the browser during conversion, including legacy Korean PDFs.
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const [version, kind, filename] = parts;
  if (parts.length !== 3 || version !== PDFJS_VERSION || !Object.hasOwn(ASSET_TYPES, kind) || !ASSET_TYPES[kind].test(filename)) return new NextResponse(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), "node_modules/pdfjs-dist", kind, filename));
    return new NextResponse(bytes, { headers: {
      "Content-Type": filename.endsWith(".wasm") ? "application/wasm" : filename.endsWith(".js") ? "text/javascript" : "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new NextResponse(null, { status: 404 }); }
}
