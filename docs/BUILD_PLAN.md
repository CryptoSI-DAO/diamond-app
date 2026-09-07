# diamond-app — Build Plan (v1)

Frontend for the Diamond Hands Protocol. Companion to `CryptoSI-DAO/diamond-hands-protocol` (contracts, v1.2.2) and `CryptoSI-DAO/diamond-landing` (marketing site).

## Scope (MVP, decided 2026-09-07)

| Screen | Route | Wallet | Core job |
|---|---|---|---|
| Explore | `/` | connect only | Vault grid from `DHPFactory.getVault` + indexer; global lore counters (burned, dividends, vault count) |
| Vault detail | `/vault/[token]` | full | Deposit / withdraw with live tax breakdown, position card, claim dividends (slippage), history |
| Create Vault | `/create` | full | 3-step wizard: token eligibility → tax config → confirm (0.001 ETH fee) |
| Tx layer | global | — | Confirm/success/error states, simulation gate, custom-error → human copy |

Deferred: portfolio page, vault analytics charts, per-vault chat/lore feed.

## Stack

- **Next.js 14 App Router + TypeScript + Tailwind v4** (`@import "tailwindcss"`, NOT @tailwind directives)
- **wagmi v2 + viem v2** — native Base + Base Sepolia support
- **ConnectKit** (family connect modal; Coinbase Wallet + Smart Wallet first-class)
- **Tanos-style indexing** (phase 2): The Graph or a small Postgres indexer for history; MVP reads history from `TaxCollected`/`Withdraw` logs via viem `getLogs` per vault
- **API routes** (inside this repo, per house convention): `/api/check-token` proxying GoPlus + liquidity checks (keys stay server-side)

## Design system

- Tokens: navy `#0a1022`/`#111c38` bg, card `rgba(255,255,255,.05)`, border `rgba(77,163,255,.15)`, accent `#4da3ff`, danger `#ff5470` (exit strips only), gold `#ffb547` (fee line only)
- Fonts: Space Grotesk (display/numerals), Inter (body)
- Logo set reused from diamond-landing (`logo-full.png`, gem crops, favicon.svg)
- Every numeral component uses `tabular-nums`; amounts formatted via viem `formatUnits` with per-token decimals from the vault
- Motion: 150-200ms eae-out on hover/tabs only; confetti = falling diamonds on tx success (subtle)

## Contract integration (v1.2.2)

Addresses imported from a single `src/lib/addresses.ts` (testnet set now, mainnet after external audit). ABI source of truth: contracts repo `src/interfaces/IDHPVault.sol` → generated with `wagmi generate` (export the abi from forge artifacts).

Reads (public clients, no wallet needed):
- Factory: `getVault(token)`, `allVaults(start,end)`, `verified(token)`, config bounds
- Vault: `totalAssets`, `totalSupply` → share price; `entryTaxBps/exitTaxBps/dividendShareBps`; `previewDeposit/previewRedeem/previewMint/previewWithdraw`; `rewards(user)`, `totalDividendsDistributed`; `totalBurned`; `acceptFeesFromTransfer`

Writes (wallet client, always preceded by `simulateContract`):
- `deposit(assets, receiver)` / `mint(shares, receiver)` / `withdraw(assets, receiver, owner)` / `redeem(shares, receiver, owner)` / `claimDividend(minAmountOut)` / `createVault(token, TaxConfig)` + 0.001 ETH value

Error UX: decode custom errors (`FeeOnTransferToken`, `BelowMinimumFirstDeposit(uint256,uint256)`, `InsufficientClaimAmount(uint256,uint256)`, `DegenerateVaultState`, `ZeroAmount`, `AlreadyInitialised`) → copy table lives in `STITCH_PROMPTS.md` screen 4 and `src/lib/errors.ts`.

**Preview honesty (M-NEW-2 regression guard):** after the v1.2.2 A1 fix, `previewDeposit == deposit` exactly. The UI must still always render the *simulated* result next to the previewed one on confirmation; if they ever diverge >0.01%, block and report (belt and braces).

## Safety rails in UI

- Token eligibility pre-check before Create step 2: decimals 0-18, not already vaulted (factory read) + GoPlus/liquidity via API route
- Testnet banner when chainId = 84532; addresses block links to Blockscout
- Slippage field on claim (default bps→minAmountOut at -0.5%, editable, floor 0)
- Exit-tax strip on withdraw tab; "paper hands exit cost" framing per brand
- No price predictions, no APY promises — counters only, ever

## Phases

1. **P0 — scaffold** (Lisa): repo, Tailwind v4 + wagmi/ConnectKit wired to Base Sepolia, design tokens, layout shell, addresses.ts
2. **P1 — screens** (user + Stitch → Lisa): implement 4 screens from curated exports
3. **P2 — wiring** (Lisa): full read/write against deployed v1.2.2 contracts (Spock's redeploy @ `911d7fb`), tx state machine, error mapping
4. **P3 — QA**: small-amount testnet lifecycle, simulation-gate e2e, mobile pass
5. **P4 — ship**: Vercel (crypto-si), `diamond-app` subdomain or `/app` route — decided at P3
