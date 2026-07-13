import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Oswald } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Display: condensed, kit-number energy. Body: clean grotesque. Numerals: LED mono.
const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SafeXBets — No-loss World Cup markets",
  description:
    "A no-loss prediction market for the World Cup on Solana. Back a Yes/No call, keep your principal, win the losers' yield. You stake time, not money.",
};

export const viewport: Viewport = {
  themeColor: "#04110a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
