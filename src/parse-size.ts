const UNIT_MULTIPLIERS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i;

/**
 * Parses a human-friendly size like "10kb", "1.5MB", or a bare byte count
 * like "2048" into a whole number of bytes.
 */
export function parseSize(input: string): number {
  const match = SIZE_PATTERN.exec(input.trim());
  if (!match) {
    throw new Error(`invalid size "${input}" (expected e.g. "512", "10KB", "1.5MB")`);
  }

  const [, magnitude, unit] = match;
  if (magnitude === undefined) {
    throw new Error(`invalid size "${input}" (expected e.g. "512", "10KB", "1.5MB")`);
  }
  const multiplier = UNIT_MULTIPLIERS[(unit ?? "b").toLowerCase()] ?? 1;
  return Math.round(Number.parseFloat(magnitude) * multiplier);
}
