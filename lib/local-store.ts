"use client";

import { useEffect, useState } from "react";

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setValue(JSON.parse(stored) as T);
      }
    } catch {
      setValue(initialValue);
    } finally {
      setIsReady(true);
    }
  }, [initialValue, key]);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [isReady, key, value]);

  return [value, setValue, isReady] as const;
}
