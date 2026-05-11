import { BASE_URL } from '../config';

/**
 * Thin fetch wrapper that injects the auth token and parses JSON.
 * Pass the token from useAuth() — we keep this hook-free so it can be called
 * from helpers and callbacks without re-renders.
 */
export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = opts;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((headers as Record<string, string>) || {}),
  };
  if (token) finalHeaders.Authorization = `Token ${token}`;

  const res  = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });
  const text = await res.text();
  let json: any = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = { error: text }; }
  }
  if (!res.ok) {
    const err = json?.error || `Request failed (${res.status})`;
    throw new Error(err);
  }
  return json as T;
}
