# CI workflows

- `deploy.yml` — on push to main, daily, and manually: install → `pnpm lint` → `update-cards` → `pnpm typecheck` (needs `generated/`) →
  `scrape-gametora` → `update-jp` → `update-global` (both not committed) → `setup-ml` + `predict-gl` → `fetch-pull-guide` → `pnpm test` → `pnpm test:e2e` → build → GitHub Pages. If any
  step fails the job fails and the last good deploy stays live.
- `upstream-check.yml` — on push to main, daily, and manually: install →
  `clone-upstream` → `update-cards` → `pnpm test:upstream`. A failure (GitHub emails)
  means upstream changed; deploys don't depend on it.
- `news.yml` — manual for now (the daily 23:43 UTC schedule and the redeploy are commented out): `news:latest` for
  Global, then `--server jp`; if a banner, event or scenario post came in on either, `update-cards` + `scrape-gametora`,
  then `setup-ml` + `news:features` / `news:categorize` for both servers, `news:ai` per server that updated (OpenRouter, with the `OPENROUTER_API_KEY` repo secret; skipped when it isn't
  set, never fails the run), then `update-jp` and `update-global`; commits `data/` with both summaries as the commit
  message and job summary, and starts `deploy.yml` (a GITHUB_TOKEN push doesn't trigger it). Needs
  `contents: write`, `actions: write`.
- Pages source must be set to "GitHub Actions".
