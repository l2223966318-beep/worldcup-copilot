"use client";

import { useEffect, useState } from "react";

import type { WorldCupPayload } from "@/lib/sports/types";

type QueryState<T> = {
  payload?: WorldCupPayload<T>;
  loading: boolean;
  error?: string;
};

export function useWorldCupQuery<T>(
  url: string,
  refreshMs?: number | ((payload: WorldCupPayload<T>) => number | undefined)
) {
  const [state, setState] = useState<QueryState<T>>({ loading: true });

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = (await response.json()) as WorldCupPayload<T>;
        if (!active) return;
        setState({ payload, loading: false });
        const nextRefreshMs = typeof refreshMs === "function" ? refreshMs(payload) : refreshMs;
        if (active && nextRefreshMs && nextRefreshMs > 0) {
          timer = window.setTimeout(load, nextRefreshMs);
        }
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "请求失败"
        }));
      }
    }

    load();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [refreshMs, url]);

  return state;
}
