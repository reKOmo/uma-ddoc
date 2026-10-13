import React from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first: components' own (CSS Modules, imported with them) come after and win ties.
import './styles/global.css';
import './i18n/index.ts';
import App from './App.tsx';
import './App.css';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element in index.html');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
