// A news post cut into blocks, one per event it describes. Pure.
//
// A celebration post has a login bonus, a present, a gift… each starting with its own header art
// (<figure><img …/header_26800002_….png></figure>), then a sentence about it and its own headings. So a block runs
// from one header art to the next; text before the first one (the post's intro) goes with the first block. A post
// without header art is one block. Scout art (gacha_banner_…) isn't a boundary. The art's 8-digit id hints at the
// kind (202 race tickets, 301 story event, 302 Legend Race, 303 Champions Meeting).

import type { NewsPost } from '../../shared/schemas/news.ts';
import { en } from './news-lang/en.ts';
import type { Block, Lexicon } from './news-lang/index.ts';
import { decodeEntities, sections, toLines } from './news-text.ts';

function block(html: string, art: string | null, lang: Lexicon): Block {
  const [{ lines: intro }, ...rest] = sections(html, '234');
  const url = art ? decodeEntities(art) : null;
  return {
    art: url,
    artId: url?.match(lang.artId)?.[1] ?? null,
    intro,
    sections: rest.map(({ heading, lines }) => ({ heading, lines })),
  };
}

export function eventBlocks(post: NewsPost, lang: Lexicon = en): Block[] {
  const html = lang.clean(post.message ?? '');
  const arts = [...html.matchAll(lang.blockArt)].filter((m) => !lang.notBlockArt.test(m[1]));
  if (!arts.length) return [block(html, null, lang)];
  // JP: text before the first art is a block of its own (`lang.introBlock`), that art starting a part.
  const intro =
    lang.introBlock && toLines(html.slice(0, arts[0].index)).length
      ? [block(html.slice(0, arts[0].index), null, lang)]
      : [];
  return [
    ...intro,
    ...arts.map((m, i) => {
      const start = i === 0 && !intro.length ? 0 : m.index;
      const end = arts[i + 1]?.index ?? html.length;
      return block(html.slice(start, end).replace(m[0], ''), m[1], lang);
    }),
  ];
}

// A block's text as one list of lines, headings included (some lists hang off a heading: "Main Rewards",
// "■ Event-Exclusive Titles").
export const blockLines = (block: Block): string[] => [
  ...block.intro,
  ...block.sections.flatMap((s) => [s.heading, ...s.lines]),
];

// A post's blocks as one (for a post about one event): text after a picture still belongs under the heading before it
// (a Legend Race post shows its second race's art between the race periods).
export function joinBlocks(blocks: Block[]): Block {
  const sections: Block['sections'] = [];
  let intro: string[] = [];
  for (const block of blocks) {
    if (sections.length) sections.at(-1)?.lines.push(...block.intro);
    else intro = [...intro, ...block.intro];
    sections.push(...block.sections.map((s) => ({ ...s, lines: [...s.lines] })));
  }
  return { art: blocks[0]?.art ?? null, artId: blocks[0]?.artId ?? null, intro, sections };
}
