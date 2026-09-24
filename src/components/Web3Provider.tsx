"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { ProtocolVersionProvider } from "@/lib/version";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";

const config = createConfig(
  getDefaultConfig({
    chains: [baseSepolia, base], // testnet-first until mainnet audit clears
    transports: {
      [baseSepolia.id]: http("https://sepolia.base.org"),
      [base.id]: http(),
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
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ThemedConnectKit>
            <ProtocolVersionProvider>{children}</ProtocolVersionProvider>
          </ThemedConnectKit>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
