"use client";

import Link from "next/link";
import { Header, Footer } from "@/components/Header";
import { useVaultList } from "@/lib/useVaultList";
import { fmtPct, fmtUnits } from "@/lib/format";

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

        {/* global stats */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Stat label="Vaults deployed" value={String(vaults.length)} />
          <Stat label="Total value locked" value={loading ? "—" : `${fmtUnits(totalTvl, 18, 2)} ∑`} />
          <Stat label="Security level" value="Zero-key" accent />
        </div>

        {/* grid */}
        {!configured && (
          <div className="card mt-8 p-8 text-center">
            <div className="font-display text-lg font-semibold">Contracts not wired yet</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-dim">
              Awaiting the v1.2.2 redeploy to Base Sepolia. Addresses land in{" "}
              <code className="text-ice">src/lib/addresses.ts</code> — the UI is live
              and will read the chain the moment they&apos;re set.
            </p>
            <Link href="/create" className="btn-primary mt-5 inline-block px-6 py-2.5 text-sm">
              Deploy a vault →
            </Link>
          </div>
        )}

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
