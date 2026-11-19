// An event's name and kind from its post's opening sentences and headings (a celebration's parts).

import type { Block, Lexicon } from './news-lang/index.ts';

// The name in a sub-event's opening sentence ("the Sparkly Magic Show Holiday Present event is underway!" → "Sparkly
// Magic Show Holiday Present"), or null.
export function sentenceName(block: Block, lang: Lexicon): string | null {
  for (const line of block.intro) {
    const sentence = line.replace(lang.subOpening, '');
    // (JP: `lang.subName(sentence)` picks among the names a sentence quotes.)
    const named = lang.subName?.(sentence);
    if (named) return lang.cleanName(named);
    for (const re of lang.subNames) {
      const m = sentence.match(re);
      if (m) return lang.cleanName(m[1]);
    }
  }
  return null;
}

// A sub-event's name from its opening sentences, else its first heading that isn't a period, else null.
export function subEventName(block: Block, lang: Lexicon): string | null {
  const named = sentenceName(block, lang) ?? lang.blockName?.(block);
  if (named) return named;
  const heading = block.sections.find((s) => !lang.period.test(s.heading) && !lang.notNameHeading.test(s.heading));
  return heading ? heading.heading : null;
}

// A sub-event's kind, or null when nothing in it says (it's then a campaign).
export function matchedKind(name: string | null, block: Block, lang: Lexicon): string | null {
  const opening = [name ?? '', block.intro[0] ?? ''].join(' ');
  const headings = block.sections.map((s) => s.heading).join(' ');
  for (const text of [opening, headings]) {
    const kind = lang.subKinds.find(([, re]) => re.test(text))?.[0];
    if (kind) return kind;
  }
  return null;
}
export const subEventKind = (name: string | null, block: Block, lang: Lexicon): string =>
  matchedKind(name, block, lang) ?? 'campaign';
