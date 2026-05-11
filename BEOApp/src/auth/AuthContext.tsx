import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '../config';
import { AuthUser } from '../types';

const TOKEN_KEY = 'beoapp.auth.token';

type AuthState = {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;     // true while restoring from secure storage on startup
  signIn:    (email: string, password: string) => Promise<void>;
  signUp:    (email: string, password: string, name: string) => Promise<void>;
  signOut:   () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,  setUser]  = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on startup. If the saved token is rejected by the server,
  // we silently drop it — the user lands on the login screen.
  // Hard 4s timeout so an unreachable backend can't trap the splash on the
  // loading spinner forever (fetch has no built-in timeout in RN).
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored) return;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        try {
          const res = await fetch(`${BASE_URL}/api/auth/me/`, {
            headers: { Authorization: `Token ${stored}` },
            signal: ctrl.signal,
          });
          if (!res.ok) {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            return;
          }
          const json = await res.json();
          setUser(json.user);
          setToken(stored);
        } finally {
          clearTimeout(timer);
        }
      } catch (_) {
        // Backend offline / aborted; fall through to logged-out state.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistSession = async (newToken: string, newUser: AuthUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  // Always read as text first, then try JSON. If the server returned HTML
  // (Django debug page, Metro 404, captive-portal, etc.) the alert surfaces
  // the actual response start so we can see what we're hitting.
  async function postJson(path: string, body: object) {
    const url = `${BASE_URL}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (e: any) {
      throw new Error(`Network error to ${url}: ${e?.message ?? 'unknown'}`);
    }
    const text = await res.text();
    let json: any = null;
    if (text) {
      try { json = JSON.parse(text); } catch {
        throw new Error(
          `Got non-JSON ${res.status} from ${url}. Body starts: ${text.slice(0, 120)}`,
        );
      }
    }
    if (!res.ok) {
      throw new Error(json?.error || `Request failed (${res.status})`);
    }
    return json;
  }

  const signIn = useCallback(async (email: string, password: string) => {
    const json = await postJson('/api/auth/login/', { email, password });
    await persistSession(json.token, json.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const json = await postJson('/api/auth/register/', { email, password, name });
    await persistSession(json.token, json.user);
  }, []);

  const signOut = useCallback(async () => {
    const t = token;
    setUser(null);
    setToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // Best-effort server revocation — don't block on it.
    if (t) {
      fetch(`${BASE_URL}/api/auth/logout/`, {
        method:  'POST',
        headers: { Authorization: `Token ${t}` },
      }).catch(() => {});
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
