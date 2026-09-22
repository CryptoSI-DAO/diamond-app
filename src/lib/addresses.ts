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
export const BASE_MAINNET_ID = 8453;
export const ETHEREUM_MAINNET_ID = 1;
export const BNB_MAINNET_ID = 56;
export const ROBINHOOD_MAINNET_ID = 4663;
export const ARC_TESTNET_ID = 5042002;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export type ProtocolVersion = "v1.4.0" | "v1.3.0" | "v1.2.2";

export const PROTOCOL_VERSIONS: ProtocolVersion[] = ["v1.4.0", "v1.3.0", "v1.2.2"];

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
  // v1.4.0 — mainnet launch candidate (dhp #28 tier + #29 partner split).
  // Addresses land HERE the moment the real deploy broadcast happens; the
  // zero-address skeleton keeps every UI gate (deploymentFor/preferredChain)
  // honest until then. Tier launches dormant (crddToken = 0x0).
  "v1.4.0": {
    [BASE_SEPOLIA_ID]: {
      version: "v1.4.0",
      status: "current",
      ...MAINNET_UNAVAILABLE,
      auditLine: "v1.4.0 testnet deploy pending (97/97 tests · partner-split #29)",
    },
    [BASE_MAINNET_ID]: {
      version: "v1.4.0",
      status: "current",
      implementation: "0x75a7Fee6e8c17F6A7C39136C69A869fe99961D94",
      factory: "0x64BE13cE698684846Ae0642c1c63bb5eDE8F6929",
      feeCollector: "0x0D48743923D8fcE041325F98B5Ce884a323f5499",
      deployBlock: 51_343_897,
      auditLine: "LIVE mainnet · self-audited & fixed same day (H-NEW-1) · 101/101 tests · Blockscout verified",
    },
    // 2026-09-22 multichain expansion — same deterministic addresses as Base
    // (fresh nonce-0 deploys of identical bytecode). Treasury/curator carried
    // over unchanged. Verification: explorer + raw eth_getCode/cast read-backs.
    [ETHEREUM_MAINNET_ID]: {
      version: "v1.4.0",
      status: "current",
      implementation: "0x75a7Fee6e8c17F6A7C39136C69A869fe99961D94",
      factory: "0x64BE13cE698684846Ae0642c1c63bb5eDE8F6929",
      feeCollector: "0x0D48743923D8fcE041325F98B5Ce884a323f5499",
      deployBlock: 26_032_989,
      auditLine: "LIVE Ethereum · multichain expansion 2026-09-22 · read-backs verified on-chain",
    },
    [BNB_MAINNET_ID]: {
      version: "v1.4.0",
      status: "current",
      implementation: "0x75a7Fee6e8c17F6A7C39136C69A869fe99961D94",
      factory: "0x64BE13cE698684846Ae0642c1c63bb5eDE8F6929",
      feeCollector: "0x0D48743923D8fcE041325F98B5Ce884a323f5499",
      deployBlock: 123_371_417,
      auditLine: "LIVE BNB Chain · multichain expansion 2026-09-22 · read-backs verified on-chain",
    },
    [ROBINHOOD_MAINNET_ID]: {
      version: "v1.4.0",
      status: "current",
      implementation: "0x75a7Fee6e8c17F6A7C39136C69A869fe99961D94",
      factory: "0x64BE13cE698684846Ae0642c1c63bb5eDE8F6929",
      feeCollector: "0x0D48743923D8fcE041325F98B5Ce884a323f5499",
      deployBlock: 69_646_575,
      auditLine: "LIVE Robinhood Chain (Arbitrum Orbit L2) · multichain expansion 2026-09-22 · read-backs verified on-chain",
    },
  },
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

// v1.4.0 is LIVE on Base mainnet (deployed 2026-09-15, block 51_343_897).
export const DEFAULT_VERSION: ProtocolVersion = "v1.4.0";

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

/** Vault creation fee per (version, chain), in ETH. v1.3.0 factories are
 *  immutable at 0.001 (Sepolia); v1.4.0 ships 0.004 (mainnet launch canon).
 *  The tier (#28) waives the fee entirely for CRDD members once wired. */
export function creationFeeEth(
  version: ProtocolVersion,
  chainId: number
): "0.001" | "0.004" {
  if (version === "v1.4.0") return "0.004";
  return chainId === BASE_SEPOLIA_ID ? "0.001" : "0.004";
}

/** Curator wallet for the Explore page's "Curated" tab. Only vaults whose
 *  VaultCreated tx was sent by this address (derived on-chain from logs, see
 *  useVaultCreators) appear under curated. Until v2.0.0 ships on-chain
 *  endorsement registries, this constant IS the curation policy. */
export const CURATOR_ADDRESS = "0x0B172a4E265AcF4c2E0aB238F63A44bf29bBd158" as `0x${string}`;

/** #29 usage-platform wallet (earns 2% of every entry/exit tax, per tx).
 *  Set to ZERO_ADDRESS = v1.4.0 deposit/withdraw flows use the plain
 *  ERC-4626 calls (usage share routes to the DAO — headless-safe default).
 *  Drop the real platform wallet here to switch flows to *WithPlatform. */
export const USAGE_PLATFORM_WALLET = ZERO_ADDRESS;
