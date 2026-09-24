"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_CHAIN_ID } from "@/lib/addresses";

const KEY = "dhp.viewChain";

/**
 * Which chain's DATA the user is browsing — independent of the wallet.
 * Defaults to Base mainnet; persisted to localStorage and restored
 * pre-hydration by the boot script in layout.tsx (no flash of Base for
 * someone who parked on BNB yesterday).
 */
type ViewChainCtx = { viewChainId: number; setViewChain: (id: number) => void };
const Ctx = createContext<ViewChainCtx>({ viewChainId: DEFAULT_CHAIN_ID, setViewChain: () => {} });

export function ViewChainProvider({ children }: { children: React.ReactNode }) {
  const [viewChainId, setViewChainState] = useState<number>(DEFAULT_CHAIN_ID);

  // hydrate from the <html> attribute (set pre-paint by the layout boot script)
  useEffect(() => {
    const raw = document.documentElement.getAttribute("data-viewchain");
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!isNaN(n) && n > 0) setViewChainState(n);
  }, []);

  const setViewChain = (id: number) => {
    setViewChainState(id);
    document.documentElement.setAttribute("data-viewchain", String(id));
    try {
      localStorage.setItem(KEY, String(id));
    } catch {}
  };

  return <Ctx.Provider value={{ viewChainId, setViewChain }}>{children}</Ctx.Provider>;
}

export const useViewChain = () => useContext(Ctx);
