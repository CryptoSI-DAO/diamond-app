"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { BASE_MAINNET_ID, BASE_SEPOLIA_ID, DEPLOYMENTS, preferredChainId, PROTOCOL_VERSIONS, type ProtocolVersion } from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { ThemeToggle } from "@/components/ThemeToggle";

const ETHEREUM_SEPOLIA_ID = 11155111;

const chainName = (id: number) =>
  id === BASE_SEPOLIA_ID
    ? "Base Sepolia"
    : id === BASE_MAINNET_ID
      ? "Base Mainnet"
      : id === ETHEREUM_SEPOLIA_ID
        ? "Ethereum Sepolia"
        : "Unsupported network";

function NetworkSelector() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { version } = useProtocolVersion();
  const target = preferredChainId(version); // mainnet once live, else Sepolia
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!isConnected) return null;

  const onBaseSepolia = chainId === BASE_SEPOLIA_ID;
  const wrong = chainId !== target;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Select network"
        aria-expanded={open}
        className={`pill cursor-pointer transition ${
          wrong
            ? "!border-fee/60 !bg-fee/10 !text-fee hover:!border-fee"
            : "hover:!border-ice/60"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${wrong ? "animate-pulse" : ""}`}
          style={{ background: onBaseSepolia ? "#ffb547" : "#ffb4ab" }}
        />
        <span className="hidden sm:inline">{chainName(chainId)}</span>
        <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-64 p-2 text-left">
          <div className="label px-2 pb-1 pt-0.5">Networks</div>

          <button
            onClick={() => {
              if (!onBaseSepolia) switchChain({ chainId: BASE_SEPOLIA_ID });
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/5 ${
              onBaseSepolia ? "cursor-default" : ""
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#ffb547" }} />
            <span className="flex-1 text-sm font-semibold">Base Sepolia</span>
            <span className="pill !px-2 !py-0.5 !text-[9px] text-ice">TESTNET</span>
            {onBaseSepolia && <span className="text-ice">✓</span>}
          </button>

          {/* Enabled only when the active version holds real mainnet contracts;
              the zero-address placeholder stays unclickable. */}
          {target === BASE_MAINNET_ID ? (
            <button
              onClick={() => {
                if (chainId !== BASE_MAINNET_ID) switchChain({ chainId: BASE_MAINNET_ID });
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/5"
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#4da3ff" }} />
              <span className="flex-1 text-sm font-semibold">Base Mainnet</span>
              <span className="pill !px-2 !py-0.5 !text-[9px] text-ice">LIVE</span>
              {chainId === BASE_MAINNET_ID && <span className="text-ice">✓</span>}
            </button>
          ) : (
            <div className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-2 py-2.5 opacity-40">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#4da3ff" }} />
              <span className="flex-1 text-sm font-semibold">Base Mainnet</span>
              <span className="pill !px-2 !py-0.5 !text-[9px]">POST-AUDIT</span>
            </div>
          )}

          {wrong && (
            <p className="px-2 pb-1 pt-2 text-[11px] leading-relaxed text-ink-faint">
              Contracts live on {target === BASE_MAINNET_ID ? "Base Mainnet" : "Base Sepolia"} only — you&apos;re on{" "}
              <span className="text-fee">{chainName(chainId)}</span>. Tap{" "}
              {target === BASE_MAINNET_ID ? "Base Mainnet" : "Base Sepolia"}
              to switch; your wallet will add the network if it&apos;s missing.
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
          <ThemeToggle />
          <NetworkSelector />
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
    const legacy = DEPLOYMENTS[v][preferredChainId(v)].status === "legacy";
    return (
      <button
        key={v}
        onClick={() => setVersion(v)}
        aria-pressed={active}
        title={legacy ? "Legacy deployment — superseded by the v1.3.0 unclaimed-IOU fix. For comparison only." : "Current deployment"}
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
          {versionButton("v1.3.0", "Contracts v1.3.0")}
          {versionButton("v1.2.2", "v1.2.2", "legacy")}
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
