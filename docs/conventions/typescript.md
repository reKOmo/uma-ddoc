# TypeScript

One `tsconfig.json`: `strict`, `nodenext`, `erasableSyntaxOnly`,
`allowImportingTsExtensions`. `pnpm typecheck` (= `tsc`) must pass; CI runs it (it needs `generated/`).

- Scripts and `tierlist/` run on Node 24's type stripping (`node scripts/x.ts`): `.ts` in every import path, no
  `enum` / `namespace` / parameter properties.
- Never `any`: `unknown` + narrowing, or a cast with a `// TODO(ts):` comment saying why (mostly JSON from outside:
  GameTora, umapyoi.net, a model's reply).
- **Data shapes are zod schemas** in `shared/schemas/` (types via `z.infer`; `files.ts` maps each data file to its
  schema). `schemas/*.json` are generated from them by `pnpm build-schemas` (`test/schemas.test.ts` fails when stale).
- `src/` imports schema types only (`import type`), so zod stays out of the bundle, except where stored state is
  parsed (`zod/mini`).
- Tests type partial data with `fixture<T>()` and must-exist lookups with `present()` (`test/helpers.ts`).
- Generated card data is JSON imported `with { type: 'json' }`, so the same imports work in Node and Vite (a dev-only
  plugin in `vite.config.ts` strips the attribute from dynamic imports, which the browser rejects).
