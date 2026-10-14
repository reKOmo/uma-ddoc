# GameTora

- **What still comes from GameTora** (nothing else may): card page links (slugs only), the ids, types, charIds, slugs
  and English names/titles of the JP news' new cards (`update-jp`: scripts/lib/jp-cards.ts), the id and character of
  a trainee debuting on a JP banner (`raw/gametora_trainees.json`, scripts/lib/jp-banners.ts), JP's events without a news source (the pre-mid-2022 fills in `data/jp_events.json`,
  `source: 'gametora'`), Career scenarios (`data/scenarios.json`'s JP side, covers, links), and hotlinked images
  (card art and icons, trainee icons, banner art) whose URLs the app builds from ids (`src/gametora.ts`: no data file
  or generated file stores one, but scenarios' `links`). Both servers' banners are our own records in `data/`,
  seeded once from GameTora's history (2026-10) and kept up from the news; JP's cards are `data/jp_cards.json` (frozen,
  then from the news). Global's banners and card titles/release dates come from `data/`; `raw/gametora_cards.json`
  doesn't even keep GameTora's Global fields. `cards.json` is the one place the two are merged (the site,
  `update-global` and `ml/` all read it). Don't make Global read GameTora again.
- **GameTora scraping** (`scrape-gametora`: the support card list, scenarios, the event history): its pages are
  client-rendered, so the scraper reads GameTora's versioned JSON (`/data/manifests/umamusume.json` →
  `/data/umamusume/<name>.<hash>.json`), one file at a time, 2 s apart. It's an internal format and may change; the
  scraper fails loudly if it does. A banner's `main` item is our own heuristic (highest rarity, then highest rate;
  `pickMain()`, as when the banners were seeded). GameTora's art URLs: `gacha/img_bnr_gacha_<id>.png` (Global's under
  `en/gacha/`), `supports/tex_support_card_<id>.png` (full art), `supports/support_card_s_<id>.png` (icon),
  `characters/thumb/chara_stand_<char_id>_<id>.png` (trainee), all under `https://gametora.com/images/umamusume/`.

- Banner/card images are hotlinked from GameTora and upstream GitHub; the app builds GameTora's URLs from ids
  (`src/gametora.ts`; `src/timeline/data.ts` fills a loaded banner file's `image` and items' `icon` with `withArt()`: Global's
  banners Global's art, JP's and predicted ones JP's; card items GameTora's icon, trainee items `chara_stand_<char_id>_
  <id>`). Full card art is GameTora's `tex_support_card_<id>.png` (3:4 portrait). News-made banners use the official
  art from the post, stored (936×228, no transparent margin: `.bar.official-art` covers instead of GameTora's crop).
