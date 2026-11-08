# UmaTL: English for JP names

What Global hasn't released yet only has Japanese names in our data (JP's cards, banners, events). `pnpm fetch-umatl`
(`scripts/fetch-umatl.ts`, pure part `scripts/lib/umatl.ts`) builds `generated/translations.json` (schema
`shared/schemas/translations.ts`): English for those names, each marked `fan` (UmaTL's fan translation) or official.
The app applies it at display time (`src/translations.ts`, `src/timeline/translate.ts`); without the file, names stay as
the data has them.

## Terms (they constrain the design)

UmaTL isn't openly licensed. Its data may be used **with attribution** by community projects whose scope differs from
its own (a game patch), and **never with generative ML models**. So:

- The app credits UmaTL (Settings → Credits) and marks every fan-translated name with a small "Translation from UmaTL"
  (`src/ui/FanTl.tsx`).
- UmaTL text never enters `data/`, `news:ai`'s prompts or `ml/`: it's fetched into `generated/` only, after those steps
  (deploy: after `predict-gl`), and only the names our data shows are kept in `translations.json`.
- **AI agents (Claude Code) never see it either.** `pnpm fetch-umatl` prints counts, never names. An agent previewing the
  app runs `pnpm dev:ai` (`VITE_AI_PREVIEW=1`): `loadTranslations()` masks every fan translation as dots of its length
  (`masked()`), so layouts and marks can be checked and official names still read; `pnpm dev` shows the real text, for
  people. Unit tests use made-up strings. Enforced in `.claude/settings.json`: `Read` of `generated/translations.json`
  and `generated/raw/umatl_*` (and the built chunk) denied, `WebFetch` of raw.githubusercontent.com denied, and a
  `PreToolUse` hook (`.claude/hooks/guard-umatl.mjs`) refusing shell commands that name those files or UmaTL's repos'
  contents (so edit code that mentions the path with the Edit tool, not a shell script).

## Sources (fetched each deploy at the branch's latest commit, refs in `sources.json`)

- [UmaTL/hachimi-tl-en](https://github.com/UmaTL/hachimi-tl-en) (maintained): `localized_data/text_data_dict.json`, the
  game's text table by category → game id → English. Read (cut into `generated/raw/umatl_text_data.json`): 5 trainee
  outfit titles, 6 character names, 75 / 76 support card full names / titles, 189 story event names.
- [noccu/umamusu-translate](https://github.com/noccu/umamusu-translate) (the original, older): `translations/mdb/*.json`,
  Japanese text → English, for names our data stores only as text (`generated/raw/umatl_mdb.json`). Each kind of name
  reads only its own tables (an event and an item can share their Japanese): items `item-name`, titles
  `trainer-title`, banner names `gacha-names`, events `event-titles` / `login-bonus` / `campaigns` / `gacha-names`.
  Matched under `textKey()` (NFKC, no spaces or 「」『』).
- UmaTL's text is cleaned of the game's layout (`cleanText()`: line breaks, Hachimi's `$(…)` commands, rich-text tags).

## Order (per name): official > GameTora > UmaTL > Japanese

- **Card titles**: cards.json's English (Global's, else GameTora's), else UmaTL's (`cards`, from the full name when
  UmaTL keeps only that). Card names always have English (GameTora).
- **Trainees / characters**: Global's banners' names (and cards.json's for characters), else UmaTL's.
- **Events** (by JP event id): the paired Global event's name (`generated/event_pairs.json`); a JP name a pair
  translated applies to every JP event of that name (a Champions Meeting's cup) unless two pairs disagree; else a
  story event's by its game id (`gt-story-<id>`, or GameTora's story event starting within a day); else the tables.
- **Items, titles, banner names** (by text): the tables; a piece (`[outfit]名前のピース`) is built from its outfit's and
  character's names (trainee id by title + name: GameTora's trainees, JP's banners).

## In the app

- Settings → Language, the same three options per server (**Global** `fanTlGlobal`, default `all`; **JP**
  `jpNames`, default `jp`); `languageOf()` says which of Global's official names, GameTora's and UmaTL's show:
  `jp` Japanese (as JP writes them), `official` Official English (Global's names, e.g. a released character on a
  JP-only card; else Japanese), `all` All English (+ GameTora's, UmaTL's).
- Global in Japanese (`toJapanese()`, `japaneseEntries()` in `src/timeline/translate.ts`): its English names back to
  JP's: cards (cards.json), trainees and banner names (JP's banners, same ids), events through the pairs. What JP has no
  name for stays English: Global's news' items and titles, Global-only events.
- A card's English (`cardEnglish()`) is Global's when the card is out there (its name: when its character is), else
  GameTora's; the file's `chars` hold only Global's and UmaTL's names, the app reads GameTora's from the cards.
- Only Japanese strings are touched; on Global only predicted events (`jp-<id>`) read JP's event ids.
- An event whose name stays Japanese in English is labelled "Kind: 名前" on its bar; the search still finds every
  Japanese name a translation replaced (`Entry.originals`).

## Coverage (2026-11-08)

169 JP-only card titles; event names 438/1194 (most official, through pairs: news-written names like celebrations,
mission sets and campaigns are no game text, so UmaTL never has them); items 99/134, titles 84/106, banner names
55/140. About 35 JP-only SSRs from 2025-03 on are untranslated by UmaTL (its backlog), so they stay Japanese.
`fetch-umatl` prints the counts each run.
