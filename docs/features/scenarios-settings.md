# Scenarios tab, scenario page, Settings

- **Scenarios** (`#/scenarios`, a tab) and the **scenario page** (`#/scenario/<key>`) are **server-agnostic**: they
  show both servers (JP, then Global) whatever the top bar says, and "Newest on <server>" for each server a scenario is
  the latest launched on (`isCurrent`). The tab lists every Career scenario in launch order: key art thumbnail in its
  colour, name + key (a pill in the scenario's colour), each server's status and date; each opens its page. Its one
  exception to being server-agnostic: only the newest on the top bar's server gets the coloured background.
  The page: key art, English + Japanese names, launch as one card, JP on the left → Global on the right (launched /
  confirmed / predicted with range, how long ago or until, in the Settings timezone; the gap in the middle), Global's
  lag behind JP ("Launched / Expected after …" under the arrow between the two on desktop, a row under the card on phones), a Links section (GameTora's page, and the launch post on umapyoi.net: JP's in Japanese, `news/<id>?lang=jp`, and Global's, `en/news/<id>`), "Open its tier list" (when either
  server's tier list ranks it) and previous / next scenario (on top on phones, at the bottom on desktop; CSS order
  only). On desktop the key art is a sticky column on the left, everything else beside it (`.scenario-body`). Opened from a segment of the banner calendar's scenario strip (that one is per server) or an entry on the
  Scenarios tab (which stays highlighted); the page isn't a tab.
- **Settings** (`#/settings`, a tab) — Times (one section): time zone UTC (default, as the game announces them; "UTC" written after
  times) or the viewer's timezone (not named); a 12- or 24-hour clock (default: the browser's, from its locale's hour
  cycle; settings stored before it existed get the browser's too); scenario names Global (Unity, TB, GC; JP's where Global has none yet, the default) or JP
  (Aoharu, MANT, GL); JP news on umapyoi.net in Japanese (the original, default: `?lang=jp`) or English (umapyoi's
  translation, `?lang=en`), for every umapyoi.net link to a JP post (`src/umapyoi.ts`); remembered in the browser. At the bottom, About: version (package.json), the Cygames
  disclaimer, and credits linking GameTora and the original tier list (Euophrys' Uma Tiers).
