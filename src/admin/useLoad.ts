import { useCallback, useEffect, useRef, useState } from 'react';
import { SignedOut } from './api';

export interface Loaded<T> {
  data: T | undefined;
  /** When `data` arrived, for anything that says "5 minutes ago". */
  at: number;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

interface Result<T> {
  request: string;
  data?: T;
  at: number;
  error?: string;
}

/**
 * Loads `load()` now, again whenever `key` changes, and every `refreshMs`
 * while the tab is visible. The last data stays on screen while the next
 * loads. A lost sign-in goes to `onSignedOut`.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  key: string,
  onSignedOut: () => void,
  refreshMs = 0,
): Loaded<T> {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T>>({ request: '', at: 0 });
  const latest = useRef({ load, onSignedOut });
  useEffect(() => {
    latest.current = { load, onSignedOut };
  });

  const request = `${key}#${tick}`;
  useEffect(() => {
    let live = true;
    latest.current
      .load()
      .then((data) => {
        if (live) setResult({ request, data, at: Date.now() });
      })
      .catch((reason: unknown) => {
        if (!live) return;
        if (reason instanceof SignedOut) latest.current.onSignedOut();
        const error = reason instanceof Error ? reason.message : String(reason);
        setResult((last) => ({ ...last, request, error }));
      });
    return () => {
      live = false;
    };
  }, [request]);

  useEffect(() => {
    if (!refreshMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    }, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return {
    data: result.data,
    at: result.at,
    error: result.error,
    loading: result.request !== request,
    reload,
  };
}
