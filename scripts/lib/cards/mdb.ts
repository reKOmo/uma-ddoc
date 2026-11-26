// A server's tier-list stats from the game's master.mdb: a port of upstream's db-convert.py (upstream/db-convert.py,
// Euophrys/umamusume-tierlist), which is how upstream builds its gl.js / jp.js. We store the result as the server's
// card list (data/<server>_card_stats.json, read by scripts/build-cards.ts instead of upstream's list). Kept line for
// line with the Python, quirks included: a change there is ported here, and the data test compares the two outputs.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { type StoredCard, type StoredCardStatsFile, StoredCardStatsFileSchema } from '../../../shared/schemas/card.ts';
import { type UpstreamCard, statsOf } from './build.ts';
import type { Server } from '../news/text.ts';
import { DATA_DIR } from '../paths.ts';

export const cardStatsFile = (server: Server): string => `${DATA_DIR}${server}_card_stats.json`;

// Null for a server we don't convert ourselves (yet): it uses upstream's list.
export const readCardStats = (server: Server): StoredCardStatsFile | null =>
  existsSync(cardStatsFile(server))
    ? StoredCardStatsFileSchema.parse(JSON.parse(readFileSync(cardStatsFile(server), 'utf8')))
    : null;

// One card per line, so a new mdb's diff shows the cards that changed. Checked first: a column a new mdb renamed
// comes out as NaN, which would only fail the next build.
export function writeCardStats(server: Server, file: StoredCardStatsFile): void {
  StoredCardStatsFileSchema.parse(file);
  const skipped = file.skipped.map((s) => `    ${JSON.stringify(s)}`).join(',\n');
  const cards = Object.entries(file.cards)
    .map(([id, card]) => `    ${JSON.stringify(id)}: ${JSON.stringify(card)}`)
    .join(',\n');
  writeFileSync(
    cardStatsFile(server),
    `{\n  "source": ${JSON.stringify(file.source)},\n  "skipped": [${skipped ? `\n${skipped}\n  ` : ''}],\n  "cards": {\n${cards}\n  }\n}\n`
  );
}

// Upstream's rows (one per card and limit break) → ours, by id.
export function toStored(rows: UpstreamCard[]): Record<string, StoredCard> {
  const cards: Record<string, StoredCard> = {};
  for (const row of [...rows].sort((a, b) => a.id - b.id || a.limit_break - b.limit_break)) {
    cards[row.id] ??= { type: row.type, group: row.group, rarity: row.rarity, charName: row.char_name, lb: [] };
    cards[row.id].lb[row.limit_break] = statsOf(row);
  }
  return cards;
}

// Ours → upstream's rows, sorted by id and limit break, as the pipeline reads them.
export const toRows = (cards: Record<string, StoredCard>): UpstreamCard[] =>
  Object.entries(cards)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([id, { type, group, rarity, charName, lb }]) =>
      lb.map((stats, limit_break) => ({
        id: Number(id),
        type,
        group,
        rarity,
        limit_break,
        ...stats,
        char_name: charName,
      }))
    );

// A server's card list: ours where we store it, else upstream's.
export function cardRows(server: Server, upstream: UpstreamCard[]): UpstreamCard[] {
  const stored = readCardStats(server);
  return stored ? toRows(stored.cards) : upstream;
}

// A conversion's card list: ours, plus upstream's rows for the cards we skipped that it has (the converter doesn't
// know an effect, upstream converted them by hand).
export function withUpstreamForSkipped(
  rows: UpstreamCard[],
  skipped: Skipped[],
  upstream: UpstreamCard[]
): UpstreamCard[] {
  const ids = new Set(skipped.map((s) => s.id));
  return [...rows, ...upstream.filter((c) => ids.has(c.id))];
}

// Python's `int()` of a float.
const int = Math.trunc;

// The row an effect's values sit in: init, then LB levels 5…50 (support_card_effect_table's 11 value columns).
const LEVELS = [
  'init',
  'limit_lv5',
  'limit_lv10',
  'limit_lv15',
  'limit_lv20',
  'limit_lv25',
  'limit_lv30',
  'limit_lv35',
  'limit_lv40',
  'limit_lv45',
  'limit_lv50',
] as const;

const IGNORE_EFFECTS = new Set([0, 16, 17, 112, 119, 121, 122]);

// command_id → upstream's type code.
const TYPES: Record<number, number> = { 0: 6, 101: 0, 102: 2, 103: 3, 105: 1, 106: 4 };

// GetValue: `data` is the effect row as the Python indexes it (0 id, 1 type, 2 init, 3 limit_lv5 … 12 limit_lv50).
// A level without a value (-1) takes the value between its neighbours that have one.
function getValue(data: number[], lb: number, rarity: number): number {
  let baseValue = -1;
  let baseLb = lb;
  let index = lb + rarity + 5;
  while (index >= 2) {
    baseValue = data[index];
    if (baseValue === -1) {
      index -= 1;
      baseLb -= 1;
    } else break;
  }
  if (baseLb === lb) return baseValue;
  if (baseValue === -1) return 0;

  let maxValue = -1;
  let maxLb = lb;
  index = lb + rarity + 5;
  while (index <= 12) {
    maxValue = data[index];
    if (maxValue === -1) {
      index += 1;
      maxLb += 1;
    } else break;
  }
  if (maxValue === -1) return baseValue;
  if (baseLb === maxLb) return baseValue;
  return int(baseValue + (maxValue - baseValue) * ((lb - baseLb) / (maxLb - baseLb)));
}

type Card = UpstreamCard;

// AddEffectToCard. Returns false for an effect the Python warns about (unknown: the card's numbers would be wrong).
function addEffect(card: Card, type: number, value: number): boolean {
  switch (type) {
    case 1:
      card.fs_bonus += value / 100;
      break;
    case 2:
      card.mb += value / 100;
      break;
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      card.stat_bonus[type - 3] += value;
      break;
    case 8:
      card.tb += value / 100;
      break;
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
      card.starting_stats[type - 9] += value;
      break;
    case 14:
      card.sb += value;
      break;
    case 15:
      card.race_bonus += value;
      break;
    case 18:
      card.hint_rate += value / 100;
      break;
    case 19:
      card.specialty_rate += value;
      break;
    case 25:
      card.energy_up += value / 100;
      break;
    case 26:
      card.effect_size_up += value / 100;
      break;
    case 27:
      card.fail_rate_down += value / 100;
      break;
    case 28:
      card.energy_discount += value / 100;
      break;
    case 30:
      card.stat_bonus[5] += value;
      break;
    case 31:
      card.wisdom_recovery += value;
      break;
    case 32:
      card.fs_motivation += value / 100;
      break;
    // The unique effects below are hard-coded in the Python (their values are in other columns).
    case 101:
      card.fs_stats[4] += 3;
      break;
    case 102:
      card.fs_training += 0.2;
      break;
    case 103:
      card.highlander_training += 0.15;
      break;
    case 104:
      card.fan_bonus = 1;
      break;
    case 110:
      card.crowd_bonus += 0.05;
      break;
    case 120:
      card.fs_stats[0] += 2;
      card.fs_stats[1] += 1;
      card.fs_stats[2] += 1;
      card.fs_stats[3] += 1;
      card.fs_stats[4] += 2;
      card.fs_stats[5] += 1;
      break;
    default:
      return IGNORE_EFFECTS.has(type);
  }
  return true;
}

// The unique effect's two slots as the Python indexes them: `type` is unique[2 + u], `v[k]` is unique[3 + u + k].
type UniqueSlot = { type: number; v: number[] };

// Returns the unknown effects it met (as `unique <type>` / `unique 101 bonus <type>`).
function addUnique(card: Card, { type, v }: UniqueSlot): string[] {
  switch (type) {
    case 1:
      card.unique_fs_bonus += v[0] / 100;
      return [];
    case 19:
      card.unique_specialty = 1.2;
      return [];
    case 103:
      card.highlander_threshold = v[0];
      card.highlander_training = v[1] / 100;
      return [];
    case 101: {
      const unknown: string[] = [];
      for (const [bonusType, bonusValue] of [
        [v[1], v[2]],
        [v[3], v[4]],
      ]) {
        if (bonusType === 1) card.unique_fs_bonus += bonusValue / 100;
        else if (bonusType === 2) card.fs_motivation += bonusValue / 100;
        else if (bonusType >= 3 && bonusType <= 7) card.fs_stats[bonusType - 3] += bonusValue;
        else if (bonusType === 8) card.fs_training += bonusValue / 100;
        else if (bonusType === 19) card.fs_specialty += bonusValue / 100;
        else if (bonusType === 30) card.fs_stats[5] += bonusValue;
        else if (bonusType === 31) card.wisdom_recovery += bonusValue;
        else if (bonusType === 41) for (let i = 0; i < 5; i++) card.fs_stats[i] += bonusValue;
        else if (bonusType > 0) unknown.push(`unique 101 bonus ${bonusType}`);
      }
      return unknown;
    }
    case 106:
      card.fs_ramp = [3, 15];
      return [];
    case 105:
      card.type_stats = 10;
      return [];
    case 108:
      card.tb += 0.12;
      return [];
    case 109:
    case 111:
    case 114:
      card.tb += 0.15;
      return [];
    case 107:
      card.unique_fs_bonus += 0.07;
      return [];
    case 113:
      if (v[0] === 2) card.fs_motivation += v[1] / 100;
      else if (v[0] === 28) card.fs_energy += v[1] / 100;
      return [];
    case 115:
      card.sb += 30;
      return [];
    case 116:
      if (v[1] >= 3) card.stat_bonus[v[1] - 3] += 3;
      else card.fs_training += 0.2;
      return [];
    case 117:
      card.tb += 0.05;
      card.fs_training += 0.1;
      return [];
    case 118:
      card.offstat_appearance_denominator = 2.5;
      return [];
    default:
      return addEffect(card, type, v[0]) ? [] : [`unique ${type}`];
  }
}

// The fields in the Python's assignment order, which is gl.js's key order.
function newCard(id: number, type: number, group: boolean, rarity: number, limitBreak: number): Card {
  return {
    id,
    type,
    group,
    rarity,
    limit_break: limitBreak,
    starting_stats: [0, 0, 0, 0, 0],
    type_stats: 0,
    stat_bonus: [0, 0, 0, 0, 0, 0],
    race_bonus: 0,
    sb: 0,
    specialty_rate: 0,
    unique_specialty: 1,
    offstat_appearance_denominator: type === 6 ? 5 : 4,
    tb: 1,
    fs_bonus: 1,
    mb: 1,
    unique_fs_bonus: 1,
    fs_stats: [0, 0, 0, 0, 0, 0],
    fs_training: 0,
    fs_motivation: 0,
    fs_specialty: 1,
    fs_ramp: [0, 0],
    fs_energy: 0,
    wisdom_recovery: 0,
    effect_size_up: 1,
    energy_up: 1,
    energy_discount: 0,
    fail_rate_down: 0,
    hint_rate: 1,
    highlander_threshold: 4,
    highlander_training: 0,
    crowd_bonus: 0,
    char_name: '',
    fan_bonus: 0,
  };
}

export type Skipped = { id: number; unknown: string[] };

// TODO(ts): node:sqlite's rows are Record<string, SQLOutputValue>; these tables' columns are integers (text_data.text
// a string), checked by converting a real mdb against upstream's gl.js.
type Row = Record<string, number>;

// Every card in the mdb, LB0…LB4, sorted by id. A card with an effect the Python doesn't know (or an unknown
// command_id, where the Python stops) is left out and listed in `skipped`, rather than ranked with wrong numbers.
export function convertMdb(db: DatabaseSync): { rows: UpstreamCard[]; skipped: Skipped[] } {
  // The Python's queries (SELECT *, no ORDER BY): the same plan, so effects add up in the same order.
  const cardsQuery = db.prepare('SELECT * FROM support_card_data');
  const effectsQuery = db.prepare('SELECT * FROM support_card_effect_table WHERE id = ?');
  const uniqueQuery = db.prepare('SELECT * FROM support_card_unique_effect WHERE id = ?');
  const nameQuery = db.prepare('SELECT * FROM text_data WHERE id = 170 AND [index] = ?');

  const rows: UpstreamCard[] = [];
  const skipped: Skipped[] = [];
  for (const data of cardsQuery.all() as Row[]) {
    const unknown = new Set<string>();
    const type = TYPES[data.command_id];
    if (type === undefined) unknown.add(`command_id ${data.command_id}`);
    const effects = (effectsQuery.all(data.id) as Row[]).map((e) => [e.id, e.type, ...LEVELS.map((l) => e[l])]);
    const unique = uniqueQuery.get(data.id) as Row | undefined;
    const slots: UniqueSlot[] = unique
      ? [0, 1].map((s) => ({
          type: unique[`type_${s}`],
          v: [unique[`value_${s}`], ...[1, 2, 3, 4].map((k) => unique[`value_${s}_${k}`])],
        }))
      : [];
    const name = nameQuery.get(data.chara_id) as { text: string } | undefined;

    const cardRows: UpstreamCard[] = [];
    for (let lb = 0; lb < 5; lb++) {
      const card = newCard(data.id, type ?? -1, data.support_card_type === 3, data.rarity, lb);
      for (const effect of effects) {
        if (!addEffect(card, effect[1], getValue(effect, lb, data.rarity))) unknown.add(`effect ${effect[1]}`);
      }
      for (const slot of slots) for (const u of addUnique(card, slot)) unknown.add(u);
      if (name) card.char_name = name.text;
      cardRows.push(card);
    }
    if (unknown.size) skipped.push({ id: data.id, unknown: [...unknown] });
    else rows.push(...cardRows);
  }
  rows.sort((a, b) => a.id - b.id || a.limit_break - b.limit_break);
  skipped.sort((a, b) => a.id - b.id);
  return { rows, skipped };
}
