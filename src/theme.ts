import { getSetting, subscribe } from './settingsStore.ts';

// The pages' own colour (global.css's --bg) per theme: the browser's bar takes it (index.html's theme-color metas).
const PAGE_COLOR = { light: '#f6f2fa', dark: '#141218' } as const;

// Settings' theme on <html>: data-theme light or dark (global.css's colour-scheme follows it), none for the device's
// own. Each theme-color meta: the chosen theme's colour, or its own media's.
export function applyTheme(): void {
  const theme = getSetting('theme');
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? PAGE_COLOR.dark : PAGE_COLOR.light;
    meta.content = theme === 'system' ? own : PAGE_COLOR[theme];
  }
}

// Applies it now and on every change; index.html's inline script has already set it before the first paint.
export function followTheme(): () => void {
  applyTheme();
  return subscribe(applyTheme);
}
