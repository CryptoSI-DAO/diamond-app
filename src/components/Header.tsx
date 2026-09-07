"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";
import { useAccount, useChainId } from "wagmi";
import { BASE_MAINNET_ID, BASE_SEPOLIA_ID } from "@/lib/addresses";

function ChainDot() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  if (!isConnected) return null;
  const name = chainId === BASE_MAINNET_ID ? "Base" : chainId === BASE_SEPOLIA_ID ? "Base Sepolia" : "Wrong network";
  const color = chainId === BASE_MAINNET_ID ? "#4da3ff" : chainId === BASE_SEPOLIA_ID ? "#ffb547" : "#ffb4ab";
  return (
    <span className="pill hidden sm:inline-flex">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
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
          <img src="/gem-mark.svg" alt="" className="h-7 w-7" />
          <span className="font-display text-sm font-bold tracking-[0.18em] uppercase md:text-base">
            Diamond Hands
          </span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {link("/", "Vaults")}
          {link("/create", "Deploy")}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ChainDot />
          <ConnectKitButton />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-[11px] tracking-[0.12em] uppercase text-ink-faint">
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
