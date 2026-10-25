// Thin fetch wrapper. In dev, Vite proxies /api -> Flask (localhost:5000).
// In production Flask serves the built frontend, so the same origin works.
const BASE = import.meta.env.VITE_API_URL || '';
const KEY = 'nirapod-token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body, token: tokenOverride } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenOverride || getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Is the backend running?'), { code: 'network' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Something went wrong'), { code: data.code, status: res.status });
  }
  return data;
}
