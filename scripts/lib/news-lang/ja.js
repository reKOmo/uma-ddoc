// The Japanese news' wording (JP, umamusume.jp and umapyoi.net's mirror of it): the same entries as news-lang/en.js,
// read by the same parsers. What the posts look like: docs/jp-news-findings.md.

import { norm, parsePeriodJa } from '../news-text.js';
import { jaBanners } from './ja-banners.js';

// --- titles (post-categories.js) ----------------------------------------------------------------------------------

// Marks that aren't part of a name: 【予告】, 【重要】, 【修正済み】, 【9/30 11:00公開】.
const unmarked = (title) => title.replace(/^(?:【[^】]*】\s*)+|\s*【[^】]*】$/g, '').trim();
const PHASE_END =
  /\s*(?:の?(?:特別)?開催(?:決定|予告|予定|中)?|参加リーグ選択開始|チーム編成期間開始|終了(?:予告|迫る)?|追加|公開|実施中|配信中|登場)?\s*[！!]?$/;

// The outermost 「…」 or 『…』 when the title is just that and its phase ("「「ウマ娘」×「Number」コラボキャンペーン」開催！"),
// else the title without its phase ("『うまゆる ふるげ～と！』配信記念キャンペーン開催中！"): a campaign's or event's name.
function jaName(title) {
  const t = unmarked(title);
  const open = t[0];
  const close = { '「': '」', '『': '』' }[open];
  if (close) {
    let depth = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === open) depth++;
      else if (t[i] === close && --depth === 0) {
        if (!t.slice(i + 1).replace(PHASE_END, '')) return t.slice(1, i).trim();
        break;
      }
    }
  }
  return t.replace(PHASE_END, '').trim() || t;
}
const named = (m) => jaName(m.input);

// Block art (celebration parts): header_…, banner_…, announce_banner_… (a link to a scout post), also bare <img>s;
// not scout art (gacha_banner_), inline pictures (banner_detail_) or hero images (….jpg without such a name).
const PART_ART =
  /(?:<figure>\s*)?<img[^>]*\ssrc="([^"]*\/(?:header|banner|announce_banner)_(?:(?:CP|EV)_\d{8}_\d+|\d{4,10})(?:_[^"/.]+)?\.(?:png|jpg)[^"]*)"[^>]*>(?:\s*<\/figure>)?/gi;
const partArts = (post) => (post.message ?? '').match(PART_ART)?.length ?? 0;
// A campaign post showing several parts' art is a celebration (G1 campaigns, anniversaries' 第N弾, ゆく年くる年…).
const campaignKind = (post) => (partArts(post) >= 2 ? 'celebration' : 'campaign');

const TILDE = '[～〜~]';

// An item's name as the post writes it: no 「」, no trailing amount.
const ITEM_QUOTES = /^[「『]|[」』]$|[」』](?=\s*$)/g;
const jaItem = (name) =>
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
function blockRole(block) {
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
const OPEN = { '「': '」', '『': '』' };
const NAME_VERB = /^(?:を|が)[^「」『』。]{0,25}?(?:開催|お贈り|お送り|プレゼント|販売|公開|実施|登場|開始)/;
function subName(sentence) {
  const names = [];
  let depth = 0;
  let from = 0;
  const stack = [];
  for (let i = 0; i < sentence.length; i++) {
    const ch = sentence[i];
    if (OPEN[ch]) {
      if (!depth) from = i;
      stack.push(OPEN[ch]);
      depth++;
    } else if (depth && ch === stack.at(-1)) {
      stack.pop();
      if (--depth) continue;
      const inner = sentence.slice(from + 1, i).trim();
      const suffix = sentence.slice(i + 1).match(/^[^\s、。！？!?「」『』をがにはでとのやもへ]*/)[0];
      const after = sentence.slice(i + 1 + suffix.length);
      names.push({ name: suffix ? sentence.slice(from, i + 1) + suffix : inner, on: NAME_VERB.test(after) });
    }
  }
  // (Not a sentence naming rewards: "…クリアすることで「ジュエル」や「マニー」などの報酬を獲得できます！")
  return (names.find((n) => n.on) ?? (/報酬|など/.test(sentence) ? null : names[0]))?.name ?? null;
}

// How many copies of a card one part of a celebration gives, from the post's summary of them ("「…ログインボーナス」で
// 最大2枚、「…ミッション第2弾」で最大3枚", "・…ログインボーナス：最大2枚獲得可能"), or null.
function partCopies(lines, part) {
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

export const ja = {
  server: 'jp',
  cardLang: 'jp',
  // Dates: JST, years mostly left out (the one nearest the post).
  parsePeriod: parsePeriodJa,
  dateRef: (posted) => posted,
  // Zero-width spaces out, full-width digits and spaces half-width, unquoted attributes quoted (some mirrored posts),
  // and a line break at every heading, so a date and the heading after it don't run together.
  clean: (html) =>
    html
      .replace(/​/g, '')
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
      .replace(/　/g, ' ')
      .replace(/(<[a-z][^>]*?\s(?:src|class|href))=([^"'\s>]+)/gi, '$1="$2"')
      .replace(/<h([2-4])/gi, '<br><h$1')
      .replace(/<\/h([2-4])>/gi, '</h$1><br>'),

  // Community posts (ぱかライブTV, live events, merch, outside collabs, giveaways): labels 2 and 3. Label 1 is in-game
  // news, notices included; label 5 is one maintenance post.
  community: (post) => [2, 3].includes(Number(post.announce_label)),

  phases: [
    [/参加リーグ選択開始|チーム編成期間開始/, 'league_selection'],
    [/^【予告】|開催決定|開催予告|開催予定|公開予定/, 'announced'],
    [/終了迫る|終了予告|終了間近/, 'ending'],
    [/終了[！!]?$/, 'ended'],
    [/開催中|開催[！!]?$|開催$|追加[！!]$|公開[！!]$|配信中|販売開始|登場/, 'started'],
  ],

  // [title pattern, category, kind, name]: the first match wins (after the scouts, found by their art). Anchored where
  // admin posts share the words ("ストーリーイベント「…」のミッションの不具合について").
  rules: [
    [/メンテナンス/, 'other', 'maintenance'],
    [
      /不具合|障害|現象について|エラー|強制終了|進行不能|誤表記|表記の?誤|誤り|詐欺|つながりにくい|アクセスしづらい|開始できない/,
      'other',
      'issue',
    ],
    [
      /WebStore|ウマ箱|デジタルストアセール|コラボ(?:限定)?セット|ウマスク|ウマプラン|月額サービス|新商品「ジュエル|ジュエル価格|ジュエル購入機能|販売開始！$|販売延期/,
      'other',
      'sale',
    ],
    [/延期|中止/, 'other', 'misc'],
    [/ガチャ.*無料|無料.*ガチャ/, 'event', 'campaign', (m) => m.input.match(/「([^」]+)」/)?.[1] ?? named(m)],
    [/ガチャ.*プレゼント！$/, 'event', 'gift', named],
    [
      /^(?:レースイベント|\d{1,2}\/\d{1,2}|\d{1,2}月[上中下]旬)\s*「チャンピオンズミーティング[ 　](.+?)」/,
      'event',
      'champions_meeting',
      1,
    ],
    [
      /^(?:レースイベント|\d{1,2}\/\d{1,2}|\d{1,2}月[上中下]旬)\s*「リーグ オブ ヒーローズ」/,
      'event',
      'league_of_heroes',
    ],
    [/^レジェンドレース(?:開催決定|開催)！$/, 'event', 'legend_race'],
    [/^ストーリーイベント「(.+)」(?:開催決定|開催|終了)！$/, 'event', 'story', 1],
    [/^「特別移籍(?:[ 　].+ Edition)?」(?:開催決定|開催)！$/, 'event', 'transfer_requests'],
    [/^\d+月～\d+月対戦レースイベント/, 'other', 'roundup'],
    [/^育成シナリオ「(.+)」公開！$/, 'other', 'scenario', 1],
    [/^育成シナリオ「.+」がアップデート！$|^「育成シナリオ」の機能改修/, 'other', 'update'],
    [
      /^(?:特別)?イベント「(.*因子研究)」(?:期間限定レース)?の?(?:開催予告|開催決定|開催中|開催|追加|終了迫る|終了予告|終了)！$/,
      'event',
      'factor_research',
      1,
    ],
    [
      /^(?:特別)?イベント「(マスターズチャレンジ)」(?:期間限定レース)?の?(?:開催予告|開催決定|開催中|開催|追加|終了迫る|終了予告|終了)！$/,
      'event',
      'masters_challenge',
      1,
    ],
    [
      /^(?:特別|コラボ)?イベント「(.+?)」(?:期間限定レース)?の?(?:開催予告|開催決定|開催中|開催|追加|終了迫る|終了予告|終了)！$/,
      'event',
      'special',
      1,
    ],
    [/^レースコンテンツ「(.+?)」β版/, 'event', 'special', 1],
    [/^「(.+?)」イベント(?:開催決定|開催)！$/, 'event', 'special', 1],
    [/マンスリーマッチ(?!.*(?:お知らせ|について)$)/, 'event', 'special', named],
    [/(?:ショータイム|お悩み相談).*[！!]$/, 'event', 'special', named],
    [/ショップの開催|ショップラインナップ追加/, 'event', 'shop', named],
    [/ログインボーナス/, 'event', 'login_bonus', named],
    [/ミッションの追加について/, 'other', 'update'],
    [/ミッション/, 'event', 'missions', named],
    [/ピース追加/, 'event', 'campaign', named],
    // Notices about a campaign ("…の販売期間延長とガチャの再開催につきまして", "…で交換ができるSSRサポートカードの対象について")
    [/(?:キャンペーン|周年|Anniv).*(?:について|につきまして)$/, 'other', 'update'],
    [/G[ⅠI]キャンペーン|レース応援キャンペーン|Anniversaryキャンペーン|周年|Anniv/, 'event', 'celebration', named],
    [/キャンペーン/, 'event', campaignKind, named],
    [/プレゼント|配布/, 'event', 'gift', named],
    [/^「(.+)」(?:開催|開催中|開催決定|開催予告)！$/, 'event', 'special', 1],
    [
      /利用規約|プライバシーポリシー|成年年齢|お問い合わせ対応|カスタマーサポート|不正|訴訟|キャスト(?:変更|廃業)|内容調整に関する|配信期限|DMM GAME PLAYERの最新|一部機能について/,
      'other',
      'misc',
    ],
    [/推奨端末|動作環境|iOS ?\d|OSバージョン|再ダウンロード|インストール先|アプリの容量/, 'other', 'update'],
    [/使用期限|有効期限/, 'other', 'update'],
    [/アップデートのお知らせ|データ更新のお知らせ/, 'other', 'update'],
    [
      /バランス調整|調整|仕様変更|変更|改修|改善|機能アップデート|がアップデート|リニューアル|上限|について$/,
      'other',
      'update',
    ],
    [/新機能|の紹介$/, 'other', 'update'],
    [
      /覚醒Lv|進化スキル|トレーニングパス|メインストーリー|フォトスタジオ|ジュークボックス|楽曲追加|新衣装|追加|ライブ公開|動画更新|新登場|上限解放|公開！$/,
      'other',
      'update',
    ],
    [/リリース|配信開始|発売|配信決定/, 'other', 'misc'],
    [/出走が決定/, 'other', 'community'],
  ],

  titleName: jaName,

  // Scouts (banner-posts.js): news-lang/ja-banners.js.
  ...jaBanners,

  // --- blocks (event-blocks.js) -----------------------------------------------------------------------------------

  blockArt: PART_ART,
  // A celebration's intro ("…を開催中です！キャンペーンの詳細は、下記をご確認ください。") is its own block: the first art starts a
  // part.
  introBlock: true,
  notBlockArt: /gacha_banner_|banner_detail_/,
  artId: /(?:header|banner)_(?:(?:CP|EV)_\d{8}_(\d+)|(\d{4,10}))/,

  // --- rewards (event-rewards.js) ---------------------------------------------------------------------------------

  numbers: {},
  // Items Global has too go by Global's names (both servers' events read and sort alike); the rest stay Japanese.
  aliases: {
    ジュエル: 'Carats',
    無料ジュエル: 'Carats',
    無償ジュエル: 'Carats',
    マニー: 'Monies',
    サポートpt: 'Support Points',
    サポートポイント: 'Support Points',
    フレンドpt: 'Friend Points',
    虹の結晶片: 'Rainbow Crystal Shards',
    サポートカードガチャチケット: 'Support Card Scout Tickets',
    育成ウマ娘ガチャチケット: 'Trainee Scout Tickets',
    ニンジンゼリーミニ: 'にんじんゼリーミニ',
  },
  itemAmountPrefix: ITEM_QUOTES,
  itemNameChar: /[\p{L}]/u,
  // (norm() leaves kana decomposed: "ジ" is "シ" + a mark.)
  aliasKey: (key) => key.normalize('NFC'),
  showItem: jaItem,
  // The Japanese name of an item shown by Global's (decision 5 of docs/jp-news-findings.md).
  localName: (raw, shown) => {
    const local = jaItem(raw);
    return local !== shown && !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(shown) ? local : null;
  },
  // "「目覚まし時計」×50、「タフネス30」×100" (also in a dated row): one item per part.
  splitItems: (line) =>
    /^(?:\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s*)?(?:・\s*)?(?:[「『][^」』]+[」』]\s*[×x]\s*[\d,]+\s*[、,]\s*)+[「『][^」』]+[」』]\s*[×x]\s*[\d,]+$/.test(
      line
    )
      ? line.split(/\s*[、,]\s*(?=[「『])/)
      : [line],
  // (A summary of a celebration, "…最大6000個のジュエルをプレゼントなど、盛りだくさんな内容", gives nothing itself; nor do
  // limited packs: "3回限定 ジュエル 7500個".)
  notReward:
    /有償|使用する|使用して|消費|購入|販売|価格|税込|必要|エントリー|交換に必要|割引|引換券付き|盛りだくさん|回限定|パック|称号/,
  // A post may cut a card's title short.
  titlePrefix: true,
  notGiven: /ピックアップ|提供割合|ボーナス|ランキング|交換|固有スキル|スキル詳細/,
  // A total first ("第1話から第3話では1枚ずつ、第4話では2枚の合計5枚").
  // A list of cards that aren't given (one of them is: "…の中から1枚確定で出現します。", an exchange's or rental deck's): the
  // bullets after such a line.
  notGivenList: /中から|候補|対象サポートカード|レンタル|セット内容|交換/,
  copies: /^(?=.*?合計\s*(\d+)\s*枚)|(?:最大|計)\s*(\d+)\s*枚|(\d+)\s*枚ずつ/,
  cardMention: /\[([^\]]+)\]\s*([^\s\]、。！!？?「」『』()（）×]+)/g,
  // New cards (scripts/lib/jp-cards.js reads these; cardsIn() above never does): a card an event gives, named with
  // its rarity. A story event's own SSR ("・イベント限定SSRサポートカード「[“最強”なる眷属]ドゥラメンテ」": rarity, title,
  // name), or a card given on a line that says so (`newCardGiven`, not `notGiven`): "SSRサポートカード「[…]ライスシャワー」
  // をプレゼント", "「SSR[Endless Game]ルーラーシップ」を最大2枚プレゼント" (rarity before or inside the quotes, title, name).
  // (Some posts leave the quotes out, "・イベント限定SSRサポートカード[黄金の夢に溺れよ] オルフェーヴル": then only at the end
  // of a line, where the name can't run on into the sentence.)
  eventCard:
    /イベント限定\s*(SSR|SR|R)\s*(?:サポートカード)?\s*(?:「\s*\[([^\]]+)\]\s*([^」]+?)\s*」|\[([^\]]+)\]\s*([^\s、。！「」]+)\s*$)/g,
  giftCard: /(?:(?<![A-Za-z])(SSR|SR|R)\s*(?:サポートカード)?\s*)?「\s*(SSR|SR|R)?\s*\[([^\]]+)\]\s*([^」]+?)\s*」/g,
  newCardGiven: /プレゼント|獲得|お贈り/,
  login: /^(?:・\s*)?ログイン(\d+)(?:[～〜~](\d+))?日目[：:]\s*/,
  dated: new RegExp(`^\\d{1,2}/\\d{1,2}\\s+\\d{1,2}:\\d{2}\\s*(?!${TILDE})`),
  // "・タフネス30×3", "「マニー」×100000", "ジュエル3000個" (a gift's contents)
  item: /^(?:[・■]\s*)?(.+?)(?:\s*[×x]\s*|(?<![\d×x,])\s*(?=[\d,]+個\s*$))([\d,]+)個?\s*$/,
  itemBullet: /^[・■]\s*/,
  sentenceEnd: /[。！？]$/,
  proseTotal: /最大で?([\d,]+)個/,
  proseAmount: /ジュエル(?:を)?([\d,]+)個/,
  proseItem: /ジュエル/,
  proseGift: /プレゼント|お贈り|お送り|獲得/,
  proseName: 'ジュエル',
  mainRewards: /^主な報酬$|^【(?:獲得|交換)できる注目アイテム】$/,
  bullet: /^・\s*/,
  rewardsLike: /などの報酬|をはじめとした/,
  // (By their Japanese names: aliased to Global's, the Japanese kept.)
  mentioned: [
    ['ジュエル', /ジュエル/],
    ['マニー', /マニー/],
    ['サポートPt', /サポートPt/i],
    ['フレンドPt', /フレンドPt/i],
    ['虹の結晶片', /虹の結晶片/],
    ['サポートカードガチャチケット', /サポートカードガチャチケット/],
    ['育成ウマ娘ガチャチケット', /育成ウマ娘ガチャチケット/],
    // "5.5th Anniversary SSR引換券" (free, from missions); "…SSR引換券付きジュエル" is a paid pack.
    [null, /(?:[\w.]+\s){0,3}SSR引換券(?!付き)/],
  ],
  mentionedName: (s) => s,
  title: /イベント限定称号「([^」]+)」/,
  titleList: /^■イベント限定称号$/,
  // Placeholders ("第○回 LoH ○位": one per place) aren't titles.
  notTitle: /○/,
  missionSet: (name) => /ミッション(?:第\d+弾)?$/.test(name) && name.length <= 40 && !/[。！]/.test(name),
  missionBullet: /^[・■【]\s*|】$/g,

  amount: /([\d,]+)\s*個の?(ジュエル|マニー|サポートPt|フレンドPt)|(ジュエル|マニー)を?([\d,]+)個/,
  amountWord: (word) => word,
  per: /1日|毎日|日ごと|ログイン日数|各話|ごとに/,
  copiesCount: /\d+\s*枚/g,
  copiesTalk: /枚/,
  copiesNext: /枚|回/,

  // --- events (events.js) -----------------------------------------------------------------------------------------

  period: /期間|日時|時期/,
  notOwn:
    /報酬受け?取り?|受け取り期限|集計|結果発表|ストーリー解放|再開催|対象のトレーナー|使用期限|出走登録|マッチング|ランキング|交換期間/,
  main: /^(?:イベント)?開催期間$|ガチャ開催期間$|販売期間|参加リーグ選択期間|チーム編成期間|ログインボーナス開催期間|ショップ開催期間|キャンペーン開催期間|開催予定時期/,
  timing: /プレゼント(?:予定)?日時|追加(?:予定)?日時/,
  // "8/9 12:00から、…を開催中です！", a gift's "8/12 12:00に、…をお贈りいたしました！"
  starts: /\d{1,2}:\d{2}\s*(?:から|より|に)/,
  // A gift without an end of its own lasts until the deadline of who gets it ("対象のトレーナー: 2022/9/29 11:59までに
  // ゲームを開始したトレーナーの皆さま"), ISO, or null.
  deadline: (block, posted) => {
    const line = block.sections.find((s) => /^対象のトレーナー$/.test(s.heading))?.lines.find((l) => /まで/.test(l));
    return line ? parsePeriodJa(line, posted).start : null;
  },
  // (Anywhere in the sentence: "日々の感謝の気持ちを込めまして、8/24 12:00から「…」を開催しております！")
  opening: (line) => /\d{1,2}\/\d{1,2}\s*\d{1,2}:\d{2}\s*(?:から|より|に)/.test(line),
  // (Not notes: "【9/22 12:00追記】", "「10/14 12:00 ～」" quoting a changed date.)
  periodLine: (line) => line.length < 90 && !/^[・※【「]/.test(line) && !/追記/.test(line),
  cmPhases: [
    ['league_selection', /^参加リーグ選択期間$/],
    ['round_1', /^ラウンド1$/],
    ['round_2', /^ラウンド2$/],
    ['final_registration', /^決勝ラウンド[：:]出走登録期間$/],
    ['final_matching', /^決勝ラウンド[：:]マッチング期間$/],
    ['final_race', /^決勝ラウンド[：:]レース開催期間$/],
  ],
  // A League of Heroes' schedule (its keys are labelled in the app like CM_PHASES': src/i18n/en.json events.phase).
  schedules: {
    league_of_heroes: [
      ['team_formation', /^チーム編成期間$/],
      ['main_stage', /^メインステージ開催期間$/],
      ['extra_registration', /^エクストラステージ\s*出走登録期間$/],
      ['extra_matching', /^エクストラステージ\s*マッチング期間$/],
      ['extra_voting', /^エクストラステージ\s*ウマいね！?受付期間$/],
      ['extra_race', /^エクストラステージ\s*レース開催期間$/],
    ],
  },
  // Story events with a typo in one post's name ("白焔の乱華" / "白焔の爛華"): the same dates make them one.
  sameDates: ['story'],
  // Posts at the same stage about one event each give some of its windows: their dates add up.
  unionDates: true,
  // Cups and Leagues of Heroes are announced up to two months ahead, without dates ("9月下旬「チャンピオンズミーティング
  // CLASSIC」開催予定！").
  sameEventDays: (kind) => (['champions_meeting', 'league_of_heroes'].includes(kind) ? 75 : 45),
  blockRole,
  partCopies: (lines, part) => partCopies(lines, part),
  // A sale without a name in its sentence ("通常時よりもお得なジュエルを回数限定で販売中です！"): its first item; limited-time
  // missions without one ("…ホームの[ミッション]に期間限定ミッションが登場！"): "期間限定ミッション".
  blockName: (block) =>
    block.intro.join(' ').match(/(期間限定ミッション)が登場/)?.[1] ||
    block.sections
      .find((s) => /^販売内容$/.test(s.heading))
      ?.lines.find((l) => /^・/.test(l))
      ?.replace(/^・\s*/, '')
      .trim() ||
    null,
  // A sub-event's opening: "M/D H:MMから[、]「X」を開催中です！", "…[ミッション]に「X」が登場！"
  subOpening: /^.*?\d{1,2}:\d{2}\s*(?:から|に)、?/,
  subName,
  subNames: [],
  cleanName: (s) => s.trim(),
  notNameHeading: /注意事項|詳細|内容|について|方法/,
  subKinds: [
    ['sale', /販売|購入できる|必要ジュエル/],
    ['login_bonus', /ログインボーナス/],
    ['missions', /\[ミッション\]|ミッション」?が登場|期間限定ミッション|ミッション(?:第\d+弾)?(?:\s|$)/],
    ['shop', /\[ショップ\]|ショップ|限定セール/],
    // (A free daily pull is a campaign, whatever it says it gives.)
    ['campaign', /無料キャンペーン/],
    ['gift', /プレゼント|お贈り|お送り/],
    ['special', /イベント[」』]?$|^イベント[「『]/],
    ['campaign', /キャンペーン/],
  ],
  gives: /プレゼントの?内容|報酬内容/,
  // Parts that don't stretch their celebration: sales (a starter pack stays on sale for a year or more after it).
  notSpanning: (event) => event.kind === 'sale',
  missionRewards: (line) => /ミッション/.test(line) && /報酬/.test(line),
};
