"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { vaultAbi } from "@/lib/abis";
import { BASE_MAINNET_ID, BASE_SEPOLIA_ID, DEPLOYMENTS } from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { useViewChain } from "@/components/ViewChainProvider";
import { scanLogs, probeFirstEventBlock } from "@/lib/logScan";

// v1.3.0: 5 fields · v1.4.0 (#29): 9 fields. Try active version's shape
// first, fall back to the other — both read `.dividends` identically.
const TAX_COLLECTED_V13 = parseAbiItem(
  "event TaxCollected(uint8 kind, uint256 gross, uint256 dividends, uint256 burned, uint256 protocolFee)"
);
const TAX_COLLECTED_V14 = parseAbiItem(
  "event TaxCollected(uint8 kind, uint256 gross, uint256 dividendPortion, uint256 burnPortion, uint256 daoPortion, uint256 creatorPortion, uint256 creationPlatformPortion, uint256 usagePortion)"
);

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
  const { viewChainId } = useViewChain();
  const pc = usePublicClient({ chainId: viewChainId });
  const { version } = useProtocolVersion();
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

        // 2) dividends — adaptive chunked log scan (all vaults per call).
        // 2026-10-05: Base's RPC caps getLogs at 2,000 blocks — the old fixed
        // 9,000-chunk scan threw every chunk. Also: scanning from the factory
        // deploy block is pointless while the protocol is young (no vaults →
        // no TaxCollected events) — probe for the first event instead and
        // scan from there. Falls back to the deploy block if the probe caps out.
        const cid = pc.chain.id;
        const dep =
          DEPLOYMENTS[version][cid] ??
          DEPLOYMENTS[version][cid === BASE_MAINNET_ID ? BASE_SEPOLIA_ID : BASE_MAINNET_ID];
        const deployBlock = dep.deployBlock;
        const latest = await pc.getBlockNumber();
        const primary = version === "v1.4.0" ? TAX_COLLECTED_V14 : TAX_COLLECTED_V13;
        const secondary = version === "v1.4.0" ? TAX_COLLECTED_V13 : TAX_COLLECTED_V14;
        const firstPrimary = await probeFirstEventBlock(pc, {
          address: [...vaultAddresses], event: primary, fromBlock: BigInt(deployBlock), toBlock: latest,
        });
        const firstSecondary = firstPrimary === null
          ? await probeFirstEventBlock(pc, {
              address: [...vaultAddresses], event: secondary, fromBlock: BigInt(deployBlock), toBlock: latest,
            })
          : null;
        // null probe = no events found within the probe budget → nothing to sum
        if (firstPrimary === null && firstSecondary === null) {
          setDividendsTotal(0n);
        } else {
          const scanFrom = [firstPrimary, firstSecondary]
            .filter((b): b is bigint => b !== null)
            .reduce((a, b) => (a < b ? a : b)) - 1n;
          const from = scanFrom < BigInt(deployBlock) ? BigInt(deployBlock) : scanFrom;
          let divs = 0n;
          // TaxCollected is emitted BY VAULTS (not the factory) — scan the
          // vault addresses, decoding both version shapes.
          const logs = (
            await scanLogs(pc, { address: [...vaultAddresses], event: primary, fromBlock: from, toBlock: latest })
          ).concat(
            await scanLogs(pc, { address: [...vaultAddresses], event: secondary, fromBlock: from, toBlock: latest })
          );
          for (const l of logs) {
            const a = l.args as { dividends?: bigint; dividendPortion?: bigint };
            divs += a.dividends ?? a.dividendPortion ?? 0n;
          }
          setDividendsTotal(divs);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to scan chain events");
      } finally {
        busy.current = false;
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, !!pc, version, viewChainId]);

  return { burnTotal, dividendsTotal, loading, error };
}
