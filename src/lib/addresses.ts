// Single source of truth for contract addresses.
// RULE: mainnet addresses stay empty until the external audit clears.
// Sepolia slots = Spock's v1.2.2 redeploy (dhp commit 2e28f99, deployments.json).
// FEE_COLLECTOR is informational only — fees are pulled by the factory, the app
// never calls it directly.

export const BASE_SEPOLIA_ID = 84532;
export const BASE_MAINNET_ID = 845;

export const IMPLEMENTATION: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_ID]: "0xaa5a3a495dadbeb4c5256c0e62ae0603d53f714b",
  [BASE_MAINNET_ID]: "0x0000000000000000000000000000000000000000", // post-audit only
};

export const FACTORY: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_ID]: "0xf98a8db0b6a2be70e259992be11c252dbeccaa4d",
  [BASE_MAINNET_ID]: "0x0000000000000000000000000000000000000000", // post-audit only
};

export const FEE_COLLECTOR: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_ID]: "0xc6071346a5bb93bf1cc915124050004a268c4d37",
  [BASE_MAINNET_ID]: "0x0000000000000000000000000000000000000000",
};

export const CREATION_FEE_ETH = "0.001";

export function isTestnet(chainId: number) {
  return chainId === BASE_SEPOLIA_ID;
}
