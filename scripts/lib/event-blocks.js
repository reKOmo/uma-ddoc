// A news post (data/news/gl/posts.json, as the API sends it) cut into blocks, one per event it describes. Pure.
//
// A post can describe several events: a celebration post has a login bonus, a present, a gift, extra race tickets…
// each starting with its own header art (<figure><img …/header_26800002_….png></figure>), then a sentence saying what
// it is and its own headings (availability period, reward contents…). So a block runs from one header art to the
// next; text before the first one (the post's intro) belongs to the first block. A post without header art is one
// block. Scout art (gacha_banner_…) isn't a block boundary.
//
// eventBlocks(post) → [{ art, artId, intro, sections }]
//   art       the header art's URL, or null
//   artId     its 8-digit number (the game's id of the art; the first three digits hint at the kind: 202 race
//             tickets, 301 story event, 302 Legend Race, 303 Champions Meeting…), or null
//   intro     the block's lines before its first heading
//   sections  [{ heading, lines }]: every <h2>/<h3>/<h4> heading in order with the lines under it

import { en } from './news-lang/en.js';
import { decodeEntities, sections, toLines } from './news-text.js';

function block(html, art, lang) {
  const [{ lines: intro }, ...rest] = sections(html, '234');
  const url = art ? decodeEntities(art) : null;
  return {
    art: url,
    artId: url?.match(lang.artId)?.[1] ?? null,
    intro,
    sections: rest.map(({ heading, lines }) => ({ heading, lines })),
  };
}

// `lang`: the posts' wording (scripts/lib/news-lang/: which art starts a block), English by default.
export function eventBlocks(post, lang = en) {
  const html = lang.clean(post.message ?? '');
  const arts = [...html.matchAll(lang.blockArt)].filter((m) => !lang.notBlockArt.test(m[1]));
  if (!arts.length) return [block(html, null, lang)];
  // (JP: the post's intro is a block of its own when text comes before the first art, `lang.introBlock`: that art
  // starts a part.)
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
export const blockLines = (block) => [...block.intro, ...block.sections.flatMap((s) => [s.heading, ...s.lines])];

// A post's blocks as one (for a post about one event): text after a picture still belongs under the heading before it
// (a Legend Race post shows its second race's art between the race periods).
export function joinBlocks(blocks) {
  const sections = [];
  let intro = [];
  for (const block of blocks) {
    if (sections.length) sections.at(-1).lines.push(...block.intro);
    else intro = [...intro, ...block.intro];
    sections.push(...block.sections.map((s) => ({ ...s, lines: [...s.lines] })));
  }
  return { art: blocks[0]?.art ?? null, artId: blocks[0]?.artId ?? null, intro, sections };
}
