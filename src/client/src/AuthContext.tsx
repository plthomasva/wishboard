import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from 'react';

type AuthUser = {
  id: string;
  username: string;
  role: string;
  attributes: Record<string, string[]>;
  contacts: { type: string; value: string }[];
  wishmail_enabled: boolean;
  is_active: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  login: (
    username: string,
    passphrase: string
  ) => Promise<{ success: boolean; error?: string; role?: string }>;
  register: (
    username: string,
    passphrase?: string,
    identityAttributes?: Record<string, string>,
    contacts?: { type: string; value: string }[],
    wishmailEnabled?: boolean
  ) => Promise<{ success: boolean; error?: string; secret?: string; role?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setTokenExternally: (newToken: string) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const storageKey = 'wishboard-auth-token';

const mapToAuthUser = (data: Record<string, unknown>): AuthUser => ({
  id: typeof data.id === 'string' ? data.id : String(data.id ?? ''),
  username: typeof data.username === 'string' ? data.username : String(data.username ?? ''),
  role: typeof data.role === 'string' ? data.role : String(data.role ?? 'user'),
  attributes: (data.attributes || data.identity_attributes || {}) as Record<string, string[]>,
  contacts: (data.contacts || []) as { type: string; value: string }[],
  wishmail_enabled: Boolean(data.wishmail_enabled),
  is_active: data.is_active === undefined ? true : Boolean(data.is_active),
});

const migrateLocalStorageExclusions = async (token: string) => {
  const localRaw = localStorage.getItem('wishboard_excluded_wishes'); // NOSONAR
  if (!localRaw) return;
  try {
    const localIds: string[] = JSON.parse(localRaw);
    if (!Array.isArray(localIds) || localIds.length === 0) return;
    for (const wishId of localIds) {
      await fetch('/api/users/me/exclusions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wish_id: wishId }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to migrate local storage exclusions:', err);
  }
};

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  // @refresh reset
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(storageKey)); // NOSONAR
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const response = await fetch('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      localStorage.removeItem(storageKey); // NOSONAR
      setToken(null);
      setUser(null);
      return;
    }

    const data = await response.json();
    setUser(mapToAuthUser(data));
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, passphrase: string) => {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passphrase }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed.' };
    }

    setToken(data.token);
    localStorage.setItem(storageKey, data.token); // NOSONAR
    setUser(mapToAuthUser(data));
    await migrateLocalStorageExclusions(data.token);
    return { success: true, role: data.role };
  };

  const register = async (
    username: string,
    passphrase?: string,
    identityAttributes?: Record<string, string>,
    contacts?: { type: string; value: string }[],
    wishmailEnabled?: boolean
  ) => {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        passphrase,
        identity_attributes: identityAttributes,
        contacts,
        wishmail_enabled: wishmailEnabled,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Registration failed.' };
    }

    setToken(data.token);
    localStorage.setItem(storageKey, data.token); // NOSONAR
    setUser(mapToAuthUser(data));
    await migrateLocalStorageExclusions(data.token);
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
    [user, token, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Context hook export co-located with provider per idiomatic React pattern
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
