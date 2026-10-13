// Where generated files came from (generated/sources.json): file name → its source. Upstream's files carry the repo
// and commit; GameTora's and the pull guide's a URL (the guide also the sheet's update day).

import { z } from 'zod';
import { Day, Moment } from './common.ts';

export const SourceSchema = z.union([
  z.strictObject({ repo: z.string(), ref: z.string(), fetched_at: Moment }),
  // `updated`: the pull guide's "Latest update" day, null when the sheet gives none.
  z.strictObject({ url: z.string(), updated: Day.nullable().optional(), fetched_at: Moment }),
]);
export type Source = z.infer<typeof SourceSchema>;
export const SourcesFileSchema = z.record(z.string(), SourceSchema);
export type SourcesFile = z.infer<typeof SourcesFileSchema>;
