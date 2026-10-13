// @ts-nocheck
import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.ts';
import App from './App.tsx';
import './App.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
