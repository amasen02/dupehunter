import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export const HASH_ALGORITHM = "sha256";

/** Computes a streaming hash of a file's full contents without loading it into memory. */
export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash(HASH_ALGORITHM);
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}
