import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Category {
  id: string;
  label: string;
  type?: string;
  suggestions?: string[];
}

export interface DomainConfig {
  domain: string;
  categories: Category[];
  stickers?: Record<string, Record<string, any>>;
  realtimeProvider: string;
  apIp: string;
  isServerless: boolean;
}

const defaultContext: DomainConfig = {
  domain: 'default',
  categories: [
    { id: 'gender', label: 'Gender', suggestions: [] },
    { id: 'orientation', label: 'Orientation', suggestions: [] },
    { id: 'role', label: 'Role', suggestions: [] },
  ],
  realtimeProvider: 'socketio',
  apIp: '',
  isServerless: false,
};

const DomainContext = createContext<DomainConfig>(defaultContext);

export const useDomain = () => useContext(DomainContext);

export const DomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<DomainConfig>(defaultContext);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setConfig((prev) => ({ ...prev, ...data }));
        setLoaded(true);
      })
      .catch((e) => {
        console.error('Failed to load domain config:', e);
        setLoaded(true);
      });
  }, []);

  if (!loaded)
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>Loading application config...</div>
    );

  return <DomainContext.Provider value={config}>{children}</DomainContext.Provider>;
};
