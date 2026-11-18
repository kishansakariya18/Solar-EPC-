'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, type ApiError } from './api';

export interface Me { id: string; name: string; email: string; role: 'ADMIN' | 'SALES' | 'ACCOUNTS'; companyName: string; companyStateCode: string }

const Ctx = createContext<{ me: Me | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void }>({
  me: null, loading: true, login: async () => {}, logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) { setMe(null); setLoading(false); return; }
    // A server that is briefly unreachable (status 0) is retried rather than treated as signed out.
    for (let attempt = 0; ; attempt++) {
      try { setMe(await api.get<Me>('/auth/me')); break; } catch (e) {
        if ((e as ApiError).status === 0 && attempt < 3) { await new Promise((r) => setTimeout(r, 1500)); continue; }
        setMe(null); break;
      }
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string }>('/auth/login', { email, password });
    setToken(res.token);
    await load();
  };
  const logout = () => { setToken(null); setMe(null); window.location.href = '/login'; };

  return <Ctx.Provider value={{ me, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
/** What the signed-in role may change. The API enforces the same rules. */
export function useCan() {
  const role = useAuth().me?.role;
  return { admin: role === 'ADMIN', sales: role === 'ADMIN' || role === 'SALES', accounts: role === 'ADMIN' || role === 'ACCOUNTS' };
}
