"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { BASE_MAINNET_ID, BASE_SEPOLIA_ID, DEPLOYMENTS } from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { useViewChain } from "@/components/ViewChainProvider";
import { scanLogs } from "@/lib/logScan";

// Event shapes differ per version: v1.3.0 emits (token, vault, entry, exit,
// divShare); v1.4.0 (#29) emits (token, vault, creatorWallet indexed,
// creationPlatformWallet). Scanning tries the ACTIVE version's shape first,
// then falls back to the other — cheap and immune to mixed-version logs.
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
  /** vault address (lowercased) → submitter + call target of its VaultCreated tx */
  creatorsByVault: Record<string, VaultCreatorInfo>;
  loading: boolean;
  error: string | null;
};

/**
 * Derives each vault's creator from VaultCreated logs (the factory stores no
 * creator mapping; the VaultCreated tx sender IS the creator). One chunked
 * log scan from the factory deploy block, shared per page-load.
 *
 * 2026-10-05: fixed for Base mainnet — the official RPC caps getLogs at a
 * 2,000-block range, so the old fixed 9,000-chunk scan threw on every chunk
 * and the Curated tab was permanently empty (treasury vaults by 0x0B17…d158
 * included). Now uses the adaptive scanner (lib/logScan.ts), which halves the
 * chunk on range-cap errors, and skips the receipt round-trip for v1.4.0 by
 * reading creatorWallet straight from the log.
 */
export function useVaultCreators(vaultAddresses: readonly `0x${string}`[]): VaultCreators {
  const { viewChainId } = useViewChain();
  const pc = usePublicClient({ chainId: viewChainId });
  const { version } = useProtocolVersion();
  const [creatorsByVault, setCreatorsByVault] = useState<Record<string, VaultCreatorInfo>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runKey = useMemo(() => vaultAddresses.join(","), [vaultAddresses]);
  const busy = useRef(false);

  useEffect(() => {
    if (!pc || vaultAddresses.length === 0) {
      setCreatorsByVault({});
      setError(null);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
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

        // Active version's shape first, then the other (covers mixed-version
        // logs and version toggles mid-session). scanLogs chunks adaptively.
        const primary = version === "v1.4.0" ? VAULT_CREATED_V14 : VAULT_CREATED_V13;
        const secondary = version === "v1.4.0" ? VAULT_CREATED_V13 : VAULT_CREATED_V14;
        const logs = (
          await scanLogs(pc, { address: factory, event: primary, fromBlock: BigInt(deployBlock), toBlock: latest })
        ).concat(
          await scanLogs(pc, { address: factory, event: secondary, fromBlock: BigInt(deployBlock), toBlock: latest })
        );

        for (const l of logs) {
          const vault = l.args?.vault as `0x${string}` | undefined;
          if (!vault || !wanted.has(vault.toLowerCase())) continue;
          const key = vault.toLowerCase();
          if (l.transactionHash) vaultTx.set(key, l.transactionHash);
          const cw = (l.args as { creatorWallet?: `0x${string}` } | undefined)?.creatorWallet;
          if (cw && cw !== ZERO_ADDRESS) creatorFromLog.set(key, cw);
        }

        // v1.3.0 events carry no creator — those need tx.from from receipts.
        // v1.4.0 resolves from creatorWallet in the log, zero extra calls.
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
        setCreatorsByVault(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to scan VaultCreated events");
      } finally {
        busy.current = false;
        setLoading(false);
      }
    })();
  }, [runKey, !!pc, version, viewChainId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { creatorsByVault, loading, error };
}
