// Usage: pnpm news:features [--server jp]   (a server's posts → generated/news_features[_jp].json, what
// ml/categorize.py learns from; see scripts/lib/news/features.ts)

import { serverArg } from './lib/news/api.ts';
import { featuresFile, writeFeatures } from './lib/news/features.ts';
import { GENERATED_DIR, isMain } from './lib/paths.ts';

if (isMain(import.meta.url)) {
  const server = serverArg();
  console.log(`${writeFeatures(server)} posts → ${featuresFile(server).replace(GENERATED_DIR, 'generated/')}`);
}
