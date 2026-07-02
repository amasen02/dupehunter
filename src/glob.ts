const WILDCARD_PATTERN = /[*?]/;

function wildcardToRegExp(pattern: string): RegExp {
  let source = "";
  for (const char of pattern) {
    if (char === "*") {
      source += ".*";
    } else if (char === "?") {
      source += ".";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "i");
}

const compiledPatternCache = new Map<string, RegExp>();

function compilePattern(pattern: string): RegExp {
  const cached = compiledPatternCache.get(pattern);
  if (cached) {
    return cached;
  }
  const compiled = wildcardToRegExp(pattern);
  compiledPatternCache.set(pattern, compiled);
  return compiled;
}

/** Matches a single path segment (file or directory name) against simple `*`/`?` wildcard patterns. */
export function matchesAnyPattern(segment: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    if (!WILDCARD_PATTERN.test(pattern)) {
      return segment.toLowerCase() === pattern.toLowerCase();
    }
    return compilePattern(pattern).test(segment);
  });
}
