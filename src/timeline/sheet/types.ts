import type { DateFormats } from '../../lib/dates.ts';
import type { SERVERS } from '../../lib/servers.ts';
import type { Entry } from '../entries.ts';

export type ServerKey = keyof typeof SERVERS;
export type Lookup = (key: string) => Entry | undefined;

export type NavigationProps = {
  entry: Entry;
  lookup: Lookup;
  format: DateFormats;
  onSelect: (entry: Entry) => void;
};
