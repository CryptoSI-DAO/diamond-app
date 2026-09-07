"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
  getDefaultConfig({
    chains: [base, baseSepolia],
    transports: {
      [base.id]: http(),
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

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="auto" options={{ initialChainId: 0 }}>
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
