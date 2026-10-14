# Code style

- **Use libraries, don't hand-write.** Before writing a mechanism yourself (UI behaviour, parsing, retries, storage,
  routing, dates, charts…), look for a maintained library and use it; write it yourself only when nothing fits or it's
  genuinely a few lines. Prefer small, focused, fast libraries (they're shipped to phones: bundle size and speed are
  user experience) over big do-everything ones; take a heavy library only when its weight is actually needed. Choose
  stable, long-established, widely used libraries over what's newly fashionable: few breaking releases, a long track
  record, an active but calm project.
- **Keep it simple:** the least code that does the job clearly. No speculative abstractions, options or layers; delete
  rather than work around.
- **Comments: as few as possible.** A comment only says why, where that isn't obvious (a workaround, a data quirk, a
  trap someone would fall into). No file headers restating what a file is or exports, no comments narrating the code,
  no section banners. Keep licence / attribution headers, `biome-ignore` reasons and `TODO(ts)` notes.

Settled choices (user, 2026-10-13): zod for data shapes, wouter for routing, a small `useAsync` hook for loading (not
TanStack Query), zustand for stored state, Radix Select for the dropdown, `pngjs` for PNG decoding, `node:util`
`parseArgs` for CLI flags, `p-retry` in the scripts. The news parsers stay regex-based (no HTML parser).

## Biome

`biome.json` formats and lints TS/TSX, CSS (CSS Modules parsed) and JSON; run `pnpm format` before committing.
Git-ignored paths (`generated/`, `upstream/`, `dist/`, `.claude/worktrees/`) are skipped. Where code is deliberate,
suppress with `biome-ignore <rule>: <reason>` (see `RankChart`) rather than turning a rule off globally.

## Git hooks (husky)

- Pre-commit: Biome's formatting + safe fixes on staged files (re-staged), then blocks on anything unfixable or a
  failing `pnpm typecheck`. Partially staged files are only checked, never fixed: fix those with `pnpm format` +
  re-stage.
- Pre-push: `pnpm test`.
- `--no-verify` only in an emergency.
