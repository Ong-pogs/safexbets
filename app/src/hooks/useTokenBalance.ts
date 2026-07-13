"use client";

import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

/** The owner's mock-USDC balance (UI amount) for the principal mint. null while unknown. */
export function useTokenBalance(
  connection: Connection,
  owner: PublicKey | undefined,
  mint: PublicKey | undefined,
) {
  const [amount, setAmount] = useState<number | null>(null);
  const ownerKey = owner?.toBase58() ?? null;
  const mintKey = mint?.toBase58() ?? null;

  const reload = useCallback(async () => {
    if (!owner || !mint) {
      setAmount(null);
      return;
    }
    try {
      const ata = getAssociatedTokenAddressSync(mint, owner);
      const bal = await connection.getTokenAccountBalance(ata);
      setAmount(bal.value.uiAmount ?? 0);
    } catch {
      setAmount(0); // ATA likely doesn't exist yet
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, ownerKey, mintKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { amount, reload };
}
