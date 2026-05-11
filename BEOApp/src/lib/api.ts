// Typed API client. Single source of token + 401-handling + base URL.
//
// The base URL is derived from Expo's bundler host so the phone always reaches
// the dev backend at <metro-host>:8000. Override with EXPO_PUBLIC_API_URL.

import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

const DJANGO_PORT = 8000;
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;

function tryExtractHost(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(?:^|:\/\/)([a-zA-Z0-9.-]+)(?::\d+)?/);
  return m ? m[1] : null;
}

function resolveBaseUrl(): string {
  if (ENV_URL) return ENV_URL.replace(/\/$/, '');
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any).expoGoConfig?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
    NativeModules.SourceCode?.scriptURL,
  ];
  for (const c of candidates) {
    const host = tryExtractHost(c);
    if (host) return `http://${host}:${DJANGO_PORT}`;
  }
  return `http://localhost:${DJANGO_PORT}`;
}

export const BASE_URL = resolveBaseUrl();

// ── Error types ────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data: unknown;
  fields?: string[];
  constructor(message: string, status: number, data: unknown, fields?: string[]) {
    super(message);
    this.status = status;
    this.data = data;
    this.fields = fields;
  }
}

// ── Auth token holder ─────────────────────────────────────────────────────
//
// We store the token here as module state so api functions don't need it
// passed at every call site. AuthContext is the single writer.

type TokenListener = (token: string | null) => void;
let _token: string | null = null;
const _listeners: TokenListener[] = [];
let _on401: (() => void) | null = null;

export function setToken(token: string | null) {
  _token = token;
  for (const l of _listeners) l(token);
}

export function getToken(): string | null {
  return _token;
}

export function subscribeToken(listener: TokenListener): () => void {
  _listeners.push(listener);
  return () => {
    const i = _listeners.indexOf(listener);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

export function setOn401(handler: (() => void) | null) {
  _on401 = handler;
}

// ── Core request ──────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  // If true, do not attach the auth header even if a token is present.
  anonymous?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.anonymous && _token) headers.Authorization = `Token ${_token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (e: any) {
    throw new ApiError(e?.message ?? 'Network error', 0, null);
  }

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    if (res.status === 401 && _on401) _on401();
    const msg =
      (data && typeof data === 'object' && (data.error || data.detail)) ||
      (typeof data === 'string' && data) ||
      `HTTP ${res.status}`;
    const fields = (data && typeof data === 'object' && Array.isArray(data.fields))
      ? data.fields
      : undefined;
    throw new ApiError(msg, res.status, data, fields);
  }
  return data as T;
}
