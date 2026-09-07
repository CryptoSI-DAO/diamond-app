# diamond-app

Frontend for the **Diamond Hands Protocol** — immutable conviction vaults on Base.

> *Paper hands fund diamond hands. On-chain. Forever.*

Companion repos: [`diamond-hands-protocol`](https://github.com/CryptoSI-DAO/diamond-hands-protocol) (contracts v1.2.2) · [`diamond-landing`](https://github.com/CryptoSI-DAO/diamond-landing) (marketing site)

## Screens

| Route | Screen | Status |
|---|---|---|
| `/` | Explore — vault grid + global stats | ✅ built (reads factory once addresses land) |
| `/vault/[token]` | Vault detail — deposit/withdraw, live tax breakdown, dividend stream | ✅ built |
| `/create` | Deploy wizard — eligibility gate, tax steppers, live preview | ✅ built |
| global | Tx state machine — simulate → confirm → pending → success/error modals | ✅ built |

Design language: Stitch "Glacial Vault" system (navy `#011526`, ice `#4da3ff`, Space Grotesk). **No fabricated data** — no USD prices, no APY promises; on-chain values only.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind v4 · wagmi v2 + viem · ConnectKit (Base + Base Sepolia)

## Wiring the contracts

All addresses live in one file:

```ts
// src/lib/addresses.ts
export const FACTORY: Record<number, `0x${string}`> = {
  [BASE_SEPOLIA_ID]: "0x…", // v1.2.2 redeploy
};
```

Until then the app renders honest empty states. After Spock's redeploy, paste the three addresses and every read/write goes live.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production check
```

Optional env: `NEXT_PUBLIC_WALLETCONNECT_ID` (WalletConnect v2 project id — without it, injected wallets still work).

## Safety rails

- Every write is simulated before signature (`simulateContract`)
- Preview/execution divergence guard (M-NEW-2 regression watch)
- Custom errors decoded to human copy (`src/lib/errors.ts`)
- Testnet badge when on Base Sepolia; mainnet addresses stay zeroed until the external audit clears
