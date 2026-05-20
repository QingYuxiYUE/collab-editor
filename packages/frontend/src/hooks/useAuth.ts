import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../utils/runtime-config';

const TOKEN_STORAGE_KEY = 'collab-editor-auth-token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  color: string;
  createdAt: string;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface MeResponse {
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null, remember = true) {
  try {
    if (token) {
      const targetStorage = remember ? localStorage : sessionStorage;
      const staleStorage = remember ? sessionStorage : localStorage;
      targetStorage.setItem(TOKEN_STORAGE_KEY, token);
      staleStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Browser storage unavailable
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : '请求失败，请稍后重试';
    throw new Error(error);
  }

  return payload as T;
}

async function authRequest<T>(
  path: string,
  options: RequestInit = {},
  token: string | null = null,
) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return readApiResponse<T>(response);
}

export function useAuth() {
  const initialToken = getStoredToken();
  const [token, setToken] = useState<string | null>(initialToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(initialToken));

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return;
    }

    authRequest<MeResponse>('/api/auth/me', { method: 'GET' }, token)
      .then(({ user: currentUser }) => {
        if (cancelled) return;
        setUser(currentUser);
      })
      .catch(() => {
        if (cancelled) return;
        setStoredToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await authRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    setStoredToken(response.token, input.remember ?? true);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await authRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    setStoredToken(response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    loading,
    login,
    register,
    logout,
  };
}
