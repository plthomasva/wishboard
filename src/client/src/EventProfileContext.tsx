import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Category {
  id: string;
  label: string;
  type?: string;
  suggestions?: string[];
}

export interface EventProfile {
  profile: string;
  contact_methods: string[];
  categories: Category[];
  stickers?: Record<string, Record<string, any>>;
  realtimeProvider: string;
  apIp: string;
  isServerless: boolean;
}

const emptyProfile: EventProfile = {
  profile: '',
  contact_methods: ['Phone', 'Email'],
  categories: [],
  realtimeProvider: 'socketio',
  apIp: '',
  isServerless: false,
};

const EventProfileContext = createContext<EventProfile>(emptyProfile);

export const useEventProfile = () => useContext(EventProfileContext);

export const EventProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<EventProfile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setProfile((prev) => ({ ...prev, ...data }));
        setLoaded(true);
      })
      .catch((e) => {
        console.error('Failed to load event profile config:', e);
        setLoaded(true);
      });
  }, []);

  if (!loaded)
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>Loading application config...</div>
    );

  return <EventProfileContext.Provider value={profile}>{children}</EventProfileContext.Provider>;
};

export default EventProfileContext;
