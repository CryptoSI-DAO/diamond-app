// Shared number formatting for chain data. No USD, no APY — honest units only.

export function fmtUnits(n: bigint, decimals: number, maxFrac = 4): string {
  if (decimals === 0) return n.toLocaleString();
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = (n % base).toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  return `${whole.toLocaleString()}${frac ? "." + frac : ""}`;
}

export function fmtPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function parseUnits(s: string, decimals: number): bigint {
  if (!s || isNaN(Number(s))) return 0n;
  const [w, f = ""] = s.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}
