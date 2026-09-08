"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Header, Footer } from "@/components/Header";
import { TxModal, type TxPhase } from "@/components/TxModal";
import {
  useAccount, useChainId, usePublicClient, useWatchContractEvent,
  useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract,
} from "wagmi";
import { parseAbiItem, decodeEventLog } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi, vaultAbi } from "@/lib/abis";
import { errorToCopy } from "@/lib/errors";
import { fmtPct, fmtUnits, parseUnits, shortAddr } from "@/lib/format";

const BPS = 10_000n;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const TAX_EVENT = parseAbiItem(
  "event TaxCollected(uint8 kind, uint256 gross, uint256 dividends, uint256 burned, uint256 protocolFee)"
);

type StreamItem = { kind: string; gross: bigint; dividends: bigint; burned: bigint; fee: bigint; tx: string };

function Stat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="card-inner flex-1 px-4 py-3">
      <div className="label">{label}</div>
      <div className={`num mt-1 text-xl font-bold ${accent ? "text-ice" : danger ? "text-danger" : ""}`}>{value}</div>
    </div>
  );
}

export default function VaultPage() {
  const { token: vault } = useParams<{ token: string }>();
  const addr = vault as `0x${string}`;
  const { address: user } = useAccount();
  const chainId = useChainId();
  const pc = usePublicClient();

  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [minOut, setMinOut] = useState("");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [lastAction, setLastAction] = useState<"approve" | "deposit" | "redeem" | "withdraw" | null>(null);
  const [modal, setModal] = useState<{ headline?: string; big?: string; unit?: string; rows?: [string, string][]; error?: string }>({});
  const [stream, setStream] = useState<StreamItem[]>([]);

  const core = useReadContracts({
    allowFailure: true,
    query: { enabled: !!addr },
    contracts: [
      { abi: vaultAbi, address: addr, functionName: "asset" },
      { abi: vaultAbi, address: addr, functionName: "totalAssets" },
      { abi: vaultAbi, address: addr, functionName: "totalSupply" },
      { abi: vaultAbi, address: addr, functionName: "totalBurned" },
      { abi: vaultAbi, address: addr, functionName: "entryTaxBps" },
      { abi: vaultAbi, address: addr, functionName: "exitTaxBps" },
      { abi: vaultAbi, address: addr, functionName: "dividendShareBps" },
      { abi: vaultAbi, address: addr, functionName: "totalDividendsDistributed" },
      { abi: vaultAbi, address: addr, functionName: "balanceOf", args: [user ?? ZERO] },
      { abi: vaultAbi, address: addr, functionName: "rewards", args: [user ?? ZERO] },
    ] as const,
  });

  const assetAddr = core.data?.[0]?.result as `0x${string}` | undefined;
  const totalAssets = (core.data?.[1]?.result as bigint) ?? 0n;
  const totalSupply = (core.data?.[2]?.result as bigint) ?? 0n;
  const totalBurned = (core.data?.[3]?.result as bigint) ?? 0n;
  const entryBps = (core.data?.[4]?.result as number) ?? 0;
  const exitBps = (core.data?.[5]?.result as number) ?? 0;
  const divBps = (core.data?.[6]?.result as number) ?? 0;
  const divPaid = (core.data?.[7]?.result as bigint) ?? 0n;
  const myShares = (core.data?.[8]?.result as bigint) ?? 0n;
  const myRewards = (core.data?.[9]?.result as bigint) ?? 0n;

  const tok = useReadContracts({
    allowFailure: true,
    query: { enabled: !!assetAddr },
    contracts: [
      { abi: erc20Abi, address: assetAddr!, functionName: "symbol" },
      { abi: erc20Abi, address: assetAddr!, functionName: "decimals" },
      { abi: erc20Abi, address: assetAddr!, functionName: "balanceOf", args: [user ?? ZERO] },
      { abi: erc20Abi, address: assetAddr!, functionName: "allowance", args: [user ?? ZERO, addr] },
    ] as const,
  });

  const symbol = (tok.data?.[0]?.result as string) ?? "—";
  const dec = (tok.data?.[1]?.result as number) ?? 18;
  const walletBal = (tok.data?.[2]?.result as bigint) ?? 0n;
  const allowance = (tok.data?.[3]?.result as bigint) ?? 0n;

  const amt = useMemo(() => parseUnits(amount, dec), [amount, dec]);
  const valid = amt > 0n;

  const preview = useReadContract({
    abi: vaultAbi,
    address: addr,
    functionName: tab === "deposit" ? "previewDeposit" : "previewRedeem",
    args: [amt],
    query: { enabled: valid },
  });
  const previewed = (preview.data as bigint) ?? 0n;

  const sharePrice = totalSupply > 0n ? Number((totalAssets * 10n ** 18n) / totalSupply) / 1e18 : 1;

  // dividend stream: recent TaxCollected logs + live tail
  useEffect(() => {
    if (!pc || !addr) return;
    let alive = true;
    (async () => {
      try {
        const tip = await pc.getBlockNumber();
        const from = tip > 50_000n ? tip - 50_000n : 0n;
        const logs = await pc.getLogs({ address: addr, event: TAX_EVENT, fromBlock: from, toBlock: "latest" });
        if (!alive) return;
        const items = logs
          .slice(-8)
          .reverse()
          .map((l) => {
            const a = l.args as unknown as { kind: number; gross: bigint; dividends: bigint; burned: bigint; protocolFee: bigint };
            return {
              kind: a.kind === 0 ? "Entry tax" : "Exit friction",
              gross: a.gross, dividends: a.dividends, burned: a.burned, fee: a.protocolFee,
              tx: l.transactionHash ?? "",
            };
          });
        setStream(items);
      } catch {
        /* stream is decorative — fail quiet */
      }
    })();
    return () => { alive = false; };
  }, [pc, addr]);

  useWatchContractEvent({
    address: addr,
    abi: vaultAbi,
    eventName: "TaxCollected",
    onLogs(logs) {
      for (const l of logs) {
        const a = l.args as unknown as { kind: number; gross: bigint; dividends: bigint; burned: bigint; protocolFee: bigint };
        setStream((s) =>
          [
            { kind: a.kind === 0 ? "Entry tax" : "Exit friction", gross: a.gross, dividends: a.dividends, burned: a.burned, fee: a.protocolFee, tx: l.transactionHash ?? "" },
            ...s,
          ].slice(0, 8)
        );
      }
    },
  });

  const w = useWriteContract();
  const rct = useWaitForSafe(w.data);
  const claim = useWriteContract();
  const claimRct = useWaitForSafe(claim.data);
  const qc = useQueryClient();

  // auto-refresh: any landing tx invalidates every read so balances, shares,
  // dividends and allowance all snap to chain truth without a manual reload
  useEffect(() => {
    if (rct.isSuccess || claimRct.isSuccess) {
      qc.invalidateQueries();
    }
  }, [rct.isSuccess, claimRct.isSuccess, qc]);

  const needsApprove = tab === "deposit" && allowance < amt;
  const needsApprovalFresh =
    lastAction === "approve" && !needsApprove && amt > 0n;

  const bd = useMemo(() => {
    if (!valid) return null;
    if (tab === "deposit") {
      const tax = (amt * BigInt(entryBps)) / BPS;
      const div = (tax * BigInt(divBps)) / BPS;
      const fee = (tax * 50n) / BPS;
      return { tax, div, fee, burn: tax - div - fee, out: previewed, outDec: 18, outLabel: "shares" };
    }
    const grossOut = previewed;
    const tax = (grossOut * BigInt(exitBps)) / (BPS - BigInt(exitBps));
    return { tax, div: 0n, fee: 0n, burn: 0n, out: grossOut, outDec: dec, outLabel: symbol };
  }, [valid, tab, amt, entryBps, exitBps, divBps, previewed, symbol, dec]);

  function go() {
    if (!user || !valid) return;
    setPhase("confirming");
    setModal({});
    setLastAction(needsApprove ? "approve" : tab);
    const onSuccess = () => {
      // writeContract resolves on broadcast — real numbers are decoded from
      // the receipt logs in the rct effect below
      setPhase("pending");
    };
    const onError = (e: unknown) => {
      setPhase("error");
      setModal({ error: errorToCopy(e) });
    };
    // Explicit gas ceiling: some wallet RPC configs return wild estimates and
    // the public endpoint rejects them with "exceeds max transaction gas limit".
    // Estimating ourselves against our own transport keeps the tx sane.
    const withGas = (call: Record<string, unknown>) => {
      void (async () => {
        let gas: bigint | undefined;
        try {
          gas = await pc!.estimateContractGas({
          ...call,
          account: user,
        } as never);
          gas = (gas * 120n) / 100n; // +20% headroom
        } catch {
          /* leave undefined — wallet falls back to its own estimate */
        }
        w.writeContract(
          { ...call, ...(gas ? { gas } : {}) } as never,
          { onSuccess, onError } as never
        );
      })();
    };
    try {
      if (needsApprove) {
        void withGas({ address: assetAddr!, abi: erc20Abi, functionName: "approve", args: [addr, amt] } as never);
      } else if (tab === "deposit") {
        void withGas({ address: addr, abi: vaultAbi, functionName: "deposit", args: [amt, user] } as never);
      } else {
        void withGas({ address: addr, abi: vaultAbi, functionName: "redeem", args: [amt, user, user] } as never);
      }
    } catch {
      setPhase("error");
      setModal({ error: "Could not open wallet." });
    }
  }

  useEffect(() => {
    if (w.error) {
      setPhase("error");
      setModal({ error: errorToCopy(w.error) });
    } else if (rct.error) {
      setPhase("error");
      setModal({ error: errorToCopy(rct.error) });
    } else if (rct.isSuccess && rct.data) {
      if (lastAction === "approve") {
        setPhase("idle"); // approved; deposit is next, reads already invalidated
        return;
      }
      // decode the real event from receipt logs — writeContract only ever
      // hands back the tx hash, never the function's return value
      let headline = "Diamond Hands Confirmed";
      let big: string | undefined;
      let unit: string | undefined;
      let rows: [string, string][] | undefined;
      for (const log of rct.data.logs) {
        try {
          const ev = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "Deposit") {
            const a = ev.args as unknown as { assets: bigint; shares: bigint };
            big = fmtUnits(a.shares, 18, 2);
            unit = "shares";
            rows = [["Ingress tax", fmtPct(entryBps)], ["Paid to the pool", fmtPct(divBps)]];
            break;
          }
          if (ev.eventName === "Withdraw") {
            const a = ev.args as unknown as { assets: bigint };
            headline = "Exit confirmed";
            big = fmtUnits(a.assets, dec, 4);
            unit = symbol;
            rows = [["Exit friction", fmtPct(exitBps)], ["The diamonds thank you", "🔥"]];
            break;
          }
        } catch { /* unrelated log — skip */ }
      }
      setModal({ headline, big, unit, rows });
      setPhase("success");
      // land back on the refreshed vault — invalidateQueries() has already
      // refetched every position read, so close the modal after a beat
      setTimeout(() => {
        setPhase("idle");
        setModal({});
        setAmount("");
        setLastAction(null);
      }, 2600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.error, rct.error, rct.isSuccess, rct.data]);

  function doClaim() {
    if (!user) return;
    claim.writeContract({
      address: addr, abi: vaultAbi, functionName: "claimDividend",
      args: [minOut ? parseUnits(minOut, dec) : 0n],
    });
  }

  const busy = w.isPending || rct.isLoading;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="label mb-2">
          Vaults / <span className="text-ice">{shortAddr(addr)}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              {symbol} / dh{symbol} vault
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-dim">
              Immutable conviction vault. Ingress tax streams to stakers; exit
              friction punishes paper hands. Zero admin keys.
            </p>
          </div>
        </div>

        {/* stats bar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Stat label="Ingress tax" value={fmtPct(entryBps)} />
          <Stat label="Exit friction" value={fmtPct(exitBps)} danger />
          <Stat label="Vault TVL" value={`${fmtUnits(totalAssets, dec, 2)} ${symbol}`} />
          <Stat label="Share price" value={sharePrice.toFixed(4)} accent />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* LEFT: action panel */}
          <section className="card p-6 lg:col-span-3">
            <div className="mb-5 flex rounded-full border border-line/60 bg-surface-dim p-1 text-xs font-semibold uppercase tracking-widest">
              {(["deposit", "withdraw"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setAmount(""); }}
                  className={`flex-1 rounded-full py-2.5 transition ${
                    tab === t ? "bg-ice text-[#04182e]" : "text-ink-faint hover:text-ink"
                  }`}
                >
                  {t === "deposit" ? "Deposit & lock" : "Withdraw"}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="label">{tab === "deposit" ? "Deposit amount" : "Shares to redeem"}</span>
              <span className="num text-xs text-ink-dim">
                {tab === "deposit" ? `Wallet: ${fmtUnits(walletBal, dec, 4)} ${symbol}` : `Yours: ${fmtUnits(myShares, 18, 4)} shares`}
              </span>
            </div>
            <div className="card-inner mt-2 flex items-center gap-3 px-5 py-4">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.0"
                className="num w-full bg-transparent text-3xl font-bold outline-none"
              />
              <span className="font-display font-semibold">{tab === "deposit" ? symbol : "shares"}</span>
              <button
                className="btn-ghost px-3 py-1 text-xs uppercase tracking-widest"
                onClick={() => setAmount(fmtUnits(tab === "deposit" ? walletBal : myShares, tab === "deposit" ? dec : 18, 6))}
              >
                Max
              </button>
            </div>

            {/* exit-friction preview note (always shown, honest) */}
            <div className="mt-4 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-xs" style={{ color: "var(--color-danger)" }}>
              ⚠ Exit friction: {fmtPct(exitBps)} penalty is split to stakers, the fee sink, and the burn — charged when you leave.
            </div>

            {/* tax breakdown */}
            {bd && (
              <div className="card-inner mt-5 px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="label text-ice">Tax breakdown // {fmtPct(tab === "deposit" ? entryBps : exitBps)} deduction</span>
                  <span className="label">live preview</span>
                </div>
                <div className="num mt-4 space-y-2.5 text-sm">
                  {tab === "deposit" ? (
                    <>
                      <Line k={`Entry tax → staker dividends`} badge={fmtPct(entryBps)} v={`+${fmtUnits(bd.div, dec, 4)} ${symbol}`} />
                      <Line k="Protocol reserve fee" badge="0.50%" v={`+${fmtUnits(bd.fee, dec, 4)} ${symbol}`} />
                      <Line k="🔥 Conviction burn" badge={`${fmtPct(entryBps - divBps - 50)}`} v={`+${fmtUnits(bd.burn, dec, 4)} ${symbol}`} />
                    </>
                  ) : (
                    <>
                      <Line k="Gross position value" v={`${fmtUnits(bd.out + bd.tax, dec, 4)} ${symbol}`} />
                      <Line k="Exit friction" badge={fmtPct(exitBps)} v={`−${fmtUnits(bd.tax, dec, 4)} ${symbol}`} danger />
                    </>
                  )}
                </div>
                <div className="mt-4 flex items-baseline justify-between border-t border-line/50 pt-3">
                  <span className="label">{tab === "deposit" ? "Net minted position" : "You receive"}</span>
                  <span className="num text-2xl font-bold text-ice">
                    {fmtUnits(bd.out, bd.outDec, 4)}{" "}
                    <span className="text-sm">{bd.outLabel}</span>
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={go}
              disabled={!user || !valid || busy || phase !== "idle"}
              className="btn-primary mt-5 w-full py-4 text-sm uppercase tracking-widest"
            >
              {!user
                ? "Connect wallet to continue"
                : busy
                ? "Working…"
                : needsApprove
                ? `Step 1/2 · Approve ${symbol}`
                : tab === "deposit"
                ? needsApprovalFresh
                  ? `Step 2/2 · Deposit ${fmtUnits(amt, dec, 2)} ${symbol} →`
                  : `Deposit ${fmtUnits(amt, dec, 2)} ${symbol} →`
                : `Step 1/1 · Redeem ${fmtUnits(amt, 18, 2)} shares →`}
            </button>
            {needsApprove && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-line/50 bg-surface-dim px-4 py-3 text-xs text-ink-dim">
                <span className="text-ice">①</span>
                <span>
                  Two signatures ahead. <b>1.</b> Approve the vault to pull your{" "}
                  {symbol} (ERC-20 standard, no fee leaves your wallet).{" "}
                  <b>2.</b> Deposit — automatically offered right after. This
                  prompt appears once per token.
                </span>
              </div>
            )}
            {!needsApprove && tab === "deposit" && needsApprovalFresh && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-line/50 bg-surface-dim px-4 py-3 text-xs text-ink-dim">
                <span className="text-ice">②</span>
                <span>
                  {symbol} approval confirmed — the deposit is the final
                  signature and moves your tokens into the vault.
                </span>
              </div>
            )}
            <div className="mt-3 text-center text-[11px] tracking-wider text-ink-faint uppercase">
              Simulation runs before every signature
            </div>
          </section>

          {/* RIGHT: position + stream */}
          <aside className="space-y-6 lg:col-span-2">
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <span className="label">Your position</span>
                {myShares > 0n && <span className="pill text-ice">Active stake</span>}
              </div>
              <div className="num mt-4 text-3xl font-bold">{fmtUnits(myShares, 18, 4)}</div>
              <div className="label mt-1">shares</div>
              <div className="num mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="card-inner px-4 py-3">
                  <div className="label">Share of pool</div>
                  <div className="num mt-1 font-bold">
                    {totalSupply > 0n ? `${((Number(myShares) / Number(totalSupply)) * 100).toFixed(3)}%` : "—"}
                  </div>
                </div>
                <div className="card-inner px-4 py-3">
                  <div className="label">Position value</div>
                  <div className="num mt-1 font-bold">
                    {fmtUnits((myShares * totalAssets) / (totalSupply || 1n), dec, 4)} {symbol}
                  </div>
                </div>
              </div>
              <div className="mt-5 border-t border-line/50 pt-4">
                <div className="flex items-center justify-between">
                  <span className="label">Unclaimed dividends</span>
                  <span className="num font-bold text-ice">{fmtUnits(myRewards, dec, 4)} {symbol}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={minOut}
                    onChange={(e) => setMinOut(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="min out (0 = none)"
                    className="num w-36 rounded-full border border-line/60 bg-surface-dim px-4 py-2 text-xs outline-none focus:border-ice"
                  />
                  <button
                    onClick={doClaim}
                    disabled={!user || myRewards === 0n || claim.isPending || claimRct.isLoading}
                    className="btn-primary flex-1 py-2.5 text-xs uppercase tracking-widest disabled:opacity-40"
                  >
                    Claim dividends
                  </button>
                </div>
                {claim.error && <p className="mt-2 text-xs" style={{ color: "var(--color-danger)" }}>{errorToCopy(claim.error)}</p>}
                {claimRct.isSuccess && <p className="mt-2 text-xs text-ice">Dividends claimed ✓</p>}
              </div>
            </section>

            <section className="card p-6">
              <div className="flex items-center justify-between">
                <span className="label">Dividend stream</span>
                <span className="pill text-ice">● live</span>
              </div>
              <div className="num mt-4 space-y-3 text-sm">
                {stream.length === 0 && (
                  <div className="text-xs text-ink-faint">No tax events yet. The pool awaits its first paper hand.</div>
                )}
                {stream.map((s, i) => (
                  <div key={`${s.tx}-${i}`} className="flex items-center justify-between border-b border-line/30 pb-3 last:border-0">
                    <div>
                      <div className="font-bold">
                        +{fmtUnits(s.dividends, dec, 4)} {symbol}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-faint">
                        {s.kind} · burn {fmtUnits(s.burned, dec, 2)} · fee {fmtUnits(s.fee, dec, 2)}
                      </div>
                    </div>
                    {s.tx && (
                      <a
                        href={`https://${chainId === 845 ? "basescan" : "base-sepolia.blockscout"}.${chainId === 845 ? "org" : "com"}/tx/${s.tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ice"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line/40 pt-3 text-[11px] tracking-wider uppercase text-ink-faint">
                <span>Total distributed</span>
                <span className="num text-ink">{fmtUnits(divPaid, dec, 2)} {symbol}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] tracking-wider uppercase text-ink-faint">
                <span>Total burned</span>
                <span className="num text-ink">🔥 {fmtUnits(totalBurned, dec, 2)} {symbol}</span>
              </div>
            </section>
          </aside>
        </div>
      </main>
      <Footer />

      <TxModal
        phase={phase}
        hash={w.data}
        headline={modal.headline}
        bigNumber={modal.big}
        bigUnit={modal.unit}
        rows={modal.rows}
        error={modal.error}
        onClose={() => { setPhase("idle"); setModal({}); }}
      />
    </div>
  );
}

function Line({ k, v, badge, danger }: { k: string; v: string; badge?: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-dim">
        {k} {badge && <span className="pill ml-1 !px-2 !py-0.5 !text-[10px]">{badge}</span>}
      </span>
      <span className={danger ? "text-danger" : ""}>{v}</span>
    </div>
  );
}

function useWaitForSafe(hash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({ hash });
}
