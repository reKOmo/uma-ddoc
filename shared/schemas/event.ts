// In-game events: Global's (data/global_events.json), JP's (data/jp_events.json), Global's predicted ones
// (generated/predicted_global_events.json), the Global ↔ JP pairs (generated/event_pairs.json), and the Champions
// Meeting reward table (data/champions_meeting_rewards.json).

import { z } from 'zod';
import { Day, Moment, Rarity } from './common.ts';

export const EVENT_KINDS = [
  'story',
  'champions_meeting',
  'league_of_heroes',
  'legend_race',
  'transfer_requests',
  'uma_outing',
  'special',
  'factor_research',
  'masters_challenge',
  'celebration',
  'campaign',
  'gift',
  'login_bonus',
  'missions',
  'shop',
  'sale',
] as const;
export const EventKind = z.enum(EVENT_KINDS);
export type EventKind = z.infer<typeof EventKind>;

// A support card the event gives (found by title + name in cards.json); `copies` null when the post doesn't say.
export const EventCardSchema = z.strictObject({
  id: z.int(),
  rarity: Rarity,
  title: z.string(),
  name: z.string(),
  copies: z.int().nullable(),
});
export type EventCard = z.infer<typeof EventCardSchema>;

// Another reward, as the post names it (Global's name where Global has the item; JP's own in `local`). `count`: a
// number, a range (Champions Meetings, from the hand table), or null (named without an amount).
export const EventItemSchema = z.strictObject({
  name: z.string(),
  count: z.union([z.int(), z.strictObject({ min: z.int(), max: z.int() })]).nullable(),
  local: z.string().optional(),
});
export type EventItem = z.infer<typeof EventItemSchema>;

// A step of a cup's schedule (Champions Meetings: league_selection … final_race; League of Heroes its own).
export const PhaseSchema = z.strictObject({ key: z.string(), start: Moment, end: Moment.nullable() });
export type Phase = z.infer<typeof PhaseSchema>;

// Ids: the post's id; "<post>-<block>" for a celebration's sub-event, "<event>-m<n>" for a mission set,
// "gt-…" for JP's GameTora fills, "jp-<jp id>" for a predicted event.
export const GameEventSchema = z.strictObject({
  id: z.string(),
  kind: EventKind,
  // null for Legend Races and Transfer Requests (the UI shows the kind).
  name: z.string().nullable(),
  parent: z.string().nullable(),
  start: Moment,
  end: Moment.nullable(),
  cards: z.array(EventCardSchema),
  items: z.array(EventItemSchema),
  titles: z.array(z.string()),
  phases: z.array(PhaseSchema).optional(),
  news_url: z.string().nullable(),
  image: z.string().nullable(),
  source: z.enum(['news', 'gametora']),
});
export type GameEvent = z.infer<typeof GameEventSchema>;
export const EventsFileSchema = z.array(GameEventSchema);
export type EventsFile = z.infer<typeof EventsFileSchema>;

// A JP event at its predicted Global dates.
export const PredictedEventSchema = GameEventSchema.extend({
  predicted: z.literal(true),
  jp_id: z.string(),
  jp_start: Moment,
  jp_end: Moment.nullable(),
  margin_days: z.int(),
  confirmed: z.boolean().optional(),
});
export type PredictedEvent = z.infer<typeof PredictedEventSchema>;
export const PredictedEventsFileSchema = z.strictObject({
  source: z.strictObject({ predicted_from: z.string(), fitted_at: Moment }),
  events: z.array(PredictedEventSchema),
});
export type PredictedEventsFile = z.infer<typeof PredictedEventsFileSchema>;

// A Global event paired with JP's (`how`: same post id, the story event's card, the name, or the order).
const EventPair = z.strictObject({
  gl: z.string(),
  jp: z.string(),
  kind: EventKind,
  how: z.enum(['post', 'card', 'name', 'order']),
  gl_start: Moment,
  jp_start: Moment,
  dev_days: z.number(),
});
export const EventPairsFileSchema = z.strictObject({
  pairs: z.array(EventPair.extend({ anchor: z.boolean() })),
  rejected: z.array(EventPair.extend({ why: z.string() })),
});
export type EventPairsFile = z.infer<typeof EventPairsFileSchema>;

// data/champions_meeting_rewards.json: final-round rewards per league / group / place, in blocks by `since`; null
// where not filled in yet.
export const CmRewardsFileSchema = z.array(
  z.strictObject({
    since: Day,
    note: z.string().optional(),
    final: z.array(
      z.strictObject({
        league: z.string(),
        group: z.string(),
        place: z.int(),
        carats: z.int().nullable(),
        monies: z.int().nullable(),
        ticket_support: z.int().nullable(),
        ticket_trainee: z.int().nullable(),
      })
    ),
  })
);
export type CmRewardsFile = z.infer<typeof CmRewardsFileSchema>;
