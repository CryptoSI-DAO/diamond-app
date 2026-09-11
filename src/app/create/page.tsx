"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { decodeEventLog } from "viem";
import { Header, Footer } from "@/components/Header";
import { TxModal, type TxPhase } from "@/components/TxModal";
import {
  useChainId, usePublicClient, useReadContract, useReadContracts,
  useSwitchChain, useWriteContract,
} from "wagmi";
import { erc20Abi, factoryAbi, vaultAbi } from "@/lib/abis";
import { errorToCopy } from "@/lib/errors";
import { BASE_SEPOLIA_ID, CREATION_FEE_ETH } from "@/lib/addresses";
import { fmtPct, shortAddr } from "@/lib/format";
import { useFactoryAddress } from "@/lib/useVaultList";

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

// Fixed protocol parameters — as stated by the smart contract (DHPImplementation
// test canon + landing economics). NOT user-configurable.
const FIXED_ENTRY_TAX_BPS = 500; // 5% on deposit
const FIXED_EXIT_TAX_BPS = 1000; // 10% on withdraw
const FIXED_DIV_SHARE_BPS = 8000; // 80% of tax → holders (deployed vault config — verified on-chain, both v1.2.2 vaults); remainder: 0.5% protocol fee, 19.5% burn
const FIXED_ACCEPT_FOT = false; // strict: fee-on-transfer tokens rejected

export default function CreatePage() {
  const { factory, configured } = useFactoryAddress();
  const pc = usePublicClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const wrongChain = configured && chainId !== BASE_SEPOLIA_ID;
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
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
    setTxHash(null);
    setDeployed(null);
    w.writeContract(
      {
        address: factory,
        abi: factoryAbi,
        functionName: "createVault",
        args: [token as `0x${string}`, { entryTaxBps: FIXED_ENTRY_TAX_BPS, exitTaxBps: FIXED_EXIT_TAX_BPS, dividendShareBps: FIXED_DIV_SHARE_BPS, acceptFeesFromTransfer: FIXED_ACCEPT_FOT }],
        value: BigInt(Math.round(Number(CREATION_FEE_ETH) * 1e18)),
      },
      {
        onSuccess: (hash: `0x${string}`) => {
          // writeContract resolves with the TX HASH, not the return value —
          // the vault address comes from the VaultCreated event in the receipt.
          setPhase("pending");
          setTxHash(hash);
        },
        onError: (e: unknown) => {
          setPhase("error");
          setErr(errorToCopy(e));
        },
      } as never
    );
  }

  // receipt watch → success. Runs as soon as the tx is broadcast; `deployed`
  // (vault address) is parsed from the VaultCreated event in the logs.
  useEffect(() => {
    if (!txHash || !pc || deployed) return;
    let alive = true;
    (async () => {
      try {
        const r = await pc.waitForTransactionReceipt({
          hash: txHash,
          timeout: 180_000, // Sepolia re-orgs/dropped txs shouldn't spin forever
        });
        if (!alive) return;
        if (r.status !== "success") {
          setPhase("error");
          setErr("Transaction reverted on-chain.");
          return;
        }
        // VaultCreated(token indexed, vault indexed, entry, exit, divShare)
        let vault: `0x${string}` | null = null;
        for (const log of r.logs) {
          try {
            const ev = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics });
            if (ev.eventName === "VaultCreated") {
              vault = (ev.args as { vault: `0x${string}` }).vault;
              break;
            }
          } catch { /* unrelated log — skip */ }
        }
        if (!vault) {
          setPhase("error");
          setErr("Vault created but address could not be read from the receipt.");
          return;
        }
        setDeployed(vault);
        setPhase("success");
      } catch {
        if (alive) {
          setPhase("error");
          setErr("Timed out waiting for confirmation. Check the explorer — do NOT resend blindly.");
        }
      }
    })();
    return () => { alive = false; };
  }, [txHash, pc, deployed]);

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
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <div className="label text-ice">Protocol parameters</div>
                  <span className="pill !text-[10px]">fixed on-chain</span>
                </div>
                <p className="mt-2 text-xs text-ink-dim">
                  Every vault in the protocol shares the same immutable tax
                  dynamics. Configurable at deploy time in earlier versions,
                  now standardized.
                </p>
                <div className="num mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="card-inner p-3">
                    <div className="text-ink-faint">ENTRY TAX</div>
                    <div className="mt-1 text-lg font-bold">{fmtPct(FIXED_ENTRY_TAX_BPS)}</div>
                    <div className="mt-1 text-[10px] text-ink-faint">on deposit · to stakers</div>
                  </div>
                  <div className="card-inner p-3">
                    <div className="text-ink-faint">EXIT TAX</div>
                    <div className="mt-1 text-lg font-bold text-danger">{fmtPct(FIXED_EXIT_TAX_BPS)}</div>
                    <div className="mt-1 text-[10px] text-ink-faint">on withdraw · paper hands pay</div>
                  </div>
                  <div className="card-inner p-3">
                    <div className="text-ink-faint">DIVIDEND SHARE</div>
                    <div className="mt-1 text-lg font-bold text-ice">{fmtPct(FIXED_DIV_SHARE_BPS)}</div>
                    <div className="mt-1 text-[10px] text-ink-faint">of tax → holders</div>
                  </div>
                </div>
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
                    <div><div className="text-ink-faint">ENTRY</div><div className="mt-1 font-bold">{fmtPct(FIXED_ENTRY_TAX_BPS)}</div></div>
                    <div><div className="text-ink-faint">EXIT</div><div className="mt-1 font-bold text-danger">{fmtPct(FIXED_EXIT_TAX_BPS)}</div></div>
                    <div><div className="text-ink-faint">TO STAKERS</div><div className="mt-1 font-bold text-ice">{fmtPct(FIXED_DIV_SHARE_BPS)}</div></div>
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
                  <Row k="Entry tax" v={fmtPct(FIXED_ENTRY_TAX_BPS)} />
                  <Row k="Exit tax" v={fmtPct(FIXED_EXIT_TAX_BPS)} danger />
                  <Row k="Dividend share" v={fmtPct(FIXED_DIV_SHARE_BPS)} />
                  <Row k="Fee-on-transfer" v="rejected (strict)" />
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
              {wrongChain && (
                <button
                  onClick={() => switchChain({ chainId: BASE_SEPOLIA_ID })}
                  className="btn-primary w-full py-3 text-sm uppercase tracking-widest"
                >
                  Switch to Base Sepolia to deploy
                </button>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-ghost flex-1 py-3 text-xs uppercase tracking-widest">← Back</button>
                <button onClick={submit} disabled={phase !== "idle" || !configured || wrongChain} className="btn-primary flex-[2] py-3 text-sm uppercase tracking-widest disabled:opacity-40">
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
        hash={txHash ?? undefined}
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
