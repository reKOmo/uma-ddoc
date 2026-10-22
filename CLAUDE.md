# Umaddoc (uma-ddoc)

A static, mobile-first web app for Uma Musume players (support card tier list, banner/event Timeline, Career
scenarios), deployed to GitHub Pages; no backend, all data is generated at build time.

- **Never commit or push** (no amend either); the user does both. Only exception: a subagent may commit to its own
  local branch (e.g. a worktree), never push.
- **pnpm, never npm.**
- **TypeScript everywhere, strict.** Scripts and `tierlist/` run on Node 24's type stripping (`node scripts/x.ts`, no
  build step): `.ts` in every import path, no `enum` / `namespace` / parameter properties. Never `any`: `unknown` +
  narrowing, or a cast with a `// TODO(ts):` comment saying why.
- **`generated/` is build output** (gitignored): never edit or commit it. **`data/` is committed**; files there built
  from the stored news (`global_events.json`, `jp_events.json`…) are rebuilt by `update-global` / `update-jp`, never
  edited by hand.
- **Use a maintained library before hand-writing a mechanism**; write the least code that does the job; comments only
  say why. Details: [code style](docs/conventions/code-style.md).
- **Anything beyond a small, clear change starts with an interview and a plan, not code**; a plan doc only for really
  big work or when asked, deleted once done. Read the [design process](docs/conventions/design-process.md) first.

## Commands

```sh
pnpm dev          # dev server (fetches card data on first run)
pnpm build        # production build into dist/
pnpm typecheck    # tsc over everything (CI)
pnpm lint         # Biome check (CI); pnpm format applies fixes
pnpm test         # Vitest unit suite (~15s)
pnpm test:e2e     # Playwright (~45s)
```

Every other command (data updates, news, predictions): [docs/commands.md](docs/commands.md).

## Before finishing

- Small UI tweak: `pnpm lint` only. Routing changes and real refactors: `pnpm test` + `pnpm test:e2e`.
  See [testing](docs/testing.md).
- Changed a data shape in `shared/schemas/`: `pnpm build-schemas`.
- Changed a shared news parser: Global's output must stay byte-identical (see [news](docs/data/news.md)).

## Read when relevant

- Where things are: [codebase map](docs/codebase-map.md)
- Conventions: [design process](docs/conventions/design-process.md) · [code style, Biome, git hooks](docs/conventions/code-style.md) ·
  [TypeScript + zod](docs/conventions/typescript.md) · [frontend](docs/conventions/frontend.md)
- Features (what each page does): [Cards tab + card page](docs/features/cards.md) ·
  [Timeline](docs/features/timeline.md) · [Scenarios + Settings](docs/features/scenarios-settings.md)
- Data: [pipeline overview](docs/data/pipeline.md) · [card data](docs/data/cards.md) ·
  [GameTora](docs/data/gametora.md) · [official news](docs/data/news.md) · [events + the model](docs/data/events.md) ·
  [JP cards, banners, events](docs/data/jp.md) · [post classifiers + gold sets](docs/data/classifier.md) · [scenarios](docs/data/scenarios.md) ·
  [predictions (ml/)](docs/data/predictions.md) · [pull guide](docs/data/pull-guide.md)
- [Ranking semantics + upstream parity](docs/ranking.md) · [testing](docs/testing.md) ·
  [CI workflows](docs/ci.md)
