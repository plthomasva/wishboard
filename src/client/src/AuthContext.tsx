import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type AuthUser = {
  id: string;
  username: string;
  role: string;
  identity_genders: string[];
  identity_orientations: string[];
  identity_roles: string[];
  contacts: { type: string; value: string }[];
  wishmail_enabled: boolean;
  is_active: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, passphrase: string) => Promise<{ success: boolean; error?: string; role?: string }>;
  register: (
    username: string,
    passphrase?: string,
    identityFields?: {
      genders?: string;
      orientations?: string;
      roles?: string;
    },
    contacts?: { type: string; value: string }[],
    wishmailEnabled?: boolean
  ) => Promise<{ success: boolean; error?: string; secret?: string; role?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setTokenExternally: (newToken: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const storageKey = 'wishboard-auth-token';

const mapToAuthUser = (data: any): AuthUser => ({
  id: data.id,
  username: data.username,
  role: data.role,
  identity_genders: data.identity_genders || [],
  identity_orientations: data.identity_orientations || [],
  identity_roles: data.identity_roles || [],
  contacts: data.contacts || [],
  wishmail_enabled: Boolean(data.wishmail_enabled),
  is_active: data.is_active === undefined ? true : Boolean(data.is_active)
});

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(storageKey)); // NOSONAR
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const response = await fetch('/api/users/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      setToken(null);
      localStorage.removeItem(storageKey); // NOSONAR
      setUser(null);
      return;
    }

    const data = await response.json();
    setUser(mapToAuthUser(data));
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (username: string, passphrase: string) => {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passphrase })
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed.' };
    }

    setToken(data.token);
    localStorage.setItem(storageKey, data.token); // NOSONAR
    setUser(mapToAuthUser(data));
    return { success: true, role: data.role };
  };

  const register = async (
    username: string,
    passphrase?: string,
    identityFields?: { genders?: string; orientations?: string; roles?: string },
    contacts?: { type: string; value: string }[],
    wishmailEnabled?: boolean
  ) => {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        passphrase,
        identity_genders: identityFields?.genders,
        identity_orientations: identityFields?.orientations,
        identity_roles: identityFields?.roles,
        contacts,
        wishmail_enabled: wishmailEnabled
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Registration failed.' };
    }

    setToken(data.token);
    localStorage.setItem(storageKey, data.token); // NOSONAR
    setUser(mapToAuthUser(data));
    return { success: true, secret: data.secret, role: data.role };
  };

  const logout = () => {
    localStorage.removeItem(storageKey); // NOSONAR
    setToken(null);
    setUser(null);
  };

  const setTokenExternally = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem(storageKey, newToken); // NOSONAR
  };

  const value = useMemo(
    () => ({ user, token, login, register, logout, refreshUser, setTokenExternally }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
