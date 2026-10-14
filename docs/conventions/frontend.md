# Frontend conventions

Stack: React 19 + Vite 8 (CSS Modules), i18next + react-i18next, zustand (remembered state), wouter (hash routing),
Radix Select (dropdown), `vaul` (sheets), `@dnd-kit` (drag to reorder), `lucide-react` icons, `clsx`.

## Text and dates

- **No hard-coded UI text.** Every user-facing string (including `aria-label`s, titles, badges like MLB) lives in
  `src/i18n/en.json`, rendered with `t()` from `useTranslation()`, or `<Trans>` for sentences with markup. i18next
  format: `{{var}}`, plurals `key_one`/`key_other` (pass `count`), `{{items, list}}`. Display names for code keys go
  through `src/i18n/index.ts` (`statName`, `serverName`, `scenarioName`, `lbName`); `tierlist/` and `src/servers.ts`
  hold keys only. A new language is a new JSON file registered in `RESOURCES`.
- Dates go through `formatDate()` / `formatDateTime()` (UI locale). Banner times follow the Settings timezone (UTC by
  default, or the viewer's: `timeZoneOptions()`, `buildTimeline(…, { utc })`). All stored times are UTC.
- New settings: `src/settingsStore.ts` (DEFAULTS + OPTIONS) + a row on the Settings page.

## Layout and styles

- **Mobile first.** Base CSS targets phones; `@media (min-width: 768px)` adds desktop. Top bar always on top; tab bar
  at the bottom on phones, under the top bar on desktop. Pages don't render their own title. Check at 360–390px.
- **CSS Modules**: `X.module.css` beside the component, `camelCaseOnly` (`.see-more` → `styles.seeMore`), combined
  with `clsx`. Global only on purpose: `src/styles/global.css` (tokens, resets, tier colours, tones), `App.css`'s few
  shared classes, and a class other code or CSS looks up by name (keep it a plain class beside the module one, and say
  why).
- Code never finds elements by class: `data-*` (`data-scroll-root`, `data-dragging`, `data-testid`) or roles.
- Colour tokens on `:root` in `global.css` (with a dark override); never literal colours (tier colours `.tier-0`… are
  the exception). An entry's or chip's colour is `data-tone={tone}`; its CSS reads `var(--tone)`.
- Icons: `lucide-react`; no text symbols as icons. Card and trainee icons are square: `object-fit: contain`.

## Components

- **Reuse before writing markup**: `src/ui/` (LinkButton, SeeMore, FoldToggle, Pill, TierChip, Status, Segmented,
  Section, SearchInput, ToolbarButton, CardRow), `src/FilterSheet.tsx`, `src/Sheet.tsx`, `src/Dropdown.tsx`. When two
  places need the same piece, make it a component. Never change how a page looks to make it fit a shared component:
  if one doesn't fit exactly, keep the page's markup.
- Toggle groups: `ui/Segmented.tsx` (a `<fieldset>` of `aria-pressed` buttons).
- **Detail sheets are `src/Sheet.tsx`** (vaul's drawer: drag down to close on phones; a centred dialog on desktop),
  never a hand-made overlay; nothing may set the sheet's `transform`. Keep it rendered with `open` false while it
  closes (`onClosed` once it has slid away), or it vanishes instead of sliding. Its animation must never share the
  main thread with heavy work: the Timeline's lanes and axis are `memo`ised with stable (`useCallback`) props, and the
  sheet's rankings start after `SHEET_ANIMATION_MS`.
- **Dropdowns are `src/Dropdown.tsx`** (Radix Select), never a native `<select>`. Options `{ value, label, icon?,
  group?, note?, badge?, italic?, disabled? }` (icon: an image URL; pill: `{ color, ink }`). Opening scrolls the list to
  the selected option, centred. Radix gives ARIA, keyboard and touch; the list is in a modal portal.
- **Scenario pickers are `src/ScenarioPicker.tsx`**: real scenarios, then the `COMBINED` ones in an "Averaged" group;
  names via `scenarioName()` (never a raw key), each a pill in its cover's colour. Not launched on the selected server
  (`isReleased()`): italic + "Not released yet"; running now (`isCurrent()`): "Current" badge. Every scenario in
  `data/scenarios.json` is listed, newest first; those the tier list doesn't rank are disabled.
- **Charts**: prefer a small, established chart library (the library rule); the existing `RankChart` is hand-written
  SVG. Whatever draws them: colour tokens for marks and text, hairline gridlines, a hover/keyboard crosshair +
  tooltip; long time axes scroll sideways (`useDragScroll`) instead of squeezing labels.

## Routing, data, state

- Hash routing only (GitHub Pages can't serve deep links), with wouter; every address is built by `src/routes.ts`
  (no page writes `#/…` by hand). `vite.config.ts` uses `base: "./"`.
- Data loading in components: `useAsync()` (`src/useAsync.ts`).
- Remembered state: a zustand store persisted through `src/rawStorage.ts`. **Keys and stored formats never change**
  (people would lose their settings); `test/stores.test.ts` checks older formats still load.
- Heavy work (rankings ~100–300 ms each) yields before computing so loading text can paint, and is cached per
  server/scenario/stat.
