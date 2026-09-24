"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Header, Footer } from "@/components/Header";
import { useVaultList, type VaultSummary } from "@/lib/useVaultList";
import { useVaultCreators } from "@/lib/useVaultCreators";
import { TokenIcon } from "@/components/TokenIcon";
import { fmtPct, fmtUnits, shortAddr } from "@/lib/format";
import {
  useAccount, useBalance, useChainId, useSwitchChain,
} from "wagmi";
import {
  BASE_MAINNET_ID, chainLabel, creationFeeEth, CURATOR_ADDRESS, deploymentFor, explorerAddrUrl,
} from "@/lib/addresses";
import { useProtocolVersion } from "@/lib/version";
import { useViewChain } from "@/components/ViewChainProvider";

export default function ExplorePage() {
  const { vaults, loading, configured } = useVaultList();
  const vAddrs = useMemo(() => vaults.map((v) => v.address), [vaults]);
  const { creatorsByVault } = useVaultCreators(vAddrs);
  // ── Curation toggle: default CURATED (vaults created by the CryptoSI-DAO
  // curator wallet), "All" shows everything. Derived from VaultCreated logs —
  // on-chain, not a hand-list. v2.0.0 adds self-curation registries.
  const [curatedOnly, setCuratedOnly] = useState(true);
  const [showCuratedInfo, setShowCuratedInfo] = useState(false);
  const isCurated = (v: VaultSummary) =>
    creatorsByVault[v.address.toLowerCase()]?.from.toLowerCase() === CURATOR_ADDRESS.toLowerCase();
  const shown = curatedOnly ? vaults.filter(isCurated) : vaults;

  // ── Protocol panel state (independent of wallet connection) ──────────────
  const { version, deployment } = useProtocolVersion();
  const { viewChainId } = useViewChain();
  const walletChainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const wrongWalletChain = isConnected && walletChainId !== viewChainId;
  const connectedOnView = isConnected && walletChainId === viewChainId;
  const viewDeployment =
    deploymentFor(version, viewChainId) ?? deployment; // view chain's contracts (registry-guaranteed)
  const onBase = viewChainId === BASE_MAINNET_ID;

  // creation fee Treasury balance = protocol fees earned to date (view chain)
  const feeBalance = useBalance({
    address: viewDeployment.feeCollector,
    chainId: viewChainId,
  });
  const feeEth = feeBalance.data
    ? (Number(feeBalance.data.value) / 1e18).toFixed(3)
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {/* breadcrumb */}
        <div className="label mb-2">Vaults</div>

        {/* featured vault slots — curated showcase; fills as vaults land */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { tag: "BLUE-CHIP" },
            { tag: "MEMECOIN" },
            { tag: "COMMUNITY" },
          ].map((f) => (
            <div key={f.tag} className="card-inner featured-glow flex flex-col gap-2 px-5 py-5">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card-3 text-sm text-ice">◆</span>
                <span className="pill !px-2 !py-0.5 !text-[9px] text-ink-faint">COMING SOON</span>
              </div>
              <div className="label !text-[10px] text-ice">{f.tag}</div>
              <div className="text-sm text-ink-faint">Curated DHP vault</div>
            </div>
          ))}
          <Link
            href="/create"
            className="card-inner group flex flex-col gap-2 px-5 py-5 transition hover:border-ice/60"
            style={{ borderStyle: "dashed" }}
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ice/10 text-sm text-ice">＋</span>
            </div>
            <div className="label !text-[10px] text-ice">Have your vault featured?</div>
            <div className="text-sm text-ink-faint">
              Deploy one and pitch the DAO curator.{" "}
              <span className="text-ice transition group-hover:underline">Deploy yours →</span>
            </div>
          </Link>
        </div>

        {/* protocol status panel — live contract facts, works without a wallet */}
        <section className="card mt-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-display text-lg font-semibold">Protocol status</div>
            <span className="pill !text-[10px] text-ice">
              {connectedOnView
                ? `${onBase ? "MAINNET — BASE" : `MAINNET — ${chainLabel(viewChainId).toUpperCase()}`} · ${version}`
                : wrongWalletChain
                  ? `VIEWING ${chainLabel(viewChainId).toUpperCase()} — WALLET ON ${chainLabel(walletChainId).toUpperCase()}`
                  : `READ-ONLY — BROWSING ${chainLabel(viewChainId).toUpperCase()} · ${version}`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card-inner px-4 py-3">
              <div className="label">Factory</div>
              <a
                href={explorerAddrUrl(viewChainId, viewDeployment.factory)}
                target="_blank"
                rel="noreferrer"
                className="num mt-1 block text-sm text-ice hover:underline"
              >
                {shortAddr(viewDeployment.factory)} ↗
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
              <div className="num mt-1 text-lg font-bold">{creationFeeEth(version, viewChainId)} ETH</div>
            </div>
            <div className="card-inner px-4 py-3">
              <div className="label">Protocol fees earned</div>
              <div className="num mt-1 text-lg font-bold">
                {feeEth !== null ? `${feeEth} ETH` : "—"}
              </div>
            </div>
          </div>

          {wrongWalletChain && (
            <button
              onClick={() => switchChain({ chainId: viewChainId })}
              className="btn-primary mt-4 px-5 py-2 text-sm"
            >
              Switch wallet to {chainLabel(viewChainId)}
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

        {configured && !loading && vaults.length > 0 && curatedOnly && shown.length === 0 && (
          <div className="card mt-8 p-10 text-center">
            <div className="font-display text-xl font-semibold">No curated vaults yet</div>
            <p className="mt-2 text-sm text-ink-dim">
              Curated vaults are launched by CryptoSI-DAO — none on-chain at this
              address yet. Explore every vault in the meantime.
            </p>
            <button
              onClick={() => setCuratedOnly(false)}
              className="btn-primary mt-5 px-6 py-2.5 text-sm"
            >
              Show all vaults →
            </button>
          </div>
        )}

        {configured && vaults.length > 0 && shown.length > 0 && (
        <>
        {/* curation toggle */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-line bg-card p-1" role="tablist" aria-label="Vault curation filter">
            <button
              role="tab"
              aria-selected={curatedOnly}
              onClick={() => setCuratedOnly(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${curatedOnly ? "bg-ice text-surface" : "text-ink-dim hover:text-ink"}`}
            >
              Curated
            </button>
            <button
              role="tab"
              aria-selected={!curatedOnly}
              onClick={() => setCuratedOnly(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${!curatedOnly ? "bg-ice text-surface" : "text-ink-dim hover:text-ink"}`}
            >
              All vaults
            </button>
          </div>
          <button
            onClick={() => setShowCuratedInfo(true)}
            aria-label="What are curated vaults?"
            className="num flex h-6 w-6 items-center justify-center rounded-full border border-line text-xs text-ink-dim transition hover:border-ice hover:text-ice"
          >
            ?
          </button>
          <span className="label ml-auto">
            {shown.length} vault{shown.length === 1 ? "" : "s"} · {curatedOnly ? "curated by CryptoSI-DAO" : "everyone"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => {
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
                  <span className="flex items-center gap-3">
                    <TokenIcon address={v.asset} symbol={v.symbol} size={40} />
                    <span className="font-display text-lg font-bold">{v.symbol}</span>
                  </span>
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
        </>
        )}
      </main>

      {showCuratedInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setShowCuratedInfo(false)}
          role="dialog"
          aria-modal="true"
          aria-label="About curated vaults"
        >
          <div
            className="card relative w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCuratedInfo(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-dim transition hover:border-ice hover:text-ice"
            >
              ✕
            </button>
            <div className="eyebrow">Curation</div>
            <h3 className="font-display mt-1 text-xl font-bold">What are curated vaults?</h3>
            <p className="mt-3 text-sm text-ink-dim">
              To be listed in the <span className="font-semibold text-ink">Curated</span>{" "}
              section, a vault must be launched by <span className="text-ice">CryptoSI-DAO</span>.
              Curated vaults are trusted and contain real tokens.
            </p>
            <p className="mt-3 text-sm text-ink-dim">
              The &quot;All vaults&quot; tab lists everything deployed on the
              protocol — permissionless means permissionless. Verify what you
              deposit into; a vault listing is not an endorsement.
            </p>
            <div className="mt-4 rounded-lg border border-ice/30 bg-card-2 p-3 text-sm">
              <span className="font-semibold text-ice">v2.0.0 incoming:</span>{" "}
              <span className="text-ink-dim">
                various methods of self-curation will be available in version
                2.0.0 — which should be released very soon! Front-end operators
                will curate their own lists, on-chain.
              </span>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
