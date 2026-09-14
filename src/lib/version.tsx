"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  BASE_MAINNET_ID,
  BASE_SEPOLIA_ID,
  DEFAULT_VERSION,
  deploymentFor,
  PROTOCOL_VERSIONS,
  type Deployment,
  type ProtocolVersion,
} from "@/lib/addresses";

const STORAGE_KEY = "dhp.protocolVersion";

function loadStored(): ProtocolVersion {
  if (typeof window === "undefined") return DEFAULT_VERSION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (PROTOCOL_VERSIONS as string[]).includes(raw)) {
      return raw as ProtocolVersion;
    }
  } catch {
    // private mode / storage disabled — fall through to default
  }
  return DEFAULT_VERSION;
}

type VersionContextValue = {
  version: ProtocolVersion;
  /** Cross-chain display deployment (mainnet when live, else Sepolia).
   *  For tx-building, always go through useFactoryAddress() / chainId gates. */
  deployment: Deployment;
  setVersion: (v: ProtocolVersion) => void;
};

const VersionContext = createContext<VersionContextValue | null>(null);

export function ProtocolVersionProvider({ children }: { children: React.ReactNode }) {
  // Server + first paint use the default; storage is read after mount so SSR
  // markup stays stable (no hydration mismatch).
  const [version, setVersionState] = useState<ProtocolVersion>(DEFAULT_VERSION);

  useEffect(() => {
    setVersionState(loadStored());
  }, []);

  const setVersion = (v: ProtocolVersion) => {
    setVersionState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // best-effort persistence
    }
  };

  // Chain-aware resolution for cross-chain surfaces (protocol panel, footer
  // toggle): show mainnet once the active version is live there, else
  // Sepolia. Per-chain tx gating happens downstream via useChainId() —
  // useFactoryAddress() serves the zero-address-safe deployment per chain.
  const deployment =
    deploymentFor(version, BASE_MAINNET_ID) ??
    deploymentFor(version, BASE_SEPOLIA_ID)!; // invariant: every version has a Sepolia entry

  return (
    <VersionContext.Provider value={{ version, deployment, setVersion }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useProtocolVersion(): VersionContextValue {
  const ctx = useContext(VersionContext);
  if (!ctx) throw new Error("useProtocolVersion must be used within ProtocolVersionProvider");
  return ctx;
}
