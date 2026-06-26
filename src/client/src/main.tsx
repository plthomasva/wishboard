import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const initApp = async () => {
  if (import.meta.env.NODE_ENV !== 'test') {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      (window as any).__WISHBOARD_CONFIG__ = config;
    } catch (err) {
      console.error('Failed to load server config:', err);
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

initApp();
