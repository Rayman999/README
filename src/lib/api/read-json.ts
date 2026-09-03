// Bound the actual stream, not just Content-Length (which can be absent or
// false). A document's own stricter 256 KiB limit is enforced by its schema.
export async function readJson(req: Request, limit = 320 * 1024): Promise<unknown> {
  return JSON.parse(await readText(req, limit));
}

export async function readText(req: Request, limit: number): Promise<string> {
  if (!req.body) throw new Error("Expected a JSON request body.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error(`Request exceeds the ${limit / 1024} KiB limit.`);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
