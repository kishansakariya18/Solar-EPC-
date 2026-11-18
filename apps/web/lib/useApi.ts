'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Loads a GET endpoint; `reload` refetches. Pass null to skip. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    try { setData(await api.get<T>(path)); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

/** Runs an action with busy and error state for buttons and forms. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}
