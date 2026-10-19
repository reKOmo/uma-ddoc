# Timeline

- **Timeline** (`#/timeline`, a tab; `#/banners` still works) — a horizontal, scrollable/draggable calendar of past and current
  gacha banners (Global: our own record in `data/`, kept up from the official news; JP: our own record too, GameTora's
  history seeded once and the JP news merged over it, R cards, paid scouts and re-runs included).
  While a sheet is open the address is `#/timeline/<server>/<id>` (replaced, not pushed; ids are unique on a server,
  banners' and events' alike), so going back to the Timeline from a card's page reopens the sheet.
  **Both servers run exactly the same code, fed different data** (`src/timeline/`): every banner and event becomes an
  *entry* (`entries.ts`, one shape whatever the server or source; every difference between the data files is read
  there and nowhere else), the page has no `server ===` branch, and one sheet (`TimelineSheet.tsx`, on `src/Sheet.tsx`: drag it down to close)
  shows every banner and event alike: art, kind pill, name, status + dates, where its dates come from (predicted /
  confirmed from JP's; paid), relations (re-run of / re-held / part of, each opening the other), featured items or
  cards with their tier-list rank, other rewards, schedule, titles, parts, the post + umapyoi.net; sections without
  content aren't shown. Cards rank in the server's own tier list (MLB, the selected scenario); when it lacks one of
  them (an announced or predicted card on Global), in the one that also ranks JP's cards it doesn't have yet
  (`useRankings.ts`, as the card page's dashed future). Global's calendar continues into the
  future with JP's banners at their predicted Global dates (`ml/`), drawn half-transparent
  with JP art (nearly solid and "confirmed" when `data/known_dates.json` has their exact dates). Banners from the news
  use the official art and link to their post.
  A strip above the date axis shows which Career scenario runs when on that server (`data/scenarios.json`,
  `src/timeline/scenarioStrip.ts`), each in its cover's colour: the current one solid, unlaunched ones faint (confirmed) or
  dashed (predicted), with a line down the calendar where each begins; labels stick to the left edge while scrolling, with a › arrow (it opens the scenario page) right after the
  name on desktop and at the segment's right edge on phones (`overflow: clip`, not hidden, keeps sticky working).
  Events under the banners on both servers (`data/global_events.json` / `data/jp_events.json`, loaded per server by
  `loadEvents()` in `src/timeline/data.ts`; JP's names as the posts give them, items by Global's name where Global has the item (else Japanese);
  `src/timeline/events.ts`) in labelled groups by type
  (`EVENT_GROUPS`, after the support card then trainee banners: story & special, celebrations, gifts & login bonuses,
  bonuses, missions, Champions Meetings, League of Heroes (JP), Legend Races, shops & sales, transfers & outings: what
  gives cards and pulls first, competitive modes next), each group packed on its own. Every group label (the banner sections'
  too) folds its group away (`src/timeline/collapsed.ts`: remembered in localStorage, try/catch; rows stay fixed, bars
  never move). **Filter** (the toolbar's button, with a count of what's hidden, opens a sheet, `TimelineFilter.tsx`: sections
  Banners / Events / Pull advice, each with All / None, "Show all" by the title; a second tab, Order, drags the
  calendar's lane groups into order (`GroupOrder.tsx`, dnd-kit's pointer sensor, by a handle with `touch-action: none`:
  phones drag at once and the rest of a row still scrolls; keyboard too; tabs with icons; "Reset order" by
  the title (on the Order tab, where "Show all" is on the Show tab); both tabs share one grid cell (the other
  invisible + `inert`), so switching never resizes the sheet; `src/timeline/order.ts`: remembered in localStorage,
  the lanes and the chips both follow it); every change applies and is saved at once, no Done; `src/timeline/hidden.ts`: remembered in
  localStorage, try/catch, the same for both servers): a toggle per banner section (trainee, support card) and event
  kind the calendar has, in its groups' order; when the pull guide covers any of the calendar's banners (Global's), a
  toggle per pull-advice verdict (Yes / No / Free / If Whale / If Dolphin / No advice: a support card banner stays
  while one of its cards has a verdict shown; `VERDICTS`, `bannerVerdicts()` in `src/pullGuide.ts`; greyed out while
  support card banners are hidden).
  Hidden bars leave the lanes (a hidden event's parts of shown kinds stand on their own; the calendar's dates and the
  sheets keep everything). **Compact mode** (the toolbar's fold button, on by default, `src/timeline/compact.ts`: remembered in
  localStorage): rows with nothing in view (± half a screen) fold away while scrolling slowly or once it stops (`visibleRows()` in
  `layout.ts`), so a group is only as tall as what's on screen; rows are never repacked, a bar never changes row. An event with parts (a celebration's sub-events, an event's mission sets) is one bar with a "+N" fold
  button (`.bar-fold`); unfolded, its parts' rows open under its row over a band tinted in its colour
  (`.event-parts-band`), nested parts the same way. Bars: the post's art covering the bar
  (`background-size: cover`, like banners' official art) behind the banners' gradient, edge coloured by kind family; under 64px a bar is a chip
  (no label, no art; name in the tooltip and sheet); an event run on a race shows its first one's course after its
  name ("Sagittarius Cup · Nakayama 2500m", `raceLabel()`); a bar whose end is only predicted (an announced cup)
  fades out at its end, its sheet saying "end predicted" and marking its schedule's predicted rows. A bar opens a sheet: dates, "Part of <event>" (opens it), the
  support cards it gives first (to their card page, copies), its races (course, distance, turns; season, weather,
  ground, JP's time of day; "vary from race to race" for League of Heroes / Dream Team; a predicted event's marked as
  JP's), other rewards (carats, monies, shards first; ranges for
  Champions Meetings), its schedule (a cup's league selection, rounds, final round steps; a story event's period and reward collection…), titles, its parts (open them; a
  "Support cards" pill on those giving one), the news post and umapyoi.net's copy of it (`src/umapyoi.ts`: JP's in
  Japanese, `news/<id>?lang=jp`; Global's `en/news/<id>`; every event with a post has both, GameTora-filled ones none).
  News-made banners' sheets link both too.
  Global's calendar also shows **predicted events** (`generated/predicted_global_events.json`, optional like the
  predicted banners): every JP event Global hasn't had yet at its predicted Global date, in the same groups,
  half-transparent (nearly solid when its start is confirmed), with JP's names and art; the sheet says "Predicted from the JP event
  of … ± N days" and links JP's announcement. A prediction is dropped when Global's real events already have a newer
  event of its kind (`withPredicted()`, `src/timeline/events.ts`).
  JP's calendar marks where Global is: a window from the JP banner Global is running to its next banner's
  JP start (announced / confirmed / predicted; faded end when predicted), a dashed estimate line inside it
  (linear in time between the two), and a "Global now" button that scrolls there.
