#!/bin/sh
# Fetches new posts (banners, events, updates) from the official sites once a day, Global's (umamusume.com/news) into
# data/news/gl/posts.json and JP's (umamusume.jp/news) into data/news/jp/posts.json, adds announced banners and
# events to each server's own record (data/: scripts/update-global.ts, scripts/update-jp.ts) and commits it all with a
# summary of what was added. Global's posts usually go up at 22:00 UTC. Incremental: each run only asks for posts
# newer than the last one (scripts/fetch-news-latest.ts; the archives were fetched once with `pnpm news:all`).
#
# Run by an external automation, since both sites block GitHub's IPs. It commits but doesn't push: the automation
# pushes the commit to the news branch and opens a PR into main that merges itself once CI passes, which starts the
# deploy. No new or edited posts → no commit.
set -eu

# fetch-news-latest.ts reports update= (something for the records) and changed= (posts to commit) in $GITHUB_OUTPUT.
out=$(mktemp)
trap 'rm -f "$out"' EXIT
GITHUB_OUTPUT=$out node scripts/fetch-news-latest.ts
gl_update=$(sed -n 's/^update=//p' "$out")
gl_changed=$(sed -n 's/^changed=//p' "$out")
: >"$out"
GITHUB_OUTPUT=$out node scripts/fetch-news-latest.ts --server jp
jp_update=$(sed -n 's/^update=//p' "$out")
jp_changed=$(sed -n 's/^changed=//p' "$out")

if [ "$gl_update" = true ] || [ "$jp_update" = true ]; then
  # Both records need card names and titles (generated/cards.json: upstream's lists, data/jp_cards.json, and
  # GameTora's support card list for cards newer than it); JP's banners are our own (data/jp_banners.json).
  node scripts/update-cards.ts && node scripts/scrape-gametora.ts
  # ml/categorize.py classifies each server's posts (update-jp and update-global run it again when ml/.venv
  # exists), before the model is asked: a new post's events are cut by its classified units, and the answers are
  # keyed by those events' ids.
  pnpm setup-ml
  pnpm news:features && pnpm news:categorize
  pnpm news:features --server jp && pnpm news:categorize --server jp
  # A model (OpenRouter's free Gemma) answers what the rules doubt in new events → data/news/<server>/ai_answers.json.
  # Only events without a stored answer are asked. Skipped while OPENROUTER_API_KEY isn't set; a failure here doesn't
  # stop the run (the rules' values are kept).
  if [ -z "${OPENROUTER_API_KEY:-}" ]; then
    echo "OPENROUTER_API_KEY not set, skipping the model"
  else
    if [ "$gl_update" = true ]; then
      node scripts/ai-events.ts || echo "ai-events (Global) failed, keeping the rules' values"
    fi
    if [ "$jp_update" = true ]; then
      node scripts/ai-events.ts --server jp || echo "ai-events (JP) failed, keeping the rules' values"
    fi
  fi
  # JP's banners (data/jp_banners.json) and events (data/jp_events.json), rebuilt from every JP post with the
  # model's answers. Before Global's: Global's news pairs with JP's banners by id. Run on either server's news
  # (it's idempotent), so Global's always pairs with JP's latest banners.
  node scripts/update-jp.ts
  # Global's events (data/global_events.json) are rebuilt by the same script, with the model's answers.
  node scripts/update-global.ts
fi

if [ "$gl_changed" != true ] && [ "$jp_changed" != true ]; then
  echo "No new posts"
  exit 0
fi

# The message: each changed server's count line ("2 new, 0 edited.") in the subject, its whole summary (posts +
# what changed in data/) as a paragraph of the body; a server without new or edited posts is left out.
subject=""
set --
if [ "$gl_changed" = true ] && [ -f data/news/gl/summary.md ]; then
  subject="Global $(sed -n 3p data/news/gl/summary.md)"
  set -- "$@" -m "$(cat data/news/gl/summary.md)"
fi
if [ "$jp_changed" = true ] && [ -f data/news/jp/summary.md ]; then
  subject="${subject:+$subject }JP $(sed -n 3p data/news/jp/summary.md)"
  set -- "$@" -m "$(cat data/news/jp/summary.md)"
fi
git add data/
git commit -m "News: $subject" "$@"
