// Minimal ABIs — only the surface the app touches, matching contracts @ 911d7fb.
// Custom errors included so viem can decode reverts into typed names.

export const factoryAbi = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      {
        name: "cfg",
        type: "tuple",
        components: [
          { name: "entryTaxBps", type: "uint16" },
          { name: "exitTaxBps", type: "uint16" },
          { name: "dividendShareBps", type: "uint16" },
          { name: "acceptFeesFromTransfer", type: "bool" },
        ],
      },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  { type: "function", name: "vaultCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allVaultsAt", stateMutability: "view", inputs: [{ name: "i", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "event", name: "VaultCreated", inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "entryTaxBps", type: "uint16", indexed: false },
      { name: "exitTaxBps", type: "uint16", indexed: false },
      { name: "dividendShareBps", type: "uint16", indexed: false },
  ] },
] as const;

export const vaultAbi = [
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalBurned", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalDividendsDistributed", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "entryTaxBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "exitTaxBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "dividendShareBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "acceptFeesFromTransfer", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "rewards", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewDeposit", stateMutability: "view", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewRedeem", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewWithdraw", stateMutability: "view", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "previewMint", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "shares", type: "uint256" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ name: "assets", type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "shares", type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "assets", type: "uint256" }] },
  { type: "function", name: "claimDividend", stateMutability: "nonpayable", inputs: [{ name: "minAmountOut", type: "uint256" }], outputs: [{ name: "amount", type: "uint256" }] },
  { type: "event", name: "Deposit", inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
  ] },
  { type: "event", name: "Withdraw", inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
  ] },
  { type: "event", name: "DividendClaimed", inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
  ] },
  { type: "event", name: "TaxCollected", inputs: [
      { name: "kind", type: "uint8", indexed: false },
      { name: "gross", type: "uint256", indexed: false },
      { name: "dividends", type: "uint256", indexed: false },
      { name: "burned", type: "uint256", indexed: false },
      { name: "protocolFee", type: "uint256", indexed: false },
  ] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "FeeOnTransferToken", inputs: [] },
  { type: "error", name: "BelowMinimumFirstDeposit", inputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "error", name: "InsufficientClaimAmount", inputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "error", name: "DegenerateVaultState", inputs: [] },
  { type: "error", name: "OnlyFactory", inputs: [] },
] as const;

export const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
