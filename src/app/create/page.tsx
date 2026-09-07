"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header, Footer } from "@/components/Header";
import { TxModal, type TxPhase } from "@/components/TxModal";
import {
  useChainId, usePublicClient, useReadContract, useReadContracts,
  useWriteContract,
} from "wagmi";
import { erc20Abi, factoryAbi, vaultAbi } from "@/lib/abis";
import { errorToCopy } from "@/lib/errors";
import { CREATION_FEE_ETH } from "@/lib/addresses";
import { fmtPct, shortAddr } from "@/lib/format";
import { useFactoryAddress } from "@/lib/useVaultList";

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

function Stepper({ label, desc, badge, value, set, max, minLabel, maxLabel }: {
  label: string; desc: string; badge: string;
  value: number; set: (n: number) => void; max: number;
  minLabel: string; maxLabel: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-sm font-bold tracking-wide uppercase">{label}</div>
          <div className="mt-1 text-xs text-ink-faint">{desc}</div>
        </div>
        <span className="pill !text-[10px] text-ice">{badge}</span>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => set(Math.max(0, value - 25))} className="btn-ghost h-10 w-10 text-lg">−</button>
        <div className="num text-4xl font-bold">
          {(value / 100).toFixed(1)}
          <span className="text-xl text-ice">%</span>
        </div>
        <button onClick={() => set(Math.min(max, value + 25))} className="btn-ghost h-10 w-10 text-lg">+</button>
      </div>
      <input
        type="range" min={0} max={max} step={25} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-4 w-full"
      />
      <div className="mt-1 flex justify-between text-[10px] tracking-wider uppercase text-ink-faint">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export default function CreatePage() {
  const { factory, configured } = useFactoryAddress();
  const pc = usePublicClient();
  const chainId = useChainId();
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [entryTax, setEntryTax] = useState(250);
  const [exitTax, setExitTax] = useState(1500);
  const [divShare, setDivShare] = useState(6500);
  const [fot, setFot] = useState(false);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<`0x${string}` | null>(null);

  // token probe
  const tok = useReadContracts({
    allowFailure: true,
    query: { enabled: isAddr(token) },
    contracts: [
      { abi: erc20Abi, address: token as `0x${string}`, functionName: "decimals" },
      { abi: erc20Abi, address: token as `0x${string}`, functionName: "symbol" },
    ] as const,
  });
  const dec = tok.data?.[0]?.result as number | undefined;
  const sym = tok.data?.[1]?.result as string | undefined;

  // already-vaulted check
  const count = useReadContract({
    abi: factoryAbi, address: configured ? factory : undefined, functionName: "vaultCount",
  });
  const n = count.data ? Number(count.data) : 0;
  const addrs = useReadContracts({
    allowFailure: false, query: { enabled: n > 0 },
    contracts: Array.from({ length: n }, (_, i) => ({
      abi: factoryAbi, address: factory!, functionName: "allVaultsAt", args: [BigInt(i)] as const,
    })),
  });
  const vAddrs = (addrs.data ?? []) as unknown as readonly `0x${string}`[];
  const assets = useReadContracts({
    allowFailure: true, query: { enabled: vAddrs.length > 0 && isAddr(token) },
    contracts: vAddrs.map((a) => ({ abi: vaultAbi, address: a, functionName: "asset" }) as const),
  });
  const alreadyVaulted = useMemo(() => {
    if (!isAddr(token)) return false;
    const t = token.toLowerCase();
    return vAddrs.some((_, i) => (assets.data?.[i]?.result as string | undefined)?.toLowerCase() === t);
  }, [token, vAddrs, assets.data]);

  useEffect(() => { setSymbol(sym ?? null); }, [sym]);

  const eligible = dec !== undefined && dec <= 18 && !alreadyVaulted;
  const dupErr = isAddr(token) && tok.isSuccess && dec === undefined;

  const w = useWriteContract();

  function submit() {
    if (!configured || !isAddr(token)) return;
    setPhase("confirming");
    setErr(null);
    w.writeContract(
      {
        address: factory,
        abi: factoryAbi,
        functionName: "createVault",
        args: [token as `0x${string}`, { entryTaxBps: entryTax, exitTaxBps: exitTax, dividendShareBps: divShare, acceptFeesFromTransfer: fot }],
        value: BigInt(Math.round(Number(CREATION_FEE_ETH) * 1e18)),
      },
      {
        onSuccess: async (vaultAddr: unknown) => {
          setPhase("pending");
          setDeployed(vaultAddr as `0x${string}`);
        },
        onError: (e: unknown) => {
          setPhase("error");
          setErr(errorToCopy(e));
        },
      } as never
    );
  }

  // receipt watch → success
  useEffect(() => {
    if (!w.data || !pc || deployed) return;
    let alive = true;
    (async () => {
      try {
        const r = await pc.waitForTransactionReceipt({ hash: w.data! });
        if (!alive) return;
        if (r.status === "success") {
          setPhase("success");
        } else {
          setPhase("error");
          setErr("Transaction reverted on-chain.");
        }
      } catch {
        /* user navigated away or timeout */
      }
    })();
    return () => { alive = false; };
  }, [w.data, pc, deployed]);

  const steps = ["Token", "Config", "Confirm"];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="label mb-2">Deploy</div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Vault parameters</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Fine-tune friction dynamics. One-time factory fee {CREATION_FEE_ETH} ETH.
        </p>

        {/* step rail */}
        <div className="mt-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest ${step > i ? "text-ice" : "text-ink-faint"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${step > i ? "border-ice bg-ice text-[#04182e]" : "border-line"}`}>
                  {step > i + 1 ? "✓" : i + 1}
                </span>
                {s}
              </div>
              {i < 2 && <div className={`h-px flex-1 ${step > i + 1 ? "bg-ice" : "bg-line"}`} />}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {step === 1 && (
            <div className="card p-6">
              <div className="label">Token contract (Base)</div>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                placeholder="0x…"
                className="num mt-2 w-full rounded-xl border border-line/60 bg-surface-dim px-4 py-3 text-sm outline-none focus:border-ice"
              />
              {isAddr(token) && tok.isPending && <p className="mt-3 text-sm text-ink-faint">Probing token…</p>}
              {dupErr && <p className="mt-3 text-sm" style={{ color: "var(--color-danger)" }}>No decimals() — not a standard ERC-20.</p>}
              {dec !== undefined && (
                <p className={`mt-3 text-sm ${eligible ? "text-ice" : "text-danger"}`}>
                  {alreadyVaulted
                    ? "This token already has a vault."
                    : `Decimals ${dec}${sym ? ` · ${sym}` : ""} — eligible ✓`}
                </p>
              )}
              <button
                disabled={!eligible}
                onClick={() => setStep(2)}
                className="btn-primary mt-5 w-full py-3 text-sm uppercase tracking-widest"
              >
                Next: configure →
              </button>
            </div>
          )}

          {step === 2 && (
            <>
              <Stepper label="Entry ingress tax" desc="Deducted on deposit, distributed to stakers." badge="Anti-dilution" value={entryTax} set={setEntryTax} max={1000} minLabel="0.0% min" maxLabel="10% hard cap" />
              <Stepper label="Premature exit friction" desc="Penalty on early unlock — punishes paper hands." badge="Diamond gate" value={exitTax} set={setExitTax} max={2500} minLabel="0.0% soft" maxLabel="25% max friction" />
              <Stepper label="Dividend redistribution" desc="Yield share redirected to long-term holders." badge="Yield sink" value={divShare} set={setDivShare} max={9000} minLabel="0% stakers only" maxLabel="90% conviction pool" />

              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-sm font-bold">Accept fee-on-transfer tokens</div>
                    <div className="mt-1 text-xs text-ink-faint">Enables custom reflection & burn compatibility.</div>
                  </div>
                  <button
                    onClick={() => setFot(!fot)}
                    className={`relative h-6 w-11 rounded-full transition ${fot ? "bg-ice" : "bg-line"}`}
                    aria-pressed={fot}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface-dim transition ${fot ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="mt-3 rounded-lg border border-fee/30 bg-fee/10 px-3 py-2 text-[11px]" style={{ color: "var(--color-fee)" }}>
                  ⓘ High-slippage tokens: shares are priced assuming full-value delivery. Use only for trusted hook tokens.
                </p>
              </div>

              {/* live preview */}
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="label text-ice">Preview // explore grid appearance</span>
                  <span className="pill !text-[10px]">live sync</span>
                </div>
                <div className="card-inner mt-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold">{symbol ?? "TOKEN"} / dh{symbol ?? "TOKEN"}</span>
                    <span className="pill !text-[10px] text-ice">Anti-dump vault</span>
                  </div>
                  <div className="num mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                    <div><div className="text-ink-faint">ENTRY</div><div className="mt-1 font-bold">{fmtPct(entryTax)}</div></div>
                    <div><div className="text-ink-faint">EXIT</div><div className="mt-1 font-bold text-danger">{fmtPct(exitTax)}</div></div>
                    <div><div className="text-ink-faint">TO STAKERS</div><div className="mt-1 font-bold text-ice">{fmtPct(divShare)}</div></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-ghost flex-1 py-3 text-xs uppercase tracking-widest">← Back</button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1 py-3 text-sm uppercase tracking-widest">Next: confirm →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="card p-6">
                <div className="num space-y-3 text-sm">
                  <Row k="Token" v={symbol ? `${symbol} · ${shortAddr(token)}` : shortAddr(token)} />
                  <Row k="Entry ingress tax" v={fmtPct(entryTax)} />
                  <Row k="Premature exit friction" v={fmtPct(exitTax)} danger />
                  <Row k="Dividend redistribution" v={fmtPct(divShare)} />
                  <Row k="Fee-on-transfer" v={fot ? "accepted (permissive)" : "rejected (strict)"} />
                  <div className="border-t border-line/50 pt-3">
                    <Row k="Factory fee" v={`${CREATION_FEE_ETH} ETH`} accent />
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
                  The deployed vault has zero admin keys. Config is immutable once
                  deployed — triple-check the numbers, diamond hands.
                </p>
              </div>
              {err && (
                <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm" style={{ color: "var(--color-danger)" }}>
                  {err}
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-ghost flex-1 py-3 text-xs uppercase tracking-widest">← Back</button>
                <button onClick={submit} disabled={phase !== "idle" || !configured} className="btn-primary flex-[2] py-3 text-sm uppercase tracking-widest disabled:opacity-40">
                  {phase === "idle" ? `Deploy vault →` : "On-chain…"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />

      <TxModal
        phase={phase}
        hash={w.data}
        headline={phase === "success" ? "Vault deployed" : undefined}
        bigNumber={phase === "success" ? "0 admin" : undefined}
        bigUnit={phase === "success" ? "keys" : undefined}
        rows={phase === "success" && deployed ? [["Vault", shortAddr(deployed)]] : undefined}
        error={err}
        onClose={() => { setPhase("idle"); setErr(null); }}
      />
      {deployed && phase === "success" && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <Link href={`/vault/${deployed}`} className="btn-primary px-8 py-3 text-sm uppercase tracking-widest">
            Open the vault →
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, danger, accent }: { k: string; v: string; danger?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-faint">{k}</span>
      <span className={`font-semibold ${danger ? "text-danger" : accent ? "text-ice" : ""}`}>{v}</span>
    </div>
  );
}
