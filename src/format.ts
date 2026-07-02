const BYTES_PER_UNIT = 1024;
const SIZE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_UNIT) {
    return `${bytes} B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
    SIZE_UNITS.length - 1,
  );
  const value = bytes / BYTES_PER_UNIT ** exponent;
  const unit = SIZE_UNITS[exponent] ?? "B";
  const decimalPlaces = Number.isInteger(value) || value >= 10 ? 0 : 1;
  return `${value.toFixed(decimalPlaces)} ${unit}`;
}

interface AnsiCodes {
  readonly bold: string;
  readonly dim: string;
  readonly red: string;
  readonly green: string;
  readonly yellow: string;
  readonly cyan: string;
  readonly reset: string;
}

const ANSI_ESCAPE = "";

const ANSI: AnsiCodes = {
  bold: `${ANSI_ESCAPE}[1m`,
  dim: `${ANSI_ESCAPE}[2m`,
  red: `${ANSI_ESCAPE}[31m`,
  green: `${ANSI_ESCAPE}[32m`,
  yellow: `${ANSI_ESCAPE}[33m`,
  cyan: `${ANSI_ESCAPE}[36m`,
  reset: `${ANSI_ESCAPE}[0m`,
};

const NO_ANSI: AnsiCodes = {
  bold: "",
  dim: "",
  red: "",
  green: "",
  yellow: "",
  cyan: "",
  reset: "",
};

export function colorsEnabled(stream: NodeJS.WriteStream, env: NodeJS.ProcessEnv): boolean {
  if (env.NO_COLOR !== undefined) {
    return false;
  }
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") {
    return true;
  }
  return stream.isTTY;
}

export function createColors(enabled: boolean): AnsiCodes {
  return enabled ? ANSI : NO_ANSI;
}
