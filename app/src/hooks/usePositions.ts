"use client";

import type { Idl, Program } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { fetchPositionsByOwner } from "@/lib/program";
import type { PositionRecord } from "@/lib/types";

/** The connected wallet's positions (memcmp-filtered by owner on-chain). */
export function usePositions(program: Program<Idl>, owner: PublicKey | undefined) {
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const ownerKey = owner?.toBase58() ?? null;

  const reload = useCallback(async () => {
    if (!owner) {
      setPositions([]);
      return;
    }
    try {
      setLoading(true);
      setPositions(await fetchPositionsByOwner(program, owner));
    } catch {
      /* transient RPC errors — keep the last good list */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, ownerKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { positions, loading, reload };
}
