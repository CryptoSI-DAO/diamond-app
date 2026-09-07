// Single source of truth for contract addresses.
// RULE: mainnet addresses stay empty until the external audit clears.
// Spock's v1.2.2 redeploy (commit 911d7fb) fills the Sepolia slots.

export const BASE_SEPOLIA_ID = 84532;
export const BASE_MAINNET_ID = 845;

export const FACTORY: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_ID]: "0x0000000000000000000000000000000000000000", // TODO: Spock v1.2.2 redeploy
  [BASE_MAINNET_ID]: "0x0000000000000000000000000000000000000000", // post-audit only
};

export const FEE_COLLECTOR: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_ID]: "0x0000000000000000000000000000000000000000", // TODO
  [BASE_MAINNET_ID]: "0x0000000000000000000000000000000000000000",
};

export const CREATION_FEE_ETH = "0.001";

export function isTestnet(chainId: number) {
  return chainId === BASE_SEPOLIA_ID;
}
