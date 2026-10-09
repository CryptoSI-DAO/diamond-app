"use client";

import { useReadContract, useReadContracts, useBalance } from "wagmi";
import type {
  Config,
  UseReadContractParameters,
  UseReadContractReturnType,
  UseReadContractsParameters,
  UseReadContractsReturnType,
  UseBalanceParameters,
  UseBalanceReturnType,
} from "wagmi";
import { useViewChain } from "@/components/ViewChainProvider";

/**
 * Chain-pinned read hooks — the 2026-10-08/09 incident rules, enforced by
 * construction instead of memory. New reads MUST use these, not wagmi's
 * raw hooks:
 *
 *  1. EVERY read pins the VIEW chain. 2026-10-08: unpinned reads defaulted
 *     to the first config chain (Ethereum), read the SAME deterministic
 *     factory there (vaultCount = 0), and every chain showed an empty list
 *     for disconnected visitors. An explicit `chainId` in the config is
 *     IGNORED and overwritten — pinning is the whole point.
 *  2. Batch reads never use allowFailure:false. 2026-10-08: ONE throttled
 *     subcall rejected entire batches (allowFailure:false) → silently empty
 *     UI. Failures are now per-entry, filtered by the caller, and COUNTED
 *     in the returned `failed` field so UIs can warn instead of lying
 *     with zeros.
 *  3. `failed` (and `readFailed` in useVaultList) is the read-health
 *     signal — surface it. All four 2026-10-08/09 incidents presented as
 *     mystery states (empty lists, dead buttons) because nothing reported
 *     read failures.
 *
 * Note on identity: mapping contracts to a fresh array each render is SAFE
 * — wagmi hashes contracts by value for the query key, so equal content
 * never refetches. Arrays may still NOT go into useEffect deps directly;
 * value-key them first (e.g. the runKey pattern in useVaultCreators.ts —
 * the 2026-10-09 render loop that stalled all Link navigation).
 */

/** useReadContract, pinned to the view chain. Extra field: `failed` (0|1). */
export function useChainReadContract(
  config: UseReadContractParameters
): UseReadContractReturnType & { failed: number } {
  const { viewChainId } = useViewChain();
  const result = useReadContract({ ...config, chainId: viewChainId });
  return { ...result, failed: result.isError ? 1 : 0 };
}

/**
 * useReadContracts, pinned to the view chain, allowFailure forced on.
 * Generic mirrors wagmi's own `<const contracts>` inference so per-entry
 * `.result` types survive at call sites.
 */
export function useChainReadContracts<const contracts extends readonly unknown[]>(
  config: Omit<UseReadContractsParameters<contracts, true, Config>, "allowFailure">
): UseReadContractsReturnType<contracts, true> & { failed: number } {
  const { viewChainId } = useViewChain();
  const vc = { chainId: viewChainId } as const;
  // Whole-params cast: viem's MulticallContracts<Narrow<...>> shape resists
  // generic re-wrapping; the cast is honest — we only inject chainId per
  // contract. Call-site inference is unaffected (generic binds at the caller).
  const result = useReadContracts<contracts, true>({
    ...config,
    allowFailure: true,
    contracts: config.contracts?.map((c) => Object.assign({}, c as object, vc)),
  } as UseReadContractsParameters<contracts, true, Config>);
  const failed = Array.isArray(result.data)
    ? result.data.filter((r) => r && r.status === "failure").length
    : 0;
  return { ...result, failed };
}

/** useBalance, pinned to the view chain. */
export function useChainBalance(
  config: UseBalanceParameters = {} as UseBalanceParameters
): UseBalanceReturnType {
  const { viewChainId } = useViewChain();
  return useBalance({ ...config, chainId: viewChainId });
}
