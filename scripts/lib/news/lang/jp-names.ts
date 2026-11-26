import { norm } from '../text.ts';
import type { Block, PostLike } from './index.ts';

// Marks that aren't part of a name: 【予告】, 【重要】, 【修正済み】, 【9/30 11:00公開】.
const unmarked = (title: string) => title.replace(/^(?:【[^】]*】\s*)+|\s*【[^】]*】$/g, '').trim();
const PHASE_END =
  /\s*(?:の?(?:特別)?開催(?:決定|予告|予定|中)?|参加リーグ選択開始|チーム編成期間開始|終了(?:予告|迫る)?|追加|公開|実施中|配信中|登場)?\s*[！!]?$/;

const OPEN: Record<string, string> = { '「': '」', '『': '』' };
// Where each outermost 「…」 / 『…』 opens and closes ([open, close] indices; quotes nested in it are its own).
function topQuotes(s: string): [number, number][] {
  const quotes: [number, number][] = [];
  const stack: string[] = [];
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    if (OPEN[s[i]]) {
      if (!stack.length) from = i;
      stack.push(OPEN[s[i]]);
    } else if (stack.length && s[i] === stack.at(-1)) {
      stack.pop();
      if (!stack.length) quotes.push([from, i]);
    }
  }
  return quotes;
}

// The outermost 「…」 or 『…』 when the title is just that and its phase ("「「ウマ娘」×「Number」コラボキャンペーン」開催！"),
// else the title without its phase ("『うまゆる ふるげ～と！』配信記念キャンペーン開催中！"): a campaign's or event's name.
export function jpName(title: string) {
  const t = unmarked(title);
  const [first] = topQuotes(t);
  if (first?.[0] === 0 && !t.slice(first[1] + 1).replace(PHASE_END, '')) return t.slice(1, first[1]).trim();
  return t.replace(PHASE_END, '').trim() || t;
}
export const named = (m: { input: string }) => jpName(m.input);

// Block art (celebration parts): header_…, banner_…, announce_banner_… (a link to a scout post), also bare <img>s;
// not scout art (gacha_banner_), inline pictures (banner_detail_) or hero images (….jpg without such a name).
export const PART_ART =
  /(?:<figure>\s*)?<img[^>]*\ssrc="([^"]*\/(?:header|banner|announce_banner)_(?:(?:CP|EV)_\d{8}_\d+|\d{4,10})(?:_[^"/.]+)?\.(?:png|jpg)[^"]*)"[^>]*>(?:\s*<\/figure>)?/gi;
const partArts = (post: PostLike) => (post.message ?? '').match(PART_ART)?.length ?? 0;
// A campaign post showing several parts' art is a celebration (G1 campaigns, anniversaries' 第N弾, ゆく年くる年…), as is
// one showing a part's art after an intro of its own ("本キャンペーンでは…", White Day's: checked against the gold set,
// data/news/jp/gold.json).
const INTRO = /本キャンペーンでは|キャンペーンの詳細は、下記/;
export const campaignKind = (post: PostLike) =>
  partArts(post) >= 2 || (partArts(post) === 1 && INTRO.test(post.message ?? '')) ? 'celebration' : 'campaign';

// An item's name as the post writes it: no 「」, no trailing amount.
export const ITEM_QUOTES = /^[「『]|[」』]$|[」』](?=\s*$)/g;
export const jpItem = (name: string) =>
  name
    .trim()
    .replace(ITEM_QUOTES, '')
    .replace(/^[「『](.*)[」』]$/, '$1')
    .replace(/(?:\s*[\d,]+個)$/, '');

// A part of a celebration that is no event of its own (eventBlocks()' block → true): a scout's (its art links to the
// scout's post, or it says a scout is on: paid ones too; a free daily pull is a campaign), a summary of what other
// parts give ("「SSR[…]…」は「…ログインボーナス」で最大2枚、「…ミッション第2弾」で最大3枚、合計5枚を獲得できます！"), or news of a
// feature without dates of its own ("…を追加しました！").
const SCOUT_BLOCK = /ガチャ[」』]?(?:を|が)開催|ガチャ[」』]?と[「『]|開催中の[「『][^」』]*ガチャ[」』]/;
const FEATURE_BLOCK =
  /追加(?:いた)?しました|追加いたします|公開中です|公開しました|できるようになりました|改修|変更しました|更新しました/;
const SUMMARY_BLOCK = /[」』]で最大\d+枚/;
export function blockRole(block: Block) {
  const opening = block.intro.join(' ');
  if (/\/announce_banner_/.test(block.art ?? '')) return 'scout';
  if (SCOUT_BLOCK.test(block.intro[0] ?? '') && !/無料/.test(opening)) return 'scout';
  if (SUMMARY_BLOCK.test(opening) || block.sections.some((s) => /^対象キャンペーン$/.test(s.heading))) return 'summary';
  const dated = block.sections.some((s) => /期間|日時|時期/.test(s.heading));
  if (FEATURE_BLOCK.test(block.intro[0] ?? '') && !dated) return 'feature';
  return null;
}

// A sub-event's name in its opening sentence: of the names it quotes (「…」 / 『…』, nested ones kept), with what follows
// them up to a particle ("「育成報酬」ピース追加キャンペーン"), the first one the sentence says is on, given or added ("「X」を
// 開催中です", "[ミッション]に「X」が登場", "「X」をトレーナーの皆さまにお贈りいたします"), else the first; null without any.
const NAME_VERB = /^(?:を|が)[^「」『』。]{0,25}?(?:開催|お贈り|お送り|プレゼント|販売|公開|実施|登場|開始)/;
function subName(sentence: string) {
  const names = topQuotes(sentence).map(([from, i]) => {
    const inner = sentence.slice(from + 1, i).trim();
    const suffix = sentence.slice(i + 1).match(/^[^\s、。！？!?「」『』をがにはでとのやもへ]*/)?.[0] ?? '';
    const after = sentence.slice(i + 1 + suffix.length);
    return { name: suffix ? sentence.slice(from, i + 1) + suffix : inner, on: NAME_VERB.test(after) };
  });
  // (Not a sentence naming rewards: "…クリアすることで「ジュエル」や「マニー」などの報酬を獲得できます！")
  return (names.find((n) => n.on) ?? (/報酬|など/.test(sentence) ? null : names[0]))?.name ?? null;
}

// A part's name from shapes the quotes alone don't give (checked against the gold set's part names): a pair of paid
// guaranteed scouts ("「★3確定…」と「SSR確定…」"), a rental boost and a story unlock told in a sentence, a daily gift.
export function partName(sentence: string) {
  const pair = sentence.match(/「(★3確定[^」]+)」と「(SSR確定[^」]+)」/);
  if (pair) return `${pair[1]}・${pair[2]}`;
  if (/レンタル回数増加キャンペーン/.test(sentence)) return 'レンタル回数増加キャンペーン';
  if (/ウマ娘ストーリー第\d+話～第\d+話を期間限定で解放/.test(sentence)) return 'ウマ娘ストーリー解放キャンペーン';
  const daily = sentence.match(/毎日、(.+?)を\d+個/);
  return daily ? `${daily[1]}プレゼント` : subName(sentence);
}

// How many copies of a card one part of a celebration gives, from the post's summary of them ("「…ログインボーナス」で
// 最大2枚、「…ミッション第2弾」で最大3枚", "・…ログインボーナス：最大2枚獲得可能"), or null.
export function partCopies(lines: string[], part: string | null) {
  const key = norm(part);
  if (!key) return null;
  for (const line of lines) {
    for (const m of line.matchAll(/[「『]((?:[^「」『』]|[「『][^「」『』]*[」』])+)[」』]で(?:最大)?(\d+)枚/g))
      if (norm(m[1]) === key) return Number(m[2]);
    const bullet = line.match(/^・\s*(.+?)\s*[：:]\s*(?:最大)?(\d+)枚/);
    if (bullet && norm(bullet[1]) === key) return Number(bullet[2]);
  }
  return null;
}
