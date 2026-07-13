"use client";

import type { Idl, Program } from "@coral-xyz/anchor";
import { useCallback, useEffect, useState } from "react";
import { fetchMarkets } from "@/lib/program";
import type { MarketRecord } from "@/lib/types";

const POLL_MS = 12_000;

/** Loads all markets and re-polls, so an external relayer settlement shows up without a refresh. */
export function useMarkets(program: Program<Idl>) {
  const [markets, setMarkets] = useState<MarketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setMarkets(await fetchMarkets(program));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void reload();
    const id = setInterval(() => {
      if (active) void reload();
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [reload]);

  return { markets, loading, error, reload };
}
