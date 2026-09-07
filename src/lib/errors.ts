// Custom-error → human copy. Keep in sync with vaultAbi errors + STITCH_PROMPTS.md screen 4.
export const ERROR_COPY: Record<string, string> = {
  FeeOnTransferToken: "This token taxes transfers — the vault rejected it.",
  BelowMinimumFirstDeposit: "Fresh vaults need a first deposit of at least 1.0 tokens.",
  InsufficientClaimAmount: "Claim would land below your slippage floor. Raise the minimum or wait.",
  DegenerateVaultState: "This vault is in a halted state — pricing paused for safety.",
  ZeroAmount: "Amount must be greater than zero.",
  ZeroAddress: "Invalid recipient.",
  OnlyFactory: "Only the factory can call this.",
};

export function errorToCopy(err: unknown): string {
  const name =
    (err as { name?: string })?.name ??
    String((err as { shortMessage?: string })?.shortMessage ?? "");
  for (const key of Object.keys(ERROR_COPY)) {
    if (name.includes(key) || String(err).includes(key)) return ERROR_COPY[key];
  }
  return (err as { shortMessage?: string })?.shortMessage ?? "Transaction failed.";
}
