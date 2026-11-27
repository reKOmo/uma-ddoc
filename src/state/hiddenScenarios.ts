// The scenarios hidden from the card page's "Tier by scenario" table, a zustand store: kept across cards, and in this
// browser's storage across reloads (the stored JSON is `{ hidden }`, never changed). A list of the hidden ones, so a
// scenario added later shows. Storage can be missing or throw: then it's kept only while the page is open.

import * as z from 'zod/mini';
import { persisted } from './rawStorage.ts';

const schema = z.object({ hidden: z.catch(z.array(z.string()), []) });

type State = { hidden: string[]; setHidden: (hidden: string[]) => void };

export const useHiddenScenarios = persisted<State>(
  'uma-ddoc.hiddenScenarios',
  { hidden: [], setHidden: (hidden) => useHiddenScenarios.setState({ hidden }) },
  (raw) => schema.safeParse(JSON.parse(raw)).data ?? null,
  ({ hidden }) => JSON.stringify({ hidden })
);
