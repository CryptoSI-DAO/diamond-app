"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Header, Footer } from "@/components/Header";
import { useVaultList } from "@/lib/useVaultList";
import { useGlobalStats } from "@/lib/useGlobalStats";
import { fmtPct, fmtUnits, shortAddr } from "@/lib/format";
import {
  useBalance, useChainId, useSwitchChain,
} from "wagmi";
import {
  BASE_SEPOLIA_ID, CREATION_FEE_ETH, FACTORY, FEE_COLLECTOR, IMPLEMENTATION,
} from "@/lib/addresses";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-inner flex-1 px-5 py-4">
      <div className="label">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${accent ? "text-ice" : ""}`}>{value}</div>
    </div>
  );
}

export default function ExplorePage() {
  const { vaults, loading, configured } = useVaultList();
  const totalTvl = vaults.reduce((s, v) => s + v.totalAssets, 0n);
  const vAddrs = useMemo(() => vaults.map((v) => v.address), [vaults]);
  const { burnTotal, dividendsTotal, loading: statsLoading } = useGlobalStats(vAddrs);
  const dash = "—";

  // ── Protocol panel state (independent of wallet connection) ──────────────
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const onSepolia = chainId === BASE_SEPOLIA_ID;
  const sepoliaFactory = FACTORY[BASE_SEPOLIA_ID];

  // creation fee Treasury balance = protocol fees earned to date
  const feeBalance = useBalance({
    address: FEE_COLLECTOR[BASE_SEPOLIA_ID],
    chainId: BASE_SEPOLIA_ID,
  });
  const feeEth = feeBalance.data
    ? (Number(feeBalance.data.value) / 1e18).toFixed(3)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {/* breadcrumb + title */}
        <div className="label mb-2">Vaults</div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          The Conviction Registry
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-dim">
          Immutable vaults on Base. Enter and pay the ingress tax; exit and pay the
          friction. Either way — the diamonds get paid.
        </p>

        {/* global stats — the lore, live */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Tokens burned" value={statsLoading || !configured ? dash : burnTotal !== null ? `${fmtUnits(burnTotal, 18, 2)} ∑` : dash} accent />
          <Stat label="Dividends paid" value={statsLoading || !configured ? dash : dividendsTotal !== null ? `${fmtUnits(dividendsTotal, 18, 2)} ∑` : dash} accent />
          <Stat label="Vaults deployed" value={configured ? String(vaults.length) : dash} />
          <Stat label="Total value locked" value={configured && !loading ? `${fmtUnits(totalTvl, 18, 2)} ∑` : dash} />
          <Stat label="Security level" value="Zero-key" />
        </div>

        {/* protocol status panel — live contract facts, works without a wallet */}
        <section className="card mt-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-display text-lg font-semibold">Protocol status</div>
            <span className="pill !text-[10px] text-ice">
              {onSepolia ? "TESTNET — BASE SEPOLIA" : "READ-ONLY — CONNECT TO SEPOLIA"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card-inner px-4 py-3">
              <div className="label">Factory</div>
              <a
                href={`https://sepolia.basescan.org/address/${sepoliaFactory}`}
                target="_blank"
                rel="noreferrer"
                className="num mt-1 block text-sm text-ice hover:underline"
              >
                {shortAddr(sepoliaFactory)} ↗
              </a>
            </div>
            <div className="card-inner px-4 py-3">
              <div className="label">Vaults deployed</div>
              <div className="num mt-1 text-lg font-bold">
                {configured ? String(vaults.length) : "—"}
              </div>
            </div>
            <div className="card-inner px-4 py-3">
              <div className="label">Creation fee</div>
              <div className="num mt-1 text-lg font-bold">{CREATION_FEE_ETH} ETH</div>
            </div>
            <div className="card-inner px-4 py-3">
              <div className="label">Protocol fees earned</div>
              <div className="num mt-1 text-lg font-bold">
                {feeEth !== null ? `${feeEth} ETH` : "—"}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            v1.2.2 · five sequential self-audits, 70/70 tests passing, Sourcify
            exact-match · implementation{" "}
            <a
              href={`https://sepolia.basescan.org/address/${IMPLEMENTATION[BASE_SEPOLIA_ID]}`}
              target="_blank"
              rel="noreferrer"
              className="text-ice hover:underline"
            >
              {shortAddr(IMPLEMENTATION[BASE_SEPOLIA_ID])} ↗
            </a>{" "}
            · fee collector{" "}
            <a
              href={`https://sepolia.basescan.org/address/${FEE_COLLECTOR[BASE_SEPOLIA_ID]}`}
              target="_blank"
              rel="noreferrer"
              className="text-ice hover:underline"
            >
              {shortAddr(FEE_COLLECTOR[BASE_SEPOLIA_ID])} ↗
            </a>
          </p>

          {!onSepolia && (
            <button
              onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })}
              className="btn-primary mt-4 px-5 py-2 text-sm"
            >
              Switch to Base Sepolia
            </button>
          )}
        </section>

        {/* grid */}
        {configured && loading && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-52 animate-pulse" />
            ))}
          </div>
        )}

        {configured && !loading && vaults.length === 0 && (
          <div className="card mt-8 p-10 text-center">
            <div className="font-display text-xl font-semibold">No vaults yet</div>
            <p className="mt-2 text-sm text-ink-dim">
              The registry is empty. Be the first diamond hand.
            </p>
            <Link href="/create" className="btn-primary mt-5 inline-block px-6 py-2.5 text-sm">
              Deploy the first vault →
            </Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vaults.map((v) => {
            const price =
              v.totalSupply > 0n
                ? Number((v.totalAssets * 10n ** 18n) / v.totalSupply) / 1e18
                : 1;
            return (
              <Link
                key={v.address}
                href={`/vault/${v.address}`}
                className="card group p-5 transition hover:border-ice/60"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold">{v.symbol}</span>
                  <span className="pill">dh{v.symbol}</span>
                </div>
                <div className="num mt-4 text-3xl font-bold">{price.toFixed(4)}</div>
                <div className="label mt-1">share price</div>
                <div className="mt-4 flex items-center gap-4 border-t border-line/40 pt-3 text-xs text-ink-faint">
                  <span>
                    IN <span className="num text-ink">{fmtPct(v.entryTaxBps)}</span>
                  </span>
                  <span>
                    EXIT <span className="num text-danger">{fmtPct(v.exitTaxBps)}</span>
                  </span>
                  <span className="ml-auto num text-ink-dim">
                    {fmtUnits(v.totalAssets, v.decimals, 2)} {v.symbol}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
