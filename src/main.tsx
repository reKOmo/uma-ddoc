// @ts-nocheck
import React from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first: components' own (CSS Modules, imported with them) come after and win ties.
import './styles/global.css';
import './i18n/index.ts';
import App from './App.tsx';
import './App.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
