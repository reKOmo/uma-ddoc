import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.js';
import App from './App.jsx';
import { SettingsProvider } from './settings.jsx';
import './App.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);
