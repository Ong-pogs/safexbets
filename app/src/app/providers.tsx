"use client";

// web3.js / SPL rely on Buffer being a global; browsers don't provide it. Polyfill before anything
// in the wallet/anchor stack runs.
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  w.Buffer = w.Buffer ?? Buffer;
}

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// Import from the dedicated package (not the `-wallets` barrel) to avoid pulling in the entire
// WalletConnect/viem/reown dependency tree. Phantom is auto-detected via Wallet Standard.
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo } from "react";
import { CONFIG } from "@/lib/config";
import { ToastProvider } from "@/components/Toast";

// Wallet-adapter default styles (overridden to the scoreboard theme in globals.css).
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  // Phantom (and other Wallet-Standard wallets) are auto-detected; Solflare is added explicitly as
  // a reliable fallback so the picker is never empty on a fresh browser.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={CONFIG.rpcUrl} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>{children}</ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
