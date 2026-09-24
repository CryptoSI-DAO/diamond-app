"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia, mainnet, bsc, robinhood, arc, arcTestnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { ProtocolVersionProvider } from "@/lib/version";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { ViewChainProvider } from "@/components/ViewChainProvider";

const config = createConfig(
  getDefaultConfig({
    // Full registry: every chain the protocol lives on must be registered here,
    // or ConnectKit's wallet menu and wagmi's switchChain refuse them (the
    // "wallet can only connect to Base" bug). Mainnets first, Base default.
    chains: [base, mainnet, bsc, robinhood, arc, baseSepolia, arcTestnet],
    transports: {
      [base.id]: http(),
      [mainnet.id]: http(),
      [bsc.id]: http(),
      [robinhood.id]: http("https://rpc.mainnet.chain.robinhood.com"),
      // Arc mainnet has NO public RPC yet (Circle-gated) — it stays listed so
      // wallets that already have it can hold/switch; in-app reads there will
      // stay empty until Circle publishes an endpoint. Arc testnet is public.
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
