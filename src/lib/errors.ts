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
  const raw = String(err);

  // Wallet re-estimated gas via its own custom RPC and signed an oversized
  // limit; the public endpoint rejects it before it ever reaches the vault.
  if (raw.includes("max transaction gas limit") || raw.includes("exceeds max")) {
    return (
      "Your wallet signed this with a broken gas limit from its own network " +
      "settings, and the RPC rejected it. Fix in your wallet: edit the Base " +
      "Sepolia network → set RPC URL to https://sepolia.base.org and remove any " +
      "custom gas limit — or delete the network here and re-add it via the " +
      "network pill (top right), which uses the correct defaults."
    );
  }

  for (const key of Object.keys(ERROR_COPY)) {
    if (name.includes(key) || raw.includes(key)) return ERROR_COPY[key];
  }
  return (err as { shortMessage?: string })?.shortMessage ?? "Transaction failed.";
}
