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

/** Curator wallet for the Explore page's "Curated" tab. Only vaults whose
 *  VaultCreated tx was sent by this address (derived on-chain from logs, see
 *  useVaultCreators) appear under curated. Until v2.0.0 ships on-chain
 *  endorsement registries, this constant IS the curation policy. */
export const CURATOR_ADDRESS = "0x0B172a4E265AcF4c2E0aB238F63A44bf29bBd158" as `0x${string}`;

/** Block where the v1.2.2 factory was deployed on Base Sepolia — origin for
 *  global event scans (dividends distributed, etc.). From deployments.json
 *  DHPFactory.txHash receipt. */
export const FACTORY_DEPLOY_BLOCK = 46_504_082;

export function isTestnet(chainId: number) {
  return chainId === BASE_SEPOLIA_ID;
}
