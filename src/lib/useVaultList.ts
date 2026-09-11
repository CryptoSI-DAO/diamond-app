"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useAccount, useChainId } from "wagmi";
import { erc20Abi, factoryAbi, vaultAbi } from "@/lib/abis";
import { FACTORY } from "@/lib/addresses";

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
  const chainId = useChainId();
  const addr = FACTORY[chainId];
  const configured = !!addr && addr !== "0x0000000000000000000000000000000000000000";
  return { factory: addr, configured };
}

/** Enumerates factory vaults and reads headline stats for each. */
export function useVaultList(): {
  vaults: VaultSummary[];
  loading: boolean;
  configured: boolean;
} {
  const { factory, configured } = useFactoryAddress();

  const count = useReadContract({
    abi: factoryAbi,
    address: configured ? factory : undefined,
    functionName: "vaultCount",
  });

  const n = count.data ? Number(count.data) : 0;

  const addresses = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: n }, (_, i) => ({
      abi: factoryAbi,
      address: factory,
      functionName: "allVaultsAt",
      args: [BigInt(i)] as const,
    })),
  });

  const vAddrs = (addresses.data ?? []) as unknown as `0x${string}`[];

  const meta = useReadContracts({
    allowFailure: true,
    contracts: vAddrs.flatMap((a) => [
      { abi: erc20Abi, address: a, functionName: "symbol" },
      { abi: erc20Abi, address: a, functionName: "decimals" },
      { abi: vaultAbi, address: a, functionName: "asset" },
    ] as const),
  });

  const stats = useReadContracts({
    allowFailure: true,
    contracts: vAddrs.flatMap((a) => [
      { abi: vaultAbi, address: a, functionName: "totalAssets" },
      { abi: vaultAbi, address: a, functionName: "totalSupply" },
      { abi: vaultAbi, address: a, functionName: "entryTaxBps" },
      { abi: vaultAbi, address: a, functionName: "exitTaxBps" },
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
