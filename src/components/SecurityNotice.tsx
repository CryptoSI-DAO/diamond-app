"use client";

import { shortAddr } from "@/lib/format";

/**
 * Pre-signature reassurance: Coinbase Wallet/Blockaid flags young protocols'
 * contracts as "high-risk / untrusted" even when fully verified and immutable
 * (learned 2026-10-05 — Carl's own vault-creation tx got flagged). This notice
 * tells users the warning is expected, why the contracts are safe, and what to
 * check in the wallet's tx preview before signing.
 *
 * Styling mirrors the ①/② step notices on the vault page (border-line/50,
 * bg-surface-dim) so it reads as part of the flow, not an error.
 */

const FACTORY = "0x64BE13cE698684846Ae0642c1c63bb5eDE8F6929";

export function SecurityNotice({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-line/50 bg-surface-dim px-4 py-3 text-xs text-ink-dim">
      <span className="text-ice">🛡️</span>
      <span className="leading-relaxed">
        <b>Wallet security warning ahead? That&apos;s expected.</b> Some wallets
        (Coinbase Wallet and others) flag young protocols as &ldquo;untrusted
        contract&rdquo; until they build reputation. The DHP factory (
        <span className="num">{shortAddr(FACTORY)}</span>) is open-source,
        Sourcify-verified on every chain, immutable — zero admin keys — and
        passed seven audit rounds. {children}
      </span>
    </div>
  );
}
