"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { BASE_SEPOLIA_ID, FACTORY, FACTORY_DEPLOY_BLOCK } from "@/lib/addresses";

const VAULT_CREATED = parseAbiItem(
  "event VaultCreated(address indexed token, address indexed vault, uint16 entryTaxBps, uint16 exitTaxBps, uint16 dividendShareBps)"
);

/** Public nodes cap getLogs ranges — stay under it (same as useGlobalStats). */
const LOG_CHUNK = 9000;

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
 * This is also the v2.0.0 self-curation primitive: on-chain endorsement
 * registries will replace this list, not change its shape.
 */
export function useVaultCreators(vaultAddresses: readonly `0x${string}`[]): VaultCreators {
  const pc = usePublicClient();
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
        const latest = await pc.getBlockNumber();
        for (let start = BigInt(FACTORY_DEPLOY_BLOCK); start <= latest; start += BigInt(LOG_CHUNK)) {
          const end = start + BigInt(LOG_CHUNK - 1) > latest ? latest : start + BigInt(LOG_CHUNK - 1);
          const logs = await pc.getLogs({
            address: FACTORY[BASE_SEPOLIA_ID],
            event: VAULT_CREATED,
            fromBlock: start,
            toBlock: end,
          });
          for (const l of logs) {
            const vault = l.args.vault;
            if (!vault || !wanted.has(vault.toLowerCase())) continue;
            if (l.transactionHash) vaultTx.set(vault.toLowerCase(), l.transactionHash);
          }
        }
        // logs carry no sender — read tx.from + tx.to via receipts (few, deduped)
        const txInfo = new Map<string, { from: `0x${string}`; to: `0x${string}` }>();
        for (const hash of new Set(vaultTx.values())) {
          const r = await pc.getTransactionReceipt({ hash });
          txInfo.set(hash, { from: r.from, to: r.to ?? ZERO_ADDRESS });
        }
        const map: Record<string, VaultCreatorInfo> = {};
        for (const [vault, hash] of vaultTx) {
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
  }, [runKey, !!pc]); // eslint-disable-line react-hooks/exhaustive-deps

  return { creatorsByVault, loading, error };
}
