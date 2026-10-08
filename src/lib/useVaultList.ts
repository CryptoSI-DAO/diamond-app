"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { erc20Abi, factoryAbi, vaultAbi } from "@/lib/abis";
import { DEPLOYMENTS, ZERO_ADDRESS } from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { useViewChain } from "@/components/ViewChainProvider";

export type VaultSummary = {
  address: `0x${string}`;
  /** Underlying token (ERC-4626 asset) — key for token icons. */
  asset: `0x${string}`;
  symbol: string;
  decimals: number;
  totalAssets: bigint;
  totalSupply: bigint;
  entryTaxBps: number;
  exitTaxBps: number;
};

export function useFactoryAddress() {
  const viewChainId = useViewChain().viewChainId;
  const { version } = useProtocolVersion();
  // Reads follow the VIEW chain (browsable without a wallet); zero-address
  // entries stay unconfigured so the UI never fires txs at placeholders.
  const addr = DEPLOYMENTS[version][viewChainId]?.factory ?? ZERO_ADDRESS;
  const configured = !!addr && addr !== ZERO_ADDRESS;
  return { factory: addr, configured };
}

/** Enumerates factory vaults and reads headline stats for each. */
export function useVaultList(): {
  vaults: VaultSummary[];
  loading: boolean;
  configured: boolean;
} {
  const { factory, configured } = useFactoryAddress();
  // 2026-10-08 CRITICAL: every read MUST pin the view chain. wagmi's
  // createConfig sorts chains by id ASCENDING, so the unconnected default
  // chain is Ethereum (1), not Base — unpinned reads hit the SAME deterministic
  // factory on Ethereum, where vaultCount = 0 → all chains showed an empty
  // vault list for every disconnected visitor (mobile included).
  const { viewChainId } = useViewChain();

  const count = useReadContract({
    chainId: viewChainId,
    abi: factoryAbi,
    address: configured ? factory : undefined,
    functionName: "vaultCount",
  });

  const n = count.data ? Number(count.data) : 0;

  const addresses = useReadContracts({
    // 2026-10-08: allowFailure=false meant ONE rate-limited/stale subcall
    // rejected the whole batch → vault list silently empty while vaults
    // existed on-chain. Failures now drop just that entry.
    allowFailure: true,
    contracts: Array.from({ length: n }, (_, i) => ({
      chainId: viewChainId,
      abi: factoryAbi,
      address: factory,
      functionName: "allVaultsAt",
      args: [BigInt(i)] as const,
    })),
  });

  const vAddrs = (addresses.data ?? [])
    .filter((r) => r.status === "success" && Boolean(r.result))
    .map((r) => r.result as unknown as `0x${string}`);

  const meta = useReadContracts({
    allowFailure: true,
    contracts: vAddrs.flatMap((a) => [
      { chainId: viewChainId, abi: erc20Abi, address: a, functionName: "symbol" },
      { chainId: viewChainId, abi: erc20Abi, address: a, functionName: "decimals" },
      { chainId: viewChainId, abi: vaultAbi, address: a, functionName: "asset" },
    ] as const),
  });

  const stats = useReadContracts({
    allowFailure: true,
    contracts: vAddrs.flatMap((a) => [
      { chainId: viewChainId, abi: vaultAbi, address: a, functionName: "totalAssets" },
      { chainId: viewChainId, abi: vaultAbi, address: a, functionName: "totalSupply" },
      { chainId: viewChainId, abi: vaultAbi, address: a, functionName: "entryTaxBps" },
      { chainId: viewChainId, abi: vaultAbi, address: a, functionName: "exitTaxBps" },
    ] as const),
  });

  const loading =
    count.isLoading || addresses.isLoading || meta.isLoading || stats.isLoading;

  const vaults: VaultSummary[] = vAddrs
    .map((a, i) => {
      const sym = meta.data?.[i * 3]?.result as string | undefined;
      const dec = meta.data?.[i * 3 + 1]?.result as number | undefined;
      const asset = meta.data?.[i * 3 + 2]?.result as `0x${string}` | undefined;
      const ta = stats.data?.[i * 4]?.result as bigint | undefined;
      const ts = stats.data?.[i * 4 + 1]?.result as bigint | undefined;
      const et = stats.data?.[i * 4 + 2]?.result as number | undefined;
      const xt = stats.data?.[i * 4 + 3]?.result as number | undefined;
      if (!sym || dec === undefined || !asset || ta === undefined || ts === undefined || et === undefined || xt === undefined) return null;
      return {
        address: a,
        asset,
        symbol: sym,
        decimals: dec,
        totalAssets: ta,
        totalSupply: ts,
        entryTaxBps: et,
        exitTaxBps: xt,
      };
    })
    .filter((v): v is VaultSummary => v !== null);

  return { vaults, loading, configured };
}
