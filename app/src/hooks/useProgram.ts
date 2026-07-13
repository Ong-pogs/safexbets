"use client";

import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { getProgram, getReadonlyProgram } from "@/lib/anchor";

/**
 * The Anchor program bound to the current connection + connected wallet.
 * Falls back to a read-only client when no wallet is connected, so the markets board still loads
 * for anonymous visitors.
 */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet(); // { publicKey, signTransaction, signAllTransactions } | undefined

  const program = useMemo(
    () => (wallet ? getProgram(connection, wallet) : getReadonlyProgram(connection)),
    [connection, wallet],
  );

  return { program, connection, wallet };
}
