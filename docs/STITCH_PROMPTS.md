# Google Stitch — Brand Prompt Pack (DHP)

Copy-paste these into Stitch. **Rule: always start every screen prompt with the ANCHOR, then the screen block.** If Stitch drifts (purple gradients, neon greens, generic fintech), regenerate with the anchor — never hand-fix screens; regenerate.

## 🔒 The Anchor (mandatory prefix)

```
Dark-mode crypto dapp called "Diamond Hands Protocol". Deep navy background (#0a1022 → #111c38 subtle gradient), glassmorphism cards (white at 4-8% opacity, 1px ice-blue borders at 15% opacity, 24px radius). Accent color ice-blue #4da3ff only. Big confident numerals in a grotesk font. Diamond/hands motif used sparingly, geometric and minimal. Mood: premium vault, cold, precise, slightly mischievous. STRICT: no green, no purple, no neon gradients, no 3D rubber illustrations, no rocket ships.
```

## Screen 1 — Explore (vault list)

```
ANCHOR + a grid of vault cards, one per token. Each card: token logo circle, token symbol large, share price (net APY-style numeral), two mini-stats row (entry tax %, exit tax %), a thin dividend-ticker line at the card bottom that reads like a stock ticker. Top bar: Diamond Hands logo left (two hands framing a diamond, ice-blue line art), "Connect Wallet" pill button right in ice-blue. Above the grid: one hero strip with the live global counters — "tokens burned", "dividends paid", "vaults deployed" — as three big numerals. Cards hover: border brightens to #4da3ff.
```

## Screen 2 — Vault detail (the money screen)

```
ANCHOR + single vault page, two columns. LEFT (60%): a large deposit/withdraw panel with tabbed toggle (Deposit | Withdraw), a big amount input with token logo and MAX button, and below it a live "TAX BREAKDOWN" card showing three lines that sum: entry tax → dividends, protocol fee, burn (with a tiny flame icon), then a bold final line "You receive: 950 shares". RIGHT (40%): position card (your shares, your share of dividends, unclaimed rewards with a Claim button), plus a compact dividend history list (time, amount, ticker-style). Under the input: a thin red-tinted info strip only when exit tab is active, showing the exit tax cost of leaving.
```

## Screen 3 — Create Vault

```
ANCHOR + a focused single-column wizard, three steps shown as a horizontal progress bar (Token → Config → Confirm). Step shown: CONFIG — four parameter fields with big stepper values: Entry tax (slider 0-10%), Exit tax (slider 0-25%), Dividend share (slider 0-90%), and a toggle "Accept fee-on-transfer tokens" with a small warning caption. Right side: a live "PREVIEW" mini-card showing the vault as it will appear in the Explore grid. At the bottom: the creation fee shown as a flat line "Factory fee: 0.001 ETH", and a primary ice-blue button "Deploy vault".
```

## Screen 4 — Transaction states (the layer Stitch can't do — reference sheet)

Build these consistent with whatever Stitch returns; they're modals/toasts over any screen:
1. **Confirm modal** — action summary, tax line, "Simulate" status dot → green "Simulation passed"
2. **Pending** — spinner over muted page, tx hash short-link
3. **Success** — diamond icon, shares received numeral, confetti = falling diamonds (subtle)
4. **Error mapping** — `FeeOnTransferToken` → "This token taxes transfers — the vault rejected it." · `BelowMinimumFirstDeposit` → "Fresh vaults need a first deposit of at least 1.0 tokens." · `InsufficientClaimAmount` → "Claim would land below your slippage floor. Raise the minimum or wait." · `DegenerateVaultState` → "This vault is in a halted state — pricing paused for safety."
```
