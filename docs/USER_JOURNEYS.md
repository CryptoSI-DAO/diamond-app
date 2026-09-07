# DHP — User Journey & Logic Document

**Project:** Diamond Hands Protocol — app frontend + contract behaviour map
**Contracts:** `diamond-hands-protocol` v1.2.2 @ `911d7fb` (Base Sepolia → Base, post-audit)
**Companion docs:** `BUILD_PLAN.md` (scope/stack) · `STITCH_PROMPTS.md` (visual language) · protocol repo `SELF_AUDIT_V1.2.2.md` (findings)
**Status:** living document — update whenever contracts or scope change.

---

## 1. Actors

| Actor | Who | Wallet | Goal |
|---|---|---|---|
| **Explorer** | Anyone browsing | None needed (read-only) | Find a vault worth entering |
| **Creator** | A token's community / degen with a favourite token | Connected | Deploy a vault for a token (permissionless) |
| **Diamond Hand** | Holder with conviction | Connected | Enter, hold, collect dividends paid by paper hands |
| **Paper Hand** | Holder who exits | Connected | Leave (paying the exit tax that funds the diamonds) |
| **DAO / Treasury** | Protocol governance | Safe multisig | Sweep protocol fees (collector is **never** renounced — M-NEW-1) |
| *System* — Indexer/UI | frontend + RPC | — | Enumerate vaults, render states honestly |

> **Core mechanic (all journeys):** every entry charges an entry tax, every exit charges an exit tax. Each tax splits: `dividendShareBps` → dividend pool · 0.5% → protocol fee collector · remainder → **locked burn** (stays in the vault, subtracted from `totalAssets()`, never leaves). Share price = `totalAssets() / totalSupply()`. Exits burn shares → remaining holders' price rises. That's the flywheel.

---

## 2. Vault lifecycle (system state machine)

```
            createVault (0.001 ETH, eligibility gate)
                        │
                        ▼
   ┌─────────┐   first deposit (≥ 1.0 token)   ┌─────────┐
   │  EMPTY  │ ───────────────────────────────► │ ACTIVE  │
   └─────────┘                                   └────┬────┘
        │              supply == 0                    │  deposits / redeems / claims
        │ mint() REVERTS here (by design)             │
        │                                             ▼
        │                                    (degenerate edge:
        │                                     supply > 0 but totalAssets == 0
        │                                          → HALTED state,
        │                                           pricing reverts
        │                                           DegenerateVaultState,
        │                                           UI = read-only banner)
        └── vault exists, visible in Explore, "awaiting first diamond"
```

Rules locked by audits: first deposit from empty requires `≥ 10^decimals` (anti-squat, `BelowMinimumFirstDeposit`); `mint()` cannot seed an empty vault; strict mode (default) rejects any token that taxes/hooks transfers (`FeeOnTransferToken`).

---

## 3. Transaction lifecycle (UI state machine, every write)

```
 IDLE → SIMULATING (simulateContract) → CONFIRMING (wallet) → PENDING (chain)
              │ fail                        │ reject            │ receipt
              ▼                             ▼                   ├─ success → SUCCESS state + refresh reads
        ERROR (decode custom             back to IDLE          └─ fail → ERROR (decode → human copy,
        error → copy table)                                    e.g. FeeOnTransferToken)
```

UI promise: **preview and simulation are both shown before sign**; if simulated result ≠ previewed by >0.01%, block and warn (M-NEW-2 regression guard).

---

## 4. Journey A — Find a vault (Explorer)

**Goal:** land on the app, grasp the flywheel in 5 seconds, pick a vault.

| # | Step | System/contract | UI state |
|---|---|---|---|
| A1 | Open `/` | Read factory `vaultCount()` → `allVaultsAt(i)` × n | Vault grid renders from chain, not a curated list |
| A2 | Scan hero counters | Σ `totalBurned`, Σ `totalDividendsDistributed`, vault count | Lore stats: "🔥 burned", "💧 paid out", "vaults deployed" |
| A3 | Compare cards | Per vault: `asset/symbol/decimals`, `totalAssets`, `totalSupply` → share price; `entryTaxBps`, `exitTaxBps` | Card: symbol, price, tax chips (exit tax in red), TVL |
| A4 | Filter/sort *(phase 2)* | client-side | TVL / tax / price columns |
| A5 | Tap a card | — | → Journey C at `/vault/{address}` |

**Branches:** zero vaults → empty-state with "Create a vault →" CTA · wallet on wrong chain → network prompt (reads still work) · contracts not deployed at current `addresses.ts` → honest "not wired yet" panel.

**Failure modes:** RPC rate-limit → skeleton cards + retry · token with no symbol → `dh0x…` fallback label.

**Success:** explorer understands entry cost vs exit cost *before* connecting a wallet.

---

## 5. Journey B — Set up a new vault (Creator)

**Goal:** permissionless vault deployment for any eligible token.

**Preconditions:** connected wallet on Base (Sepolia for now) · ≥ 0.001 ETH + gas · token passes the gate.

| # | Step | System/contract | UI state |
|---|---|---|---|
| B1 | `/create` → paste token address | read `decimals()` (ERC-20) | "Checking token…" → eligibility verdict |
| B2 | Gate check | decimals ∈ [0,18] · factory: token has no vault yet (enumerate `allVaultsAt` + `asset()` compare) | ✅ "eligible" / ❌ "already vaulted" / ❌ "decimals out of range" |
| B3 | Configure | UI-only sliders, bounds mirror factory: entry ≤ 10% · exit ≤ 25% · dividend share ≤ 90% | Live preview card (as it will appear in Explore) + plain-English tax explanation |
| B4 | FOT toggle (optional, expert) | maps to `acceptFeesFromTransfer` | Warning caption: permissive = hooks allowed, share pricing assumes full delivery |
| B5 | Confirm | summary + **0.001 ETH factory fee** (exact — overpayment is not refunded, by design) | fee line item |
| B6 | Sign `createVault(token, cfg)` | payable 0.001 ETH → eligibility re-checked on-chain → EIP-1167 clone deployed → `initialize` → vault renounced (no admin keys) → `VaultCreated` event | PENDING → SUCCESS |
| B7 | Parse receipt | derive vault address from `VaultCreated` log | "Vault deployed ✓ — open it →" → Journey C |

**Branches:** wrong chain → switch prompt · insufficient ETH → pre-flight balance check · race (someone vaults the token mid-flow) → on-chain revert `already vaulted` → human copy, back to B2.

**Failure modes:** `TokenHasNoVault`-style reverts decoded to copy · fee paid with stale config → impossible (config is calldata, atomic).

**Success:** vault live, discoverable in Explore, zero admin keys in existence. Creator owns nothing — **the vault belongs to no one**; that's the pitch.

---

## 6. Journey C — Enter a vault (Diamond Hand / Paper Hand entry)

**Goal:** swap `TOKEN` for `dhTOKEN` shares with full tax transparency.

**Preconditions:** connected wallet · token balance · vault ACTIVE (empty vault = must be first depositor, see branch).

| # | Step | System/contract | UI state |
|---|---|---|---|
| C1 | Land on `/vault/{addr}` | reads: config, TVL, share price, burned, dividends paid | Vault header + lore counters |
| C2 | (wallet connected) position read | `balanceOf(user)`, `rewards(user)`, token `balanceOf/allowance` | "Your position" card; claim box if rewards > 0 |
| C3 | Deposit tab → amount (or MAX of token balance) | live `previewDeposit(assets)` | **Tax breakdown card**: `amount → entry tax X% → dividends / 0.5% fee / 🔥 burn → You receive: N shares` |
| C4 | Approve (if `allowance < amount`) | ERC-20 `approve(vault, amount)` | Button relabels "Approve TOKEN" → then deposit enabled; approval for exact amount (no infinite approvals) |
| C5 | Sign `deposit(assets, receiver=user)` | guards: `ZeroAmount` · first-deposit `BelowMinimumFirstDeposit` · pre-pull share conversion (A1) · anti-FOT delta check · `_distributeTax` (split above) · `_accrueDividend` · mint shares | PENDING → SUCCESS: "+N dhSYM" → position card updates |
| C6 | Hold / (optional) transfer shares | shares are ERC-20; transfers settle dividends between parties | (phase 2: share transfer UI) |

**Branches:**
- **Empty vault:** deposit < 1.0 token → blocked pre-sign with `BelowMinimumFirstDeposit` copy; ≥ 1.0 → proceeds, minter becomes price-setter at 1:1 net.
- **FOT token in strict vault:** simulation fails `FeeOnTransferToken` → copy: "This token taxes transfers — the vault rejected it." If the vault was created permissive (B4), no failure — with documented tradeoff banner.
- **Large deposit relative to TVL:** preview == execution (post-A1); confirm modal still shows both.
- **Wallet holds no token:** MAX disabled, balance line shows 0.

**Failure modes:** simulation revert → error copy, no signature requested · pending stuck → tx hash link + explorer.

**Success:** shares in wallet, breakdown matched reality to the wei, entry tax visible as a *feature* ("your entry funded the diamonds").

---

## 7. Journey D — Exit a vault (Paper Hand / partial redeemer)

**Goal:** burn shares, take tokens home, see exactly what leaving costs.

| # | Step | System/contract | UI state |
|---|---|---|---|
| D1 | Withdraw tab | preview switches to share-denominated | Input denominated in **shares** |
| D2 | Amount / MAX | live `previewRedeem(shares)` | Breakdown: `shares → gross value → exit tax X% (red) → You receive: N TOKEN` |
| D3 | **Paper-hands strip** | static read `exitTaxBps` | Red banner: "Exiting costs X%. Your exit funds the diamonds." (brand moment, not shame — receipts) |
| D4 | Sign `redeem(shares, receiver=user, owner=user)` | settle owner's dividends first (keeps earned rewards claimable) → allowance check (skipped: self) → `gross = convertToAssets(shares, roundUp)` → `tax = gross×exitBps/BPS` → burn shares → transfer net (anti-FOT) → distribute tax | PENDING → SUCCESS: "−N shares, +M TOKEN" |
| D5 | Post-exit | reads refresh | position updates; if shares = 0 → "re-enter anytime, the tax thanks you" |

**Branches:**
- **Partial exit** — same flow, any share amount; remaining shares keep accruing dividends.
- **Exit with pending dividends** — settle happens inside redeem; unclaimed rewards survive and remain claimable (D-claim).
- **Slippage-free by design** — redeem has no minOut; it's not a swap. Price impact = the exit tax itself, shown up front.
- **HALTED vault** (`DegenerateVaultState` reachable) — read-only banner: "pricing paused for safety", buttons disabled, no signature possible.

**Failure modes:** redeeming more shares than owned → pre-flight check vs `balanceOf` · reentrant/hook token in permissive vault → anti-FOT still guards receiver side.

**Success:** user knows the cost *before* signing; the exit tax lands in the pool that pays the diamonds. The meme and the math are the same thing.

---

## 8. Journey E — Claim dividends (both holder types)

| # | Step | System/contract | UI state |
|---|---|---|---|
| E1 | Position card shows `rewards(user)` | continuous accrual (Synthetix rpTs) | "Unclaimed: N TOKEN" |
| E2 | Optional slippage floor | UI converts `min out` field (default: 0 = none; preset −0.5% when phase-2 price feeds land) | min-out input |
| E3 | Sign `claimDividend(minAmountOut)` | settle → `require(pending ≥ minOut)` else `InsufficientClaimAmount` → transfer | PENDING → SUCCESS "+N TOKEN" |

**Edge:** claim after full exit still works (settle-before-burn guarantee) · sandwich-protected via minOut (M-CARRIED-2 fix).

---

## 9. Journey F — DAO / Treasury (governance)

| # | Step | Contract | Note |
|---|---|---|---|
| F1 | Fees accumulate per token in `DHPFeeCollector` | vaults `safeTransfer` 0.5% on every tax event | no hook call, balance implicit |
| F2 | DAO reviews balances | `sweepable(token)` style reads | (phase 2: treasury page) |
| F3 | Safe signs `sweep(token)` / `sweepNative()` | `onlyOwner` — **owner is the DAO Safe** | ⚠️ collector ownership is transferred, **never renounced** (M-NEW-1); factory IS renounced at launch |

UI surface (phase 2): read-only treasury page + governance-status badge (owner addresses, renounce state of factory vs collector).

---

## 10. Error & edge-case matrix (single source for UI copy)

| Signal | Journey | UI copy |
|---|---|---|
| `BelowMinimumFirstDeposit(req, got)` | C (empty vault) | "Fresh vaults need a first deposit of at least 1.0 tokens." |
| `FeeOnTransferToken` | C/D (strict) | "This token taxes transfers — the vault rejected it." |
| `InsufficientClaimAmount(req, avail)` | E | "Claim would land below your slippage floor. Raise the minimum or wait." |
| `DegenerateVaultState` | C/D | "This vault is in a halted state — pricing paused for safety." |
| `ZeroAmount` / `ZeroAddress` | all writes | "Enter an amount." / "Invalid recipient." |
| token already vaulted (factory revert) | B | "This token already has a vault." |
| decimals out of range | B | "Decimals out of supported range (0–18)." |
| insufficient 0.001 ETH fee | B | "You need 0.001 ETH for the factory fee." |
| simulation ≠ preview >0.01% | C/D | "On-chain state moved. Refreshing numbers — please re-check." (hard block) |
| user rejects in wallet | all | silent return to IDLE (no error banner) |

---

## 11. Money flow (one screen)

```
                 ENTRY (deposit)                    EXIT (redeem)
  user ── assets ──► vault                        user ◄── net ── vault
                       │                              ▲ shares burned
                       ▼ tax                          
                
        ┌─────────────── tax split ───────────────┐
        │ dividendShareBps  → dividend pool       │  (stays in vault; accrues pro-rata
        │                                            to holders via rpTs index)
        │ 0.5% of tax       → DHPFeeCollector ────┼──► DAO Safe sweeps (F3)
        │ remainder         → 🔥 locked burn      │  (stays in vault; totalAssets ↓;
        │                                            supply shrank on exit ⇒ price ↑)
        └─────────────────────────────────────────┘
```

---

## 12. Open decisions (flag before P1 build)

1. **Verified-flag curation:** factory `setVerified` exists — does Explore rank/badge verified vaults, or stay neutral permissionless? (default: badge only, no filtering)
2. **FOT toggle exposure:** keep the permissive toggle in the Create wizard (expert section) or hide behind "advanced"? (default: visible with warning)
3. **Approve strategy:** exact-amount approvals (current) vs +10% buffer to avoid re-approve friction (default: exact — safety over convenience, matches brand)
4. **Global counters source:** per-vault Σ reads (current, fine at n<50) vs indexer subgraph (phase 2 at scale)
5. **History feed:** event-log reads per vault (`Deposit/Withdraw/TaxCollected`) in MVP, or defer ticker history to phase 2?
