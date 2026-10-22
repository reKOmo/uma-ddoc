# Commands

The everyday ones are in the root CLAUDE.md; this is the full list.

```sh
pnpm dev               # dev server (fetches card data on first run — see note below)
pnpm build             # production build into dist/
pnpm lint              # Biome: formatting + lint check (CI runs this)
pnpm format            # Biome: apply formatting and safe fixes
pnpm test              # Vitest unit suite (~15s; fetches card data if missing)
pnpm test:upstream     # compare our calculation with upstream's (~25s; needs the clone)
pnpm typecheck         # tsc over everything (CI runs this)
pnpm test:e2e          # the app in a browser (Playwright, e2e/; starts the dev server; ~45s; needs
                       # `pnpm exec playwright install chromium` once; E2E_PORT=… for parallel runs)
pnpm test:visual       # screens compared pixel by pixel with baselines made on this machine (.visual-baseline/, not
                       # in git; `--update-snapshots` from a known-good commit; VISUAL_BASELINE=… to share them)
pnpm rank gl GL speed  # print a ranking in the terminal (scenario may be overall / upcoming)

pnpm update-cards      # upstream main's card lists + events → generated/raw/upstream/, then build-cards
pnpm build-cards       # raw inputs + data/jp_cards.json + data/global_cards.json → generated/cards.json + card_stats/
                       # (the three scripts that change an input run it themselves)
pnpm build-schemas     # schemas/*.json from the zod schemas in shared/schemas/ (test/schemas.test.ts fails when stale)
pnpm scrape-gametora    # support card list (augments new cards, slugs) + JP scenarios + JP event history (story events, Champions
                       # Meetings, Legend Races) from GameTora → generated/, then build-cards (--events: only the events)
pnpm update-jp         # JP news → new cards in data/jp_cards.json (augmented from GameTora's list; else pending in
                       # data/jp_cards_pending.json), then build-cards, then data/jp_banners.json (news merged over
                       # GameTora's history, seeded once) + data/jp_events.json
pnpm update-global     # official news → Global's banners, card releases, scenario launches + events in data/ (needs scrape-gametora),
                       # then build-cards
pnpm fetch-pull-guide  # pull advice + notes per card from Luh's Support Card Encyclopedia → generated/pull_guide.json (after predict-gl)
pnpm clone-upstream    # clone/update upstream main into upstream/ (for test:upstream)
pnpm news:latest       # new + edited posts from umamusume.com/news → data/news/gl/posts.json (+ summary.md); periodic runs
pnpm news:all          # every post the site still serves (walks the archive post by post; resumable; once)
pnpm news:umapyoi      # the posts the official site no longer serves, from umapyoi.net's mirror (resumable; once)
                       # each of the three takes --server jp (umamusume.jp → data/news/jp/): news:latest:jp, news:all:jp,
                       # news:umapyoi:jp (parsed by `update-jp`)
pnpm news:categories   # every stored post with its category (banner / event kind / other), for checking the parser
pnpm news:events       # the events the stored news makes (cards, items, titles), printed; nothing written
pnpm news:merges       # every post that joined another post's event, grouped so the unusual merges stand out (--all: the
                       # routine ones too); nothing written
pnpm gold:review       # local page (localhost:5190) to label Global's posts by hand → data/news/gl/gold.json (the gold set)
pnpm news:features     # what the parsers see in each Global post → generated/news_features.json (for news:categorize)
pnpm news:categorize   # classifiers trained on the gold set → data/news/gl/categories.json (ml/categorize.py; --evaluate:
                       # cross-validated against the rules; --hold-out <ids>: those posts as if new, for the tests)
pnpm news:ai           # ask a model about what the rules doubt in events → data/news/<server>/ai_answers.json (--server jp);
                       # --model M, --provider ollama|openrouter, --limit N; --compare [--sample N | --ids a,b] tests a
                       # model against the rules (nothing saved, report in generated/ai-compare-<model>.json)

pnpm setup-ml              # create ml/.venv (uv, Python 3.13) + install ml/requirements.txt
pnpm predict-gl            # predicted Global release dates of JP-only cards → generated/ (Python, ml/; promo cards never),
                           # Global↔JP event pairs + predicted Global events (ml/events.py)
pnpm predict-gl:backtest   # walk-forward backtest of the candidate models
```


On a fresh checkout only upstream's card data is fetched automatically; `cards.json` then takes JP's names, titles,
dates and slugs from `data/jp_cards.json` (committed: every card, the news-made ones too), so nothing is missing
(`pnpm scrape-gametora` only refreshes slugs and augments cards still pending; both servers' banners are committed in
`data/` too; GameTora's banners aren't scraped any more).

For `ml/` (predictions) see [data/predictions.md](data/predictions.md).
