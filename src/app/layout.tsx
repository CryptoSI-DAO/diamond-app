import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export const metadata: Metadata = {
  title: "Diamond Hands Protocol — App",
  description: "Immutable conviction vaults on Base. Paper hands fund diamond hands.",
  icons: { icon: "/gem-mark.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
