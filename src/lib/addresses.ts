// Single source of truth for contract addresses.
// RULE: mainnet addresses stay empty until the external audit clears.
//
// Versioned registry: the app talks to ONE deployment at a time, chosen by
// the user via the footer toggle (see lib/version.tsx). v1.3.0 is the
// default; v1.2.2 is legacy — it predates the unclaimed-IOU backing fix
// (dhp #26) and is kept only for comparison on testnet.
//
// FEE_COLLECTOR is informational only — fees are pulled by the factory, the
// app never calls it directly.

export const BASE_SEPOLIA_ID = 84532;
export const BASE_MAINNET_ID = 845;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export type ProtocolVersion = "v1.3.0" | "v1.2.2";

export const PROTOCOL_VERSIONS: ProtocolVersion[] = ["v1.3.0", "v1.2.2"];

export type Deployment = {
  version: ProtocolVersion;
  /** "current" | "legacy" — drives badges so legacy is never mistaken for an equal option. */
  status: "current" | "legacy";
  implementation: `0x${string}`;
  factory: `0x${string}`;
  feeCollector: `0x${string}`;
  /** Factory deploy block — origin for global VaultCreated/TaxCollected log scans. */
  deployBlock: number;
  /** Human-readable audit/test line for the protocol panel. */
  auditLine: string;
};

const MAINNET_UNAVAILABLE: Omit<Deployment, "version" | "status" | "auditLine"> = {
  implementation: ZERO_ADDRESS,
  factory: ZERO_ADDRESS,
  feeCollector: ZERO_ADDRESS,
  deployBlock: 0,
};

export const DEPLOYMENTS: Record<ProtocolVersion, Record<number, Deployment>> = {
  // v1.3.0 — unclaimed-IOUs-fixed (dhp commit 234526d, deployments.json 2026-09-12)
  "v1.3.0": {
    [BASE_SEPOLIA_ID]: {
      version: "v1.3.0",
      status: "current",
      implementation: "0xa69459881ec5fc7393e6a9212cb4232ec96b7d96",
      factory: "0x85d6436aabcba27888bc673a7f7cf6be3d2e4b9d",
      feeCollector: "0x412fa6073e977bdf57dabed1336dc7bd70d6e8c1",
      deployBlock: 46_735_881,
      auditLine: "six sequential self-audits · 75/75 tests passing · Sourcify verified",
    },
    [BASE_MAINNET_ID]: {
      version: "v1.3.0",
      status: "current",
      ...MAINNET_UNAVAILABLE,
      auditLine: "mainnet deployment pending external audit",
    },
  },
  // v1.2.2 — Spock's redeploy (dhp commit 2e28f99) · LEGACY: superseded by the
  // v1.3.0 unclaimed-IOU backing fix. Read-only curiosity, not an equal option.
  "v1.2.2": {
    [BASE_SEPOLIA_ID]: {
      version: "v1.2.2",
      status: "legacy",
      implementation: "0xaa5a3a495dadbeb4c5256c0e62ae0603d53f714b",
      factory: "0xf98a8db0b6a2be70e259992be11c252dbeccaa4d",
      feeCollector: "0xc6071346a5bb93bf1cc915124050004a268c4d37",
      deployBlock: 46_504_082,
      auditLine: "LEGACY · superseded by v1.3.0 (unclaimed-IOU backing fix) · 70/70 tests",
    },
    [BASE_MAINNET_ID]: {
      version: "v1.2.2",
      status: "legacy",
      ...MAINNET_UNAVAILABLE,
      auditLine: "mainnet deployment pending external audit",
    },
  },
};

export const DEFAULT_VERSION: ProtocolVersion = "v1.3.0";

/** Chains where the active version has a REAL deployment (non-zero factory).
 *  Zero-address registry entries count as NOT deployed — the app must never
 *  fire a tx at MAINNET_UNAVAILABLE placeholders. */
export function deploymentFor(
  version: ProtocolVersion,
  chainId: number
): Deployment | undefined {
  const d = DEPLOYMENTS[version][chainId];
  if (!d || d.factory === ZERO_ADDRESS) return undefined;
  return d;
}

/** The chain the wrong-network nudge should point at: mainnet if the active
 *  version is live there, else Sepolia. Single source for every switch target. */
export function preferredChainId(version: ProtocolVersion): number {
  return deploymentFor(version, BASE_MAINNET_ID) ? BASE_MAINNET_ID : BASE_SEPOLIA_ID;
}

export function isTestnet(chainId: number) {
  return chainId === BASE_SEPOLIA_ID;
}

/** Vault creation fee per chain, in ETH. Sepolia runs the immutable v1.3.0
 *  factory (0.001); mainnet v1.4.0 ships 0.004. The tier (#28) waives the
 *  fee entirely for CRDD members once wired. */
export function creationFeeEth(chainId: number): "0.001" | "0.004" {
  return chainId === BASE_SEPOLIA_ID ? "0.001" : "0.004";
}

/** Curator wallet for the Explore page's "Curated" tab. Only vaults whose
 *  VaultCreated tx was sent by this address (derived on-chain from logs, see
 *  useVaultCreators) appear under curated. Until v2.0.0 ships on-chain
 *  endorsement registries, this constant IS the curation policy. */
export const CURATOR_ADDRESS = "0x0B172a4E265AcF4c2E0aB238F63A44bf29bBd158" as `0x${string}`;
