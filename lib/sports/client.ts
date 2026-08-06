"use client";

import { useEffect, useState } from "react";

import type { WorldCupPayload } from "@/lib/sports/types";

type QueryState<T> = {
  payload?: WorldCupPayload<T>;
  loading: boolean;
  error?: string;
};

type QueryOptions = {
  enabled?: boolean;
  cacheKey?: string;
  staleMs?: number;
  forceRefreshOnMount?: boolean;
};

export function useWorldCupQuery<T>(
  url: string,
  refreshMs?: number | ((payload: WorldCupPayload<T>) => number | undefined),
  options: QueryOptions = {}
) {
  const enabled = options.enabled ?? true;
  const cacheKey = options.cacheKey ?? `worldcup.query.${url}`;
  const staleMs = options.staleMs ?? 120_000;
  const forceRefreshOnMount = options.forceRefreshOnMount ?? false;
  const [state, setState] = useState<QueryState<T>>(() => {
    if (!enabled) return { loading: false };
    const cached = readCachedPayload<T>(cacheKey, staleMs);
    return cached ? { payload: cached, loading: false } : { loading: true };
  });

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    if (!enabled) {
      setState({ loading: false });
      return () => {
        active = false;
      };
    }

    const cached = readCachedPayload<T>(cacheKey, staleMs);
    if (cached) {
      setState({ payload: cached, loading: false });
    } else {
      setState((current) => ({ ...current, loading: !current.payload }));
    }

    async function load(forceRefresh = false) {
      try {
        const requestUrl = forceRefresh ? appendRefreshParam(url) : url;
        const response = await fetch(requestUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const payload = (await response.json()) as WorldCupPayload<T>;
        if (!active) return;
        writeCachedPayload(cacheKey, payload);
        setState({ payload, loading: false });
        const nextRefreshMs = typeof refreshMs === "function" ? refreshMs(payload) : refreshMs;
        if (active && nextRefreshMs && nextRefreshMs > 0) {
          timer = window.setTimeout(() => void load(), nextRefreshMs);
        }
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "\u8bf7\u6c42\u5931\u8d25"
        }));
      }
    }

    void load(forceRefreshOnMount);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [cacheKey, enabled, forceRefreshOnMount, refreshMs, staleMs, url]);

  return state;
}

function appendRefreshParam(url: string) {
  const target = new URL(url, window.location.origin);
  target.searchParams.set("refresh", "1");
  return `${target.pathname}${target.search}`;
}

function readCachedPayload<T>(cacheKey: string, staleMs: number): WorldCupPayload<T> | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: WorldCupPayload<T> };
    if (!parsed.payload || !parsed.savedAt) return undefined;
    if (Date.now() - parsed.savedAt > staleMs) return undefined;
    return { ...parsed.payload, sourceStatus: "cache" };
  } catch {
    return undefined;
  }
}

function writeCachedPayload<T>(cacheKey: string, payload: WorldCupPayload<T>) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Storage may be disabled or full; live data has already been rendered.
  }
}
