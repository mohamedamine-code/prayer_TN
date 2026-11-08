import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './hooks/useSettings';
import { LocationProvider } from './hooks/useLocation';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <React.StrictMode>
    <SettingsProvider>
      {/* Main window renderer drives the geolocation watcher (consent-gated). */}
      <LocationProvider driver>
        <App />
      </LocationProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
