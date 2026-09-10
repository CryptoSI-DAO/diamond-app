"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { vaultAbi } from "@/lib/abis";
import { FACTORY_DEPLOY_BLOCK } from "@/lib/addresses";

const TAX_COLLECTED = parseAbiItem(
  "event TaxCollected(uint8 kind, uint256 gross, uint256 dividends, uint256 burned, uint256 protocolFee)"
);

/** Public nodes cap getLogs ranges — stay under it. */
const LOG_CHUNK = 9000;

export type GlobalStats = {
  /** Sum of every vault's totalBurned() — raw asset units across vaults. */
  burnTotal: bigint | null;
  /** Sum of TaxCollected.dividends across all vaults since factory deploy. */
  dividendsTotal: bigint | null;
  loading: boolean;
  error: string | null;
};

/**
 * Global lore counters for the Explore hero: tokens burned + dividends
 * distributed across every deployed vault.
 * - burns: one multicall (totalBurned per vault)
 * - dividends: chunked eth_getLogs over all vault addresses from the
 *   factory's deploy block (node caps ranges at 10k blocks)
 */
export function useGlobalStats(vaultAddresses: readonly `0x${string}`[]): GlobalStats {
  const pc = usePublicClient();
  const [burnTotal, setBurnTotal] = useState<bigint | null>(null);
  const [dividendsTotal, setDividendsTotal] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runKey = useMemo(() => vaultAddresses.join(","), [vaultAddresses]);
  const busy = useRef(false);

  useEffect(() => {
    if (!pc || vaultAddresses.length === 0) {
      setBurnTotal(null);
      setDividendsTotal(null);
      setError(null);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) burns — single multicall
        let burns = 0n;
        const burnResults = await pc.multicall({
          allowFailure: true,
          contracts: vaultAddresses.map(
            (a) =>
              ({
                abi: vaultAbi,
                address: a,
                functionName: "totalBurned",
              }) as const
          ),
        });
        for (const r of burnResults) {
          if (r.status === "success") burns += r.result as bigint;
        }
        setBurnTotal(burns);

        // 2) dividends — chunked log scan (all vaults per call)
        const latest = await pc.getBlockNumber();
        let divs = 0n;
        for (let start = BigInt(FACTORY_DEPLOY_BLOCK); start <= latest; start += BigInt(LOG_CHUNK)) {
          const end = start + BigInt(LOG_CHUNK - 1) > latest ? latest : start + BigInt(LOG_CHUNK - 1);
          const logs = await pc.getLogs({
            address: [...vaultAddresses],
            event: TAX_COLLECTED,
            fromBlock: start,
            toBlock: end,
          });
          for (const l of logs) divs += l.args.dividends ?? 0n;
        }
        setDividendsTotal(divs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to scan chain events");
      } finally {
        busy.current = false;
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, !!pc]);

  return { burnTotal, dividendsTotal, loading, error };
}
