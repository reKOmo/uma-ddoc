# Cards tab (tier list) and card page

- **Tier list** (the "Cards" tab, `#/`) — ranks support cards per server, scenario and stat. The calculation
  started as a copy of [Euophrys/umamusume-tierlist](https://github.com/Euophrys/umamusume-tierlist)'s
  (MIT, see `tierlist/LICENSE`) and is maintained here now; tests compare it with upstream.
  A rarity × LB filter (the Filter button beside the search box, a sheet like the Timeline's: `src/FilterSheet.tsx`, a
  section of LB chips per rarity with All / None, a count on the button of LBs changed from the defaults; at its bottom
  "Card size": Small / Medium / Large (the default) / Huge, a display preference "Reset filters" keeps) picks which
  copies are shown (default: MLB of everything, plus
  LB0 and LB3 of SSR and SR); tiers are banded on the full ranking, so filtering doesn't move cards between tiers.
  A search box filters by character name and card title (English + Japanese, from `generated/cards.json`; every
  word must match, accents/punctuation ignored); like the LB filter, it doesn't move cards between tiers.
  Stat, LB filter, search and card size are remembered (`src/tierListFilters.ts`: kept across pages and in localStorage); the
  scenario is App's (kept across pages, not reloads). "Reset filters" (by the filter sheet's title; disabled at the defaults) restores stat, LB filter and search (card size is kept),
  scenario = the server's default.
  A tier's label (S, A…; a ⌃ pinned to the top of the strip says so) folds it to a slim row ("› N cards hidden · Show"), to compare the tiers around it; while any
  is folded, "Show all hidden tiers" sits above the list. Not remembered: every tier is open on each visit.
  A floating "Back to top" button shows once scrolled past a screen.
  Scenario and stat pickers half the width each. On desktop the tiers are a bit right of centre (left column 1.25× the right), the pickers and filter in a sticky column to their left (`.tier-sidebar`); on phones, above the tiers.

- **Card page** (`#/card/<id>`) — one support card's full art, GameTora link (if GameTora has it), and its
  tier at each limit break in every scenario (plus the averaged "Overall" and
  "Current + future" rankings), then a "rank over time" chart (pick scenario + LB)
  and the newer cards that passed it — continued dashed into the future on Global with
  predicted release dates of JP's cards (when it'll drop a tier). Above the tiers, pull advice from Luh's Umamusume
  Support Card Encyclopedia (a public Google Sheet), only for the card's next Global banner, real or predicted (or the one
  running; `upcomingBanner()` + `currentAdvice()` in `src/pullGuide.ts`), in one box:
  - "Upcoming banner", on the banner's art like the Timeline's bars (same crop of GameTora's margin, dark
    gradient, shadowed text, "See banner" a solid accent (pink) button): its status badge + dates as in the Timeline's sheet (Settings timezone; the guide's
    own date for event/story/shop cards, on no banner), then the label pill (Rerun when the banner's `featured`
    entry isn't `new`; the guide's Event, Story… for cards on no banner) and "See banner" on one line.
    "See banner" is `#/timeline/gl/<banner id>` (the Timeline switches to Global, centres on that banner and opens
    its sheet). "No upcoming banners :c" when none is to come.
  - under a rule (beside it on desktop, the box split in two), "Should pull? <pill>": Yes / No / Free / If Whale(+…) / If Dolphin(+…) when the advice starts with one; the
    whole advice as the recommendation line when it says more than the pill, or has no pill and is longer than
    24 characters (shorter, e.g. "With Kitasan", it leads the notes instead; `parsePull`), free pulls, then the notes as one paragraph (`notesParagraph()` at build time: a full stop added where a sentence has none).
  - The box's footer (under both halves): a centred "See more on Luh's encyclopedia" (the card's row in the sheet). The guide's disclaimer (with a link
    to the sheet) is in About, not on the card page.
  - "Available on" (`Origins`, `src/cardOrigins.ts`): every banner featuring the card and event giving it on the
    selected server only (a card not on Global yet: Global's predicted ones), oldest first (a toggle
    reverses it), the first shown and the rest folded; a kind pill (Banner / Paid banner / Story event / Gift: gifts,
    login bonuses, missions, campaigns / Shop; else the event's own kind) in one colour per kind (not the Timeline's: a banner there takes its main card's type), Re-run when the card
    isn't new on it, status + dates, and a link to it on the Timeline (`#/timeline/<server>/<id>`). A part giving it
    counts, not the celebration listing it too. A card on none (the scout pool's R/SR, main story, promo) shows
    cards.json's `source` instead. Paid banners never list cards yet (JP's paid scouts have no featured list). Under
    the card's name, the first origin's kind pill, "+N" for the other kinds it has come by since (all in the tooltip).
  The tier list's floating "Back to top" button too.
  Opened from tier-list cards and the Timeline sheet's "See more"; it isn't a tab, but keeps the Cards tab highlighted.

