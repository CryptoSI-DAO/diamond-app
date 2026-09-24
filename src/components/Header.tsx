"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import {
  BASE_MAINNET_ID,
  BASE_SEPOLIA_ID,
  DEPLOYMENTS,
  deployedChainIds,
  PROTOCOL_VERSIONS,
  type ProtocolVersion,
} from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { useViewChain } from "@/components/ViewChainProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const CHAIN_META: Record<number, { name: string; dot: string; badge: string }> = {
  [BASE_MAINNET_ID]: { name: "Base", dot: "#0052ff", badge: "LIVE" },
  1: { name: "Ethereum", dot: "#8a92b2", badge: "LIVE" },
  56: { name: "BNB Chain", dot: "#f0b90b", badge: "LIVE" },
  4663: { name: "Robinhood Chain", dot: "#00c805", badge: "LIVE" },
  5042: { name: "Arc", dot: "#2775ca", badge: "USDC GAS" },
  84532: { name: "Base Sepolia", dot: "#ffb547", badge: "TESTNET" },
  5042002: { name: "Arc Testnet", dot: "#7bd0ff", badge: "TESTNET" },
};

const meta = (id: number) => CHAIN_META[id] ?? { name: `Chain ${id}`, dot: "#8a919d", badge: "" };

/** Which network's DATA you're browsing — always visible, works disconnected.
 *  Switching re-points every read hook; connecting prompts the wallet to match. */
function NetworkSelector() {
  const { version } = useProtocolVersion();
  const { viewChainId, setViewChain } = useViewChain();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const chains = deployedChainIds(version);
  const cur = meta(viewChainId);
  const wrong = isConnected && chainId !== viewChainId;
  const wrongChainName = meta(chainId).name;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Select network"
        aria-expanded={open}
        aria-haspopup="menu"
        className={`pill cursor-pointer transition ${wrong ? "!border-fee/60 !bg-fee/10 !text-fee hover:!border-fee" : "hover:!border-ice/60"}`}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: cur.dot }} />
        <span>{cur.name}</span>
        <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-72 p-2 text-left" role="menu">
          <div className="label px-2 pb-1 pt-0.5">Networks</div>
          {chains.map((id) => {
            const m = meta(id);
            const active = id === viewChainId;
            return (
              <button
                key={id}
                role="menuitem"
                onClick={() => {
                  setViewChain(id);
                  setOpen(false);
                  // Glue a connected wallet to the view: switch, and if the
                  // wallet doesn't know the chain yet, wagmi auto-issues
                  // wallet_addEthereumChain with the chain's RPC/explorer
                  // metadata. Rejection (or failed add) just leaves the amber
                  // mismatch state — browsing still works, manual switch
                  // buttons remain as fallback.
                  if (isConnected) switchChainAsync({ chainId: id }).catch(() => {});
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/5 ${active ? "cursor-default" : ""}`}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.dot }} />
                <span className="flex-1 text-sm font-semibold">{m.name}</span>
                {m.badge && (
                  <span className="pill !px-2 !py-0.5 !text-[9px] text-ice">{m.badge}</span>
                )}
                {active && <span className="text-ice">✓</span>}
              </button>
            );
          })}

          {wrong && (
            <p className="px-2 pb-1 pt-2 text-[11px] leading-relaxed text-ink-faint">
              You&apos;re browsing <span className="font-semibold text-ink">{cur.name}</span> but your wallet is on{" "}
              <span className="text-fee">{wrongChainName}</span>.{" "}
              <button
                onClick={() => switchChain({ chainId: viewChainId })}
                className="font-semibold text-ice underline underline-offset-2"
              >
                Switch wallet to {cur.name}
              </button>{" "}
              to transact.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-[0.12em] uppercase transition ${
        pathname === href ? "bg-ice text-[#04182e]" : "text-ink-faint hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line/40 bg-surface-dim/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gem-192.png" alt="Diamond Hands Protocol" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-sm font-bold tracking-[0.18em] uppercase md:text-base">
            Diamond Hands
          </span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {link("/", "Vaults")}
          {link("/create", "Deploy")}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <NetworkSelector />
          <ThemeToggle />
          <ConnectKitButton />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { version, setVersion } = useProtocolVersion();

  const versionButton = (v: ProtocolVersion, label: string, tag?: string) => {
    const active = version === v;
    // invariant: every version has a Base Sepolia entry — never index mainnet here
    const legacy = DEPLOYMENTS[v][BASE_SEPOLIA_ID].status === "legacy";
    return (
      <button
        key={v}
        onClick={() => setVersion(v)}
        aria-pressed={active}
        title={
          legacy
            ? "Legacy deployment — superseded by the v1.3.0 unclaimed-IOU fix. For comparison only."
            : "Current deployment"
        }
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition ${
          active ? "bg-ice text-[#04182e]" : "text-ink-faint hover:text-ink"
        }`}
      >
        {label}
        {tag && (
          <span
            className={`rounded px-1 py-px text-[9px] font-bold leading-tight tracking-normal ${
              legacy ? "bg-amber-200/20 text-amber-300" : "bg-black/10 text-[#04182e]"
            }`}
          >
            {tag}
          </span>
        )}
      </button>
    );
  };

  return (
    <footer className="mt-16 border-t border-line/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-[11px] tracking-[0.12em] uppercase text-ink-faint">
        <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-card p-1 text-[10px]">
          {PROTOCOL_VERSIONS.map((v) =>
            v === "v1.3.0" ? versionButton(v, "Contracts v1.3.0") : versionButton(v, v, v === "v1.2.2" ? "legacy" : undefined)
          )}
        </div>
        <span>Protocol status: immutable</span>
        <span>Security level: zero-key</span>
        <a href="https://cryptosi-dao.github.io/diamond-landing/" className="hover:text-ice" target="_blank" rel="noreferrer">
          Lore ↗
        </a>
        <a href="https://github.com/CryptoSI-DAO/diamond-hands-protocol" className="hover:text-ice" target="_blank" rel="noreferrer">
          Contracts ↗
        </a>
      </div>
    </footer>
  );
}
