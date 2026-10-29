# CI workflows

- `deploy.yml` — on push to main, daily, manually, and on every PR (build + tests only, no deploy): install → `pnpm lint` → `update-cards` → `pnpm typecheck` (needs `generated/`) →
  `scrape-gametora` → `update-jp` → `update-global` (both not committed) → `setup-ml` + `predict-gl` → `fetch-pull-guide` → `pnpm test` → `pnpm test:e2e` → build → GitHub Pages. If any
  step fails the job fails and the last good deploy stays live.
- `upstream-check.yml` — on push to main, daily, and manually: install →
  `clone-upstream` → `update-cards` → `pnpm test:upstream`. A failure (GitHub emails)
  means upstream changed; deploys don't depend on it.
- News isn't a GitHub workflow (both news sites block GitHub's IPs): an external automation runs `pnpm news:run`
  (`scripts/news-run.sh`) daily at 23:43 UTC on a clean checkout of main:
  `news:latest` for Global, then `--server jp`; if a banner, event or scenario post came in on either, `update-cards` +
  `scrape-gametora`, then `setup-ml` + `news:features` / `news:categorize` for both servers, `news:ai` per server that
  updated (OpenRouter; skipped without `OPENROUTER_API_KEY`, never fails the run), then `update-jp` and
  `update-global`; commits `data/` with both summaries as the message. The automation force-pushes that commit to the
  `news` branch and opens a PR into main, or updates the open one, with the message as its title and body, and turns
  on auto-merge: it merges once `build` passes, and the merge deploys. It acts as a GitHub App (Contents + Pull
  requests write), which isn't a bypass actor on main's ruleset.
- Pages source must be set to "GitHub Actions".

## Branches

Work happens on `dev`; `main` is what's deployed. A ruleset on main requires a PR whose branch is up to date with main
and whose `build` check (`deploy.yml`) passed, and blocks force pushes and deletion; the repo admin can bypass it. PRs
merge with a merge commit only, so dev keeps its history and needs no reset after a merge ("Update branch" on the PR
merges main's news commits back into dev). Dependabot opens weekly PRs against dev (`.github/dependabot.yml`).
