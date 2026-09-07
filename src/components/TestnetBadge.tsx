"use client";

import { useAccount, useChainId } from "wagmi";
import { BASE_SEPOLIA_ID } from "@/lib/addresses";

export function TestnetBadge() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  if (!isConnected || chainId !== BASE_SEPOLIA_ID) return null;
  return (
    <div className="rounded-full border border-fee/40 bg-fee/10 px-3 py-1 text-xs font-medium text-fee">
      TESTNET — Base Sepolia
    </div>
  );
}
