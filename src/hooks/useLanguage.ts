import { useMemo } from 'react';
import { type Language, languageOf } from '../lib/translations.ts';
import type { Server } from '../lib/servers.ts';
import { useSettings } from '../state/settings.ts';

export function useLanguage(server: Server): Language {
  const { fanTlGlobal, jpNames } = useSettings().settings;
  return useMemo(() => languageOf(server, { fanTlGlobal, jpNames }), [server, fanTlGlobal, jpNames]);
}
