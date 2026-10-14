# Card data

- **Card ids are the same on Global and JP and in GameTora's data.** Global has a subset
  of JP's cards. The card data (`scripts/lib/cards.ts`) is:
  - `generated/cards.json`: every card upstream or `data/jp_cards.json` has (a card only GameTora lists isn't one:
    `update-jp` warns), what the site shows: `{ id, charId, type, rarity, name: { en, jp }, title: { en, jp }, release: { gl, jp
    }, source, links: { gametora }, images: { icon } }`. Readable strings (type `speed`…`wisdom`, `friend`, `group`;
    rarity `R`/`SR`/`SSR`), mapped to upstream's codes in `tierlist/join-cards.ts`. "GameTora's" below means
    `data/jp_cards.json`'s (our frozen copy of GameTora's fields, 2026-10-12, then the JP news' cards with
    GameTora's id/type/charId/slug/English; a card in it never takes GameTora's list's values but its slug).
    Type/rarity: upstream's where it has the card. `name.en`: Global's (upstream's gl list) where it has the
    character (by `charId`), else GameTora's; group cards keep GameTora's group name ("Team Sirius"); `name.jp`:
    GameTora's. `title.en`/`release.gl`: ours (`data/global_cards.json`), else GameTora's title;
    `title.jp`/`release.jp`: GameTora's. `source`: how it's obtained, GameTora's `obtained` (`gacha`,
    `story_event`, `promo`, `limited_quest`, `main_story`, `shop`). `links.gametora`: GameTora's page slug
    (`url_name`, e.g. `30321-duramente`; the current list's, else the history's); the app links
    `https://gametora.com/umamusume/supports/<slug>` (`/supports/<id>` alone is a 404). `images.icon`: upstream's at
    its commit, null for cards upstream lacks. No GameTora URLs: the app builds the full art and icons from the id
    (`src/gametora.ts`).
  - `generated/card_stats/<gl|jp>_card_stats.json`: the calculation's inputs per server, `{ [id]: { charName,
    events, lb: [LB0…LB4 stats] } }`. `charName` is upstream's per-server name (each in its own language, which
    `scenarioLink` relies on; a group card's is a member's, as upstream has it); `events` the card's event rewards
    (the same on both servers) or null.
  `joinCards()` rebuilds upstream's exact arrays plus `events` per card (verified by `buildCards()` and
  `test/data.test.ts`).

- **`raw/gametora_cards.json`** is GameTora's `support-cards` file cut to what `buildCards()` reads (ids, names,
  titles, type, rarity, JP `release`, `obtained`, `url_name`: the page's slug, not derivable from the name);
  `fromGametora()` turns an entry into `data/jp_cards.json`'s shape (a news card takes its JP fields from the news).
