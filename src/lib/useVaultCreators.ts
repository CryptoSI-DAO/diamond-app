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

export type VaultCreators = {
  /** vault address (checksummed as logged) → creator address (tx.from) */
  creatorsByVault: Record<string, `0x${string}`>;
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
  const [creatorsByVault, setCreatorsByVault] = useState<Record<string, `0x${string}`>>({});
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
        // logs carry no sender — read tx.from via receipts (few, deduped)
        const txFrom = new Map<string, `0x${string}`>();
        for (const hash of new Set(vaultTx.values())) {
          const r = await pc.getTransactionReceipt({ hash });
          txFrom.set(hash, r.from);
        }
        const map: Record<string, `0x${string}`> = {};
        for (const [vault, hash] of vaultTx) {
          const from = txFrom.get(hash);
          if (from) map[vault] = from;
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
