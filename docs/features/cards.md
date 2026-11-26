# Cards tab (tier list) and card page

- **Tier list** (the "Cards" tab, `#/`) — ranks support cards per server, scenario and stat. The calculation
  started as a copy of [Euophrys/umamusume-tierlist](https://github.com/Euophrys/umamusume-tierlist)'s
  (MIT, see `tierlist/LICENSE`) and is maintained here now; tests compare it with upstream.
  A rarity × LB filter (the Filter button beside the search box, a sheet like the Timeline's: `src/ui/FilterSheet.tsx`, a
  section of LB chips per rarity with All / None, a count on the button of LBs changed from the defaults; at its bottom
  "Card size": Small / Medium / Large (the default) / Huge, a display preference "Reset filters" keeps) picks which
  copies are shown (default: MLB of everything, plus
  LB0 and LB3 of SSR and SR); tiers are banded on the full ranking, so filtering doesn't move cards between tiers.
  A search box filters by character name and card title (English + Japanese, from `generated/cards.json`; every
  word must match, accents/punctuation ignored); like the LB filter, it doesn't move cards between tiers.
  Stat, LB filter, search and card size are remembered (`src/state/tierListFilters.ts`: kept across pages and in localStorage); the
  scenario is App's (kept across pages, not reloads). "Reset filters" (by the filter sheet's title; disabled at the defaults) restores stat, LB filter and search (card size is kept),
  scenario = the server's default.
  A tier's label (S, A…; a ⌃ pinned to the top of the strip says so) folds it to a slim row ("› N cards hidden · Show"), to compare the tiers around it; while any
  is folded, "Show all hidden tiers" sits above the list. Not remembered: every tier is open on each visit.
  A floating "Back to top" button shows once scrolled past a screen.
  Scenario and stat pickers half the width each. On desktop the tiers are a bit right of centre (left column 1.25× the right), the pickers and filter in a sticky column to their left (`.tier-sidebar`); on phones, above the tiers.

- **Card page** (`#/card/<id>`) — one support card. Mobile first: everything stacks under the art; from 768px the
  art (360px, 3:4) is on the left and the name, tags, "See full stats on GameTora" button under the tags (if GameTora has the card) and the tiles on its right, the
  tiles right under them; the art and that column centred against each other; from 1024px the tier table and Banners sit side by side.
  "The current scenario" below is the one running on the selected server (`currentScenario()`: `isCurrent()`, else the
  newest released), not the Cards tab's pick.
  - **Tiles** (`Summary.tsx`, the current scenario at MLB): the rank tile (its TierChip + "#N of M"; for a card not on
    the server yet, its predicted rank on arrival); "Tier outlook" ("Holds S until ~date, then A": the first predicted
    tier drop, from `useRankHistory()`; only when one is predicted, so never on Japan); for a card not on the server
    yet, its expected release (confirmed or predicted).
  - **Next banner** (`NextBanner.tsx`, the last tile, full width): the card's next banner on its art (like the
    Timeline's bars: GameTora's margin cropped, dark gradient, shadowed text): on Global its next banner, real or
    predicted (or the one running; `upcomingBanner()` in `src/lib/pullGuide.ts`, through `useUpcomingAdvice()`), on
    Japan the first of its own banners not ended. Its status badge + dates (Settings timezone), Rerun when the
    banner's `featured` entry isn't `new`, "in N days" before it starts, its free pulls from the news ("🎁 **50** free
    pulls on this banner"; a predicted banner's "JP gave **120** …": its JP banner's, [events](../data/events.md); the
    guide's own count only for a banner the news gives none for) and "See banner" (`#/timeline/gl/<banner id>`: the
    Timeline switches to Global, centres on that banner and opens its sheet). Headed "Upcoming banner", or "Currently available" while it runs. With no banner to
    come, the event the card comes from (story event, gift, shop…: one running or to come, else its latest), headed by
    its kind, with its name, dates and "See event"; with none either, the card's last banner on its art instead ("Last banner", "No upcoming banners :c" beside it, and the guide's
    advice below is the advice it gave for that banner); with no
    banner at all, "No upcoming banners :c"; for a card on no banner (event/story/shop), the guide's own date and label.
    On desktop the tile grows into the height the art leaves beside it, the art strip with it.
    Under the art, from Luh's Umamusume Support Card Encyclopedia (a public Google Sheet, Global only,
    `currentAdvice()`; "No advice available" under the same heading when it has none, so the tile keeps its shape):
    "Should pull on the next banner?" ("Should pull?" for a running or past one) + its pill (Yes / No / Free / If Whale(+…) / If Dolphin(+…)
    when the advice starts with one; the whole advice as the recommendation line when it says more than the pill, or
    has no pill and is longer than 24 characters, shorter ones lead the notes instead; `parsePull`), "Luh's
    encyclopedia" beside it (the card's row in the sheet), then the notes as one paragraph (`notesParagraph()` at
    build time). The guide's disclaimer (with a link to the sheet) is in About, not on the card page.
  - **Tier by scenario** (`ScenarioTierTable`): a heatmap, the tier colour filling each LB0–MLB cell, then the MLB rank
    ("/ total" hidden on phones); every scenario, then the averaged "Overall" and "Current + future" after a rule.
    The current scenario's name and rank are highlighted. Its Options button (a sheet like the Cards tab's: a chip per scenario, then the averaged
    ones, All / None; a count of the hidden ones on the button) hides rows; remembered across cards and reloads
    (`src/state/hiddenScenarios.ts`, a list of the hidden keys, so a new scenario shows). Only the table: the tiles and
    Rank over time's picker keep every scenario. Not shown for a card not on the server yet.
  - **Available on** (`Banners.tsx`): every banner featuring the card and
    event giving it on the selected server (`cardOrigins.ts`; a card not on Global yet: Global's predicted ones),
    oldest first (a toggle reverses it), 3 shown and the rest folded (on desktop, beside the tier table: every one, in a list
    as tall as the table's box, at least two rows, that scrolls): a kind pill (Banner / Paid banner / Story event /
    Gift: gifts, login bonuses, missions, campaigns / Shop; else the event's own kind) in one colour per kind (not the
    Timeline's: a banner there takes its main card's type), Re-run when the card isn't new on it, status + dates, the
    guide's pull pill (Global), and a link to it on the Timeline (`#/timeline/<server>/<id>`). A part giving it counts,
    not the celebration listing it too. A card on none (the scout pool's R/SR, main story, promo) shows cards.json's
    `source` instead. Paid banners never list cards yet (JP's paid scouts have no featured list). Under the card's
    name, the first origin's kind pill, "+N" for the other kinds it has come by since (all in the tooltip).
  - **Rank over time** (`RankHistorySection`): one panel, the chart beside "Passed by" from 1024px. The pickers
    (scenario, starting on the Cards tab's, + LB), zoom out / in, and an ⓘ that drops down how it's ranked (on phones the ⓘ moves up beside the scenario picker). The chart (`RankChart`): the
    card's whole life, release to the last prediction, at the panel's width; zoomed in (2×, 4×, 8×) it scrolls sideways (drag with a mouse), the rank axis and tier chips fixed, centred on today at the first zoom in and on the view's middle after: its rank as a step line in the
    colour of the tier it's in (`--tier-N`, as everywhere; a soft dark edge on the light theme), continued dashed into the future on Global with
    predicted release dates of JP's cards; a faint dashed rule where the tiers split, each tier's `TierChip` on the right (stacked where a band is thinner than a chip); a small dot
    at each pass (hollow when predicted), a bigger one at the release, each tier change and the end, labels only at the release, today, the last prediction and each tier change ("A · #16"), dropped where
    they'd overlap; "Today" over the plot; the server's scenarios as a coloured rule under the dates (faint while to
    come, named where there's room, linking to each). No tooltip. Clicking the release's or a
    pass's marker scrolls "Passed by" to that row (to the list's top; a phone's page no further than keeps the chart in view) and flashes it. "Passed by": a timeline (solid
    for released, dashed + "Predicted" + "in N days" for predicted passes) of the cards that passed it, icon + name +
    "See card", with a count; on desktop every pass, in a list as tall as the chart that scrolls; on phones folded as
    "Available on" (three rows, then six scrolling, `useRowsHeight`).
  - The tier list's floating "Back to top" button too.
    Opened from tier-list cards and the Timeline sheet's "See more"; it isn't a tab, but keeps the Cards tab highlighted.
