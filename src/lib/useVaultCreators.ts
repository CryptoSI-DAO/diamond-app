"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient, useReadContracts } from "wagmi";
import { parseAbiItem } from "viem";
import { BASE_MAINNET_ID, BASE_SEPOLIA_ID, DEPLOYMENTS } from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { useViewChain } from "@/components/ViewChainProvider";
import { scanLogs } from "@/lib/logScan";
import { vaultAbi } from "@/lib/abis";

// Event shapes differ per version: v1.3.0 emits (token, vault, entry, exit,
// divShare); v1.4.0 (#29) emits (token, vault, creatorWallet indexed,
// creationPlatformWallet). Kept ONLY for the v1.3.0 legacy fallback scan —
// v1.4.0 resolves creators from vault state, no logs needed (see below).
const VAULT_CREATED_V13 = parseAbiItem(
  "event VaultCreated(address indexed token, address indexed vault, uint16 entryTaxBps, uint16 exitTaxBps, uint16 dividendShareBps)"
);
const VAULT_CREATED_V14 = parseAbiItem(
  "event VaultCreated(address indexed token, address indexed vault, address indexed creatorWallet, address creationPlatformWallet)"
);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type VaultCreatorInfo = {
  /** tx.from — the submitter. Under AA this can be a relayer, NOT the human. */
  from: `0x${string}`;
  /** tx.to — the factory for direct creates; another contract when routed
   *  through delegation/smart-account machinery. */
  to: `0x${string}`;
};

export type VaultCreators = {
  /** vault address (lowercased) → creator wallet + creation call target */
  creatorsByVault: Record<string, VaultCreatorInfo>;
  loading: boolean;
  error: string | null;
};

/**
 * Resolves each vault's creator wallet (drives the Curated filter).
 *
 * v1.4.0 (2026-10-08): `vaultCreator` is IMMUTABLE state in every vault —
 * it routes the 2% creator tax share, so reading it is strictly MORE
 * authoritative than the emit-time log. The old log scan issued ~1,000
 * chunked eth_getLogs requests per page load on Base (~1M blocks @ 2k/chunk
 * × two event shapes), got silently 429/400-throttled by the RPC, and left
 * the Curated tab empty. One batched multicall over the (tiny) vault list
 * replaces it. The scan path survives only for v1.3.0 legacy vaults, whose
 * events carry no creator wallet and whose spans are small (Sepolia).
 */
export function useVaultCreators(vaultAddresses: readonly `0x${string}`[]): VaultCreators {
  const { viewChainId } = useViewChain();
  const pc = usePublicClient({ chainId: viewChainId });
  const { version } = useProtocolVersion();
  const isV14 = version === "v1.4.0";

  const creators = useReadContracts({
    query: { enabled: isV14 && vaultAddresses.length > 0 },
    allowFailure: true,
    contracts: vaultAddresses.map((a) => ({
      chainId: viewChainId,
      abi: vaultAbi,
      address: a,
      functionName: "vaultCreator",
    })),
  });

  const [scanCreators, setScanCreators] = useState<Record<string, VaultCreatorInfo>>({});
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runKey = useMemo(() => vaultAddresses.join(","), [vaultAddresses]);
  const busy = useRef(false);

  useEffect(() => {
    if (isV14 || !pc || vaultAddresses.length === 0) {
      setScanCreators({});
      setError(null);
      setScanLoading(false);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setScanLoading(true);
    setError(null);

    (async () => {
      try {
        const wanted = new Set(vaultAddresses.map((a) => a.toLowerCase()));
        const vaultTx = new Map<string, `0x${string}`>(); // vault -> VaultCreated tx hash
        const creatorFromLog = new Map<string, `0x${string}`>(); // vault -> creatorWallet (v14)
        const cid = pc.chain.id;
        const dep =
          DEPLOYMENTS[version][cid] ??
          DEPLOYMENTS[version][cid === BASE_MAINNET_ID ? BASE_SEPOLIA_ID : BASE_MAINNET_ID];
        const factory = dep.factory;
        const deployBlock = dep.deployBlock;
        const latest = await pc.getBlockNumber();

        // Legacy path: scan both shapes (v1.3.0 primary — the legacy deploys
        // emit it; v1.4.0 secondary covers stray newer vaults). scanLogs
        // chunks adaptively.
        const logsV13 = await scanLogs(pc, { address: factory, event: VAULT_CREATED_V13, fromBlock: BigInt(deployBlock), toBlock: latest });
        const logsV14 = await scanLogs(pc, { address: factory, event: VAULT_CREATED_V14, fromBlock: BigInt(deployBlock), toBlock: latest });
        type AnyVaultCreatedLog = {
          args?: { vault?: `0x${string}`; creatorWallet?: `0x${string}` };
          transactionHash?: `0x${string}`;
        };
        const logs = [...logsV13, ...logsV14] as unknown as AnyVaultCreatedLog[];

        for (const l of logs) {
          const vault = l.args?.vault as `0x${string}` | undefined;
          if (!vault || !wanted.has(vault.toLowerCase())) continue;
          const key = vault.toLowerCase();
          if (l.transactionHash) vaultTx.set(key, l.transactionHash);
          const cw = (l.args as { creatorWallet?: `0x${string}` } | undefined)?.creatorWallet;
          if (cw && cw !== ZERO_ADDRESS) creatorFromLog.set(key, cw);
        }

        // v1.3.0 events carry no creator — those need tx.from from receipts.
        const txInfo = new Map<string, { from: `0x${string}`; to: `0x${string}` }>();
        for (const [vault, hash] of vaultTx) {
          if (creatorFromLog.has(vault)) continue;
          const r = await pc.getTransactionReceipt({ hash });
          txInfo.set(hash, { from: r.from, to: (r.to ?? ZERO_ADDRESS) as `0x${string}` });
        }

        const map: Record<string, VaultCreatorInfo> = {};
        for (const [vault, hash] of vaultTx) {
          const cw = creatorFromLog.get(vault);
          if (cw) {
            map[vault] = { from: cw, to: factory };
            continue;
          }
          const info = txInfo.get(hash);
          if (info) map[vault] = info;
        }
        setScanCreators(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to scan VaultCreated events");
      } finally {
        busy.current = false;
        setScanLoading(false);
      }
    })();
  }, [runKey, pc, version, isV14, vaultAddresses]);

  const creatorsByVault: Record<string, VaultCreatorInfo> = {};
  let loading = false;

  if (isV14) {
    const dep = DEPLOYMENTS[version][viewChainId];
    (creators.data ?? []).forEach((r, i) => {
      const a = vaultAddresses[i];
      if (!a || r.status !== "success") return;
      const cw = r.result as unknown as `0x${string}` | undefined;
      if (!cw || cw === ZERO_ADDRESS) return;
      creatorsByVault[a.toLowerCase()] = { from: cw, to: dep?.factory ?? ZERO_ADDRESS };
    });
    loading = creators.isLoading;
  } else {
    Object.assign(creatorsByVault, scanCreators);
    loading = scanLoading;
  }

  return { creatorsByVault, loading, error };
}
