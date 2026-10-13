// Asks a language model (scripts/lib/ai.js) about what the rules doubt in the news events (scripts/lib/events.js
// `doubts`), and stores its answers in data/news/<gl|jp>/ai_answers.json (committed; buildEvents() applies them at build time,
// so builds and deploys never call a model). Only events without an answer for the current text and questions are
// asked, so a normal day asks about the 0–3 new ones.
//
// Usage:
//   pnpm news:ai [--server gl|jp] [--model M] [--provider ollama|openrouter] [--think] [--limit N]
//       --server: whose news (gl: Global's English posts, the default; jp: JP's Japanese ones, asked in the Japanese
//       questions, answers in data/news/jp/ai_answers.json)
//       ask about every event's doubted or empty fields (askedFields()) that have no answer to the current question
//       (staleFields(): per-field versions, so a changed question re-asks only its field; saves as it goes)
//   pnpm news:ai --compare [--sample N | --ids 994-1,902-12] [--model M]
//       testing: ask N events (default 20: half with doubts, half without), or these, about every field, nothing saved; prints
//       how the model's answers (through the build's checks) compare with the rules' per field and writes
//       generated/ai-compare-<model>.json (JP: ai-compare-<model>-jp.json)
// Environment: see scripts/lib/ai.js (AI_PROVIDER, AI_MODEL, OPENROUTER_API_KEY, OLLAMA_URL).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_DIR } from './lib/paths.ts';
import { loadPosts } from './lib/news-api.ts';
import { aiConfig, ask } from './lib/ai.ts';
import { applyAnswer, mergeAnswer, question, staleFields } from './lib/event-questions.ts';
import { eventFragments, readAnswers, writeAnswers } from './lib/events.ts';
import { norm } from './lib/event-rewards.ts';
import { lexicon } from './lib/news-lang/index.ts';
import type { Server } from './lib/news-text.ts';
import type { CardsFile } from '../shared/schemas/card.ts';
import type { GameEvent } from '../shared/schemas/event.ts';
import type { AiAnswer, AiAnswersFile, NewsPost } from '../shared/schemas/news.ts';

// An event fragment (events.ts' eventFragments()): an event with its doubts, text and aiKey.
type Fragment = GameEvent & { doubts: Record<string, string>; text: string; aiKey: string };
// What question() takes: the fields to ask about (all of them when comparing), the posts' lexicon.
type QuestionOptions = { all?: boolean; fields?: string[] };
type ModelAnswer = AiAnswer['answer'];

const arg = (name: string, fallback?: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const config = aiConfig(process.env, {
  model: arg('model'),
  provider: arg('provider'),
  ...(process.argv.includes('--think') && { think: true }),
});
const cardsFile = `${GENERATED_DIR}cards.json`;
const cards: CardsFile = existsSync(cardsFile) ? JSON.parse(readFileSync(cardsFile, 'utf8')) : {};
// TODO(ts): --server is read as a string here; it's gl or jp (flags move to parseArgs later).
const server = arg('server', 'gl') as Server;
const lang = lexicon(server);
// TODO(ts): loadPosts() (news-api.ts, not typed yet) gives an untyped Map; the file is the stored NewsPost list.
const posts: NewsPost[] = [...loadPosts(server).values()];
// TODO(ts): eventFragments() (events.ts, not typed yet) returns the fragments untyped; they're Fragment.
const fragments: Fragment[] = eventFragments(posts, cards, lang);
console.log(
  `${server}: ${config.provider} ${config.model}${config.think ? ' (thinking)' : ''}: ${fragments.length} events`
);

async function timed(event: Fragment, options: QuestionOptions): Promise<{ answer: ModelAnswer; ms: number }> {
  const t = Date.now();
  // TODO(ts): ask() (ai.ts, not typed yet) gives the model's parsed reply, unchecked: applyAnswer() checks it.
  const answer = (await ask(config, question(event, { ...options, lang }))) as ModelAnswer;
  return { answer, ms: Date.now() - t };
}

if (!process.argv.includes('--compare')) {
  // TODO(ts): readAnswers() (events.ts, not typed yet) gives the stored file, as written by writeAnswers().
  const answers: AiAnswersFile = readAnswers(server);
  const todo = fragments.filter((f) => staleFields(f, answers[f.aiKey]).length);
  const limit = Number(arg('limit', String(todo.length)));
  console.log(
    `${todo.length} events with doubted or empty fields and no answer; asking ${Math.min(limit, todo.length)}`
  );
  let failed = 0;
  for (const f of todo.slice(0, limit)) {
    const fields = staleFields(f, answers[f.aiKey]);
    try {
      const { answer, ms } = await timed(f, { fields });
      answers[f.aiKey] = mergeAnswer(answers[f.aiKey], fields, answer, config.model);
      writeAnswers(answers, server);
      console.log(`  ${f.id} (${fields.join(', ')}) ${(ms / 1000).toFixed(1)} s`);
    } catch (err) {
      failed++;
      console.warn(`  ${f.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`done, ${failed} failed`);
} else {
  // Half doubted, half not, spread over the archive.
  const n = Number(arg('sample', '20'));
  const spread = <T>(list: T[], k: number): T[] =>
    list.filter((_, i) => i % Math.max(1, Math.floor(list.length / k)) === 0).slice(0, k);
  const doubted = fragments.filter((f) => Object.keys(f.doubts).length);
  const sure = fragments.filter((f) => !Object.keys(f.doubts).length);
  const ids = arg('ids')?.split(',');
  const sample = ids
    ? fragments.filter((f) => ids.includes(f.id))
    : [...spread(doubted, Math.ceil(n / 2)), ...spread(sure, Math.floor(n / 2))];

  const counts = (items: Fragment['items']) => Object.fromEntries(items.map((i) => [norm(i.name), i.count]));
  const rows: Record<string, unknown>[] = [];
  const tally: Record<string, Record<string, number>> = {};
  const mark = (field: string, verdict: string) => {
    tally[field] ??= { same: 0, different: 0, 'model only': 0, 'rules only': 0, 'both empty': 0 };
    tally[field][verdict]++;
  };
  const verdict = (rules: unknown, model: unknown): string =>
    rules == null && model == null
      ? 'both empty'
      : rules == null
        ? 'model only'
        : model == null
          ? 'rules only'
          : String(rules) === String(model)
            ? 'same'
            : 'different';
  let total = 0;
  for (const f of sample) {
    try {
      const { answer, ms } = await timed(f, { all: true });
      total += ms;
      // What would be used: the answer through the same checks as at build time, taken wherever it's valid.
      const used = applyAnswer(f, answer, { trustModel: true, lang });
      const r = counts(f.items);
      const m = counts(used.items);
      const items = [...new Set([...Object.keys(r), ...Object.keys(m)])].map((k) => ({
        item: k,
        rules: r[k] ?? null,
        model: m[k] ?? null,
        verdict: verdict(r[k], m[k]),
      }));
      for (const i of items) mark('items', i.verdict);
      const minute = (iso: string | null | undefined) => iso?.slice(0, 16).replace('T', ' ') ?? null;
      const fields = {
        name: [f.name, used.name],
        ...('kind' in answer && { kind: [f.kind, used.kind] }),
        start: [minute(f.start), minute(used.start)],
        end: [minute(f.end), minute(used.end)],
        ...Object.fromEntries(f.cards.map((c, n) => [`copies ${c.name}`, [c.copies, used.cards[n].copies]])),
      };
      const compared = Object.fromEntries(
        Object.entries(fields).map(([k, [rules, model]]) => {
          const v = k === 'name' && rules && model && norm(rules) === norm(model) ? 'same' : verdict(rules, model);
          mark(k.startsWith('copies') ? 'copies' : k, v);
          return [k, { rules, model, verdict: v }];
        })
      );
      rows.push({ id: f.id, doubts: f.doubts, ms, items, ...compared });
      const off = [
        ...items
          .filter((i) => i.verdict !== 'same' && i.verdict !== 'both empty')
          .map((i) => `${i.item}: ${i.rules} → ${i.model}`),
        ...Object.entries(compared)
          .filter(([, c]) => c.verdict !== 'same' && c.verdict !== 'both empty')
          .map(([k, c]) => `${k}: ${c.rules} → ${c.model}`),
      ];
      console.log(
        `  ${f.id} ${(ms / 1000).toFixed(1)} s${Object.keys(f.doubts).length ? ` [doubts: ${Object.keys(f.doubts).join(', ')}]` : ''}`
      );
      for (const o of off) console.log(`      ${o}`);
    } catch (err) {
      console.warn(`  ${f.id}: ${err instanceof Error ? err.message : err}`);
      rows.push({ id: f.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  console.log(
    `\n${sample.length} events, ${(total / 1000).toFixed(0)} s (${(total / sample.length / 1000).toFixed(1)} s each)`
  );
  for (const [field, t] of Object.entries(tally)) console.log(`  ${field.padEnd(7)} ${JSON.stringify(t)}`);
  mkdirSync(GENERATED_DIR, { recursive: true });
  const file = `${GENERATED_DIR}ai-compare-${config.model.replace(/[^\w.-]+/g, '_')}${config.think ? '-think' : ''}${server === 'gl' ? '' : `-${server}`}.json`;
  writeFileSync(
    file,
    `${JSON.stringify({ model: config.model, at: new Date().toISOString(), tally, rows }, null, 1)}\n`
  );
  console.log(`details: ${file}`);
}
