"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { fallback } from "viem";
import {
  base, baseSepolia, mainnet, bsc, robinhood, arc, arcTestnet,
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { ProtocolVersionProvider } from "@/lib/version";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { ViewChainProvider } from "@/components/ViewChainProvider";

// 2026-10-09: viem ships `arc` with an EMPTY rpcUrls list (Circle hasn't
// published a canonical endpoint), but arc.drpc.org serves mainnet —
// eth_chainId 0x13b2 = 5042 verified, token probes return real data.
// Without this the create-page token probe (and every read) has nowhere to
// dial on Arc: "not recognising the token address". Spreading the chain def
// ALSO fixes wallet_addEthereumChain for wallets that don't know Arc yet —
// wagmi serializes the chain definition's rpcUrls for the add request.
const arcMainnet = {
  ...arc,
  rpcUrls: { ...arc.rpcUrls, default: { http: ["https://arc.drpc.org"] } },
};

const config = createConfig(
  getDefaultConfig({
    // Full registry: every chain the protocol lives on must be registered here,
    // or ConnectKit's wallet menu and wagmi's switchChain refuse them (the
    // "wallet can only connect to Base" bug). Mainnets first, Base default.
    chains: [base, mainnet, bsc, robinhood, arcMainnet, baseSepolia, arcTestnet],
    transports: {
      // 2026-10-08: Base's official RPC rate-limits/blocks anonymous clients —
      // flaky reads made the vault list silently empty ("Deploy the first
      // vault" on a chain WITH vaults). drpc primary (no 2k-block log cap
      // either) with immediate batching, official RPC as fallback.
      [base.id]: fallback([
        http("https://base.drpc.org", { batch: { wait: 0 } }),
        http(),
      ], { rank: false }),
      [mainnet.id]: http(),
      [bsc.id]: http(),
      [robinhood.id]: http("https://rpc.mainnet.chain.robinhood.com"),
      // 2026-10-09: arc.drpc.org serves Arc mainnet (chainId 5042 verified
      // via eth_chainId 0x13b2; token probes return real data). viem's arc
      // def has no RPC — without an explicit transport every read on Arc
      // silently no-ops and the create-page probe "doesn't recognise" tokens.
      [arc.id]: http("https://arc.drpc.org"),
      // Arc testnet is public:
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
      [baseSepolia.id]: http("https://sepolia.base.org"),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "0",
    appName: "Diamond Hands Protocol",
    appDescription: "Paper hands fund diamond hands. On-chain. Forever.",
    appUrl: "https://cryptosi-dao.github.io/diamond-landing/",
    appIcon: "/logo-gem-192.png",
  })
);

const queryClient = new QueryClient();

/** ConnectKit's wallet modal follows the app theme; "auto" matches OS in dark mode. */
function ThemedConnectKit({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <ConnectKitProvider theme="auto" mode={theme === "light" ? "light" : "auto"} options={{ initialChainId: 0 }}>
      {children}
    </ConnectKitProvider>
  );
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ViewChainProvider>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <ThemedConnectKit>
              <ProtocolVersionProvider>{children}</ProtocolVersionProvider>
            </ThemedConnectKit>
          </QueryClientProvider>
        </WagmiProvider>
      </ViewChainProvider>
    </ThemeProvider>
  );
}
