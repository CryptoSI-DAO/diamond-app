"use client";

import { useMemo } from "react";
import { useChainId } from "wagmi";
import { BASE_MAINNET_ID } from "@/lib/addresses";
import { shortAddr } from "@/lib/format";

export type TxPhase = "idle" | "confirming" | "pending" | "success" | "error";

export function explorerTx(chainId: number, hash: string) {
  return chainId === BASE_MAINNET_ID
    ? `https://basescan.org/tx/${hash}`
    : `https://base-sepolia.blockscout.com/tx/${hash}`;
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 67) % 100}%`,
        delay: `${(i * 0.42) % 3.2}s`,
        dur: `${2.6 + ((i * 37) % 18) / 10}s`,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
      {bits.map((b, i) => (
        <span
          key={i}
          className="diamond"
          style={{ left: b.left, animationDelay: b.delay, animationDuration: b.dur }}
        />
      ))}
    </div>
  );
}

export function TxModal({
  phase,
  hash,
  headline,
  bigNumber,
  bigUnit,
  rows,
  error,
  onClose,
}: {
  phase: TxPhase;
  hash?: `0x${string}`;
  headline?: string;
  bigNumber?: string;
  bigUnit?: string;
  rows?: [string, string][];
  error?: string | null;
  onClose: () => void;
}) {
  const chainId = useChainId();
  if (phase === "idle") return null;

  const overlay = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/80 p-4 backdrop-blur-sm">
      <div className="card relative w-full max-w-md p-8 text-center">
        {phase === "success" && <Confetti />}

        {phase === "confirming" && (
          <>
            <div className="label">Confirm in wallet</div>
            <div className="mt-4 flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-ice border-t-transparent" />
            </div>
            <p className="mt-4 text-sm text-ink-dim">Review the details in your wallet…</p>
            <button onClick={onClose} className="btn-ghost mt-6 px-5 py-2 text-xs uppercase tracking-widest">
              Dismiss
            </button>
          </>
        )}

        {phase === "pending" && (
          <>
            <div className="label">On-chain</div>
            <div className="mt-4 flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-ice border-t-transparent" />
            </div>
            <p className="font-display mt-4 text-lg font-semibold">Sealing the vault…</p>
            {hash && (
              <a
                href={explorerTx(chainId, hash)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-ice"
              >
                tx {shortAddr(hash)} ↗
              </a>
            )}
            <button onClick={onClose} className="btn-ghost mt-6 px-5 py-2 text-xs uppercase tracking-widest">
              Hide
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="label" style={{ color: "var(--color-danger)" }}>Rejected on-chain</div>
            <div className="font-display mt-3 text-xl font-bold">Paper hands detected</div>
            <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm" style={{ color: "var(--color-danger)" }}>
              {error ?? "Transaction failed."}
            </p>
            <button onClick={onClose} className="btn-ghost mt-6 px-5 py-2 text-xs uppercase tracking-widest">
              Back
            </button>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-ice/40 bg-ice/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-gem-192.png" alt="" className="h-10 w-10 rounded-lg" />
            </div>
            <div className="font-display mt-4 text-2xl font-bold">
              {headline ?? "Diamond Hands Confirmed"}
            </div>
            {hash && (
              <a
                href={explorerTx(chainId, hash)}
                target="_blank"
                rel="noreferrer"
                className="pill mt-3 inline-flex text-ice"
              >
                tx {shortAddr(hash)} ↗
              </a>
            )}
            {bigNumber && (
              <div className="card-inner mt-5 px-6 py-5">
                <div className="num text-4xl font-bold">
                  {bigNumber}
                  {bigUnit && <span className="ml-2 text-lg text-ice">{bigUnit}</span>}
                </div>
              </div>
            )}
            {rows && rows.length > 0 && (
              <div className="num mt-4 space-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-ink-faint">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="btn-primary mt-6 w-full py-3 text-sm uppercase tracking-widest">
              Back →
            </button>
          </>
        )}
      </div>
    </div>
  );

  return overlay;
}
