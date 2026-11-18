const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const KEY = 'solar-epc-token';

export const getToken = () => (typeof window === 'undefined' ? null : window.localStorage.getItem(KEY));
export const setToken = (t: string | null) => (t ? window.localStorage.setItem(KEY, t) : window.localStorage.removeItem(KEY));

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.href = '/login';
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  }
  return res;
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T = any>(path: string) => json<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => json<T>('POST', path, body ?? {}),
  put: <T = any>(path: string, body: unknown) => json<T>('PUT', path, body),
  del: (path: string) => json<void>('DELETE', path),
};

/** Opens a PDF in a new tab. The tab is opened first so popup blockers allow it. */
export async function openDocument(path: string) {
  const tab = window.open('', '_blank');
  try {
    const res = await request('GET', path);
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    throw e;
  }
}
