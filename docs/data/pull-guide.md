# Pull guide

- **Pull guide** (`scripts/lib/pull-guide.ts`): Luh's Umamusume Support Card Encyclopedia, a public Google Sheet
  (one tab per Global scenario era, one row per card banner; reruns get their own row). Read from each tab's HTML
  view (`htmlview/sheet?gid=…`): the CSV export has no hyperlinks, and a row's card id is only in its GameTora link
  (`…/supports/<id>-…`, ids are ours); the xlsx export has them but is ~110 MB of art. Cell comments are in neither,
  so they're left out. Columns are found by header text ("Support Card", "Date", "Pull?", "Notes"; one tab has no
  "Notes" header, so it falls back to the column after "Pull?"). Dates:
  exact (`date`), or `month` + early/late for the author's estimates. Notes are wrapped to the column by hand;
  `parseNotes` joins lines back into sentences (a guess: a capital, "(" or digit starts a new one unless the line
  before runs on — a comma/colon/number, a joining word in `CONTINUES`, or a card name split across the break, from
  every tab's card names, so the script parses the tabs twice), splits sentences run together on one line (`STARTS`)
  and drops spaces before "!"/"?". `parsePull` evens out the advice's wording (If Whale, With X, Dolphin, to Lates); advice starting with a limit break ("1LB+ or R MLB") gets the Yes pill, its text placed as before (leading the notes, or the recommendation line when long).
  Each row is matched to one of Global's banners (`findBanner()`, at build time: first release = the earliest
  banner featuring the card, real or predicted; a rerun = the closest by date, within 3 weeks of an exact date, 6 of
  an estimate), so `fetch-pull-guide` runs after `predict-gl`. Verified: every gacha row maps, and the sheet's
  "Rerun" labels match the banners' `new` flags exactly. `pull_guide.json` (shape: `schemas/pull_guide.schema.json`; keep it in step): `{ banners:
  { [banner id]: { [card id]: advice } }, noBanner: { [card id]: advice + release } }`, advice = `{ googleSheetsSrc:
  { gid, row } (the card page links to the row), freePulls (shown only for a banner the news gives none for: the
  news' count, [events](events.md), Free scouts, wins), shouldPull (the pill: yes/no/free/whale/dolphin + the
  advice's "+"s, or null; a card without one whose comment/notes say "With X" takes X's pill when X is on the same
  banner and has one: `withCompanions()`, fuse.js on the banner's card names, so nicknames inside a name match, "Spe",
  "Hishiama", and on `NICKNAMES`, a hand table of those that aren't, "Mambo" for Matikanetannhauser), comment (the line under it), advice (the notes as one paragraph) }`; `noBanner` holds
  event/story/shop cards (free, on no gacha banner) with `release: { label, date | month + part | dateText }` from
  the sheet (the script warns about any other card that maps to no banner). The sheet's
  content is the author's English text, shown as is; credited (with a disclaimer) in About. ~15 requests with 1–2 s pauses; the script fails loudly if no cards are found.
