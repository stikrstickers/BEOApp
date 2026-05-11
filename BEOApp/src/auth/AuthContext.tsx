import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, setToken as setApiToken, setOn401 } from '@/lib/api';
import type { User, UserRole } from '@/lib/types';

const TOKEN_KEY = 'beo_auth_token';

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  /** Required when role='planner'. */
  org_name?: string;
  brand_color?: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  initializing: boolean;
  register: (payload: RegisterPayload) => Promise<void>;
  signIn: (payload: LoginPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setLocalToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const applyToken = useCallback(async (t: string | null) => {
    setLocalToken(t);
    setApiToken(t);
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  const signOut = useCallback(async () => {
    const cur = token;
    if (cur) {
      try { await api('/api/auth/logout/', { method: 'POST' }); } catch { /* ignore */ }
    }
    setUser(null);
    await applyToken(null);
  }, [token, applyToken]);

  // 401 from anywhere = nuke session. Single source of truth.
  useEffect(() => {
    setOn401(() => {
      setUser(null);
      setLocalToken(null);
      setApiToken(null);
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    });
    return () => setOn401(null);
  }, []);

  // Boot: restore token + hydrate /me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored) return;
        setLocalToken(stored);
        setApiToken(stored);
        const me = await api<{ user: User }>('/api/auth/me/');
        if (!cancelled) setUser(me.user);
      } catch {
        if (!cancelled) {
          setLocalToken(null);
          setApiToken(null);
          await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await api<{ token: string; user: User }>('/api/auth/register/', {
      method: 'POST', body: payload, anonymous: true,
    });
    await applyToken(res.token);
    setUser(res.user);
  }, [applyToken]);

  const signIn = useCallback(async (payload: LoginPayload) => {
    const res = await api<{ token: string; user: User }>('/api/auth/login/', {
      method: 'POST', body: payload, anonymous: true,
    });
    await applyToken(res.token);
    setUser(res.user);
  }, [applyToken]);

  const refresh = useCallback(async () => {
    const me = await api<{ user: User }>('/api/auth/me/');
    setUser(me.user);
  }, []);

  const value: AuthContextValue = {
    user, token, initializing, register, signIn, signOut, refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
