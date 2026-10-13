// One client for the models that judge doubted news fields. Both providers speak the OpenAI-style chat API: ollama
// is local with no limits; openrouter's free models allow 20 requests a minute and 50 a day (1,000 with $10 of
// credits), so requests are paced and 429s retried.
// Thinking is off unless AI_THINK is set: Gemma 4 thinks for minutes per answer on a laptop, sometimes ending in an
// empty reply.
// ask() asks for JSON fitting the schema (replies are parsed defensively; callers validate them).

import pRetry from 'p-retry';
import { sleep } from './http.ts';

export type Provider = 'ollama' | 'openrouter';
export type JsonSchema = { [key: string]: unknown };
export type Question = { system: string; user: string; schema: JsonSchema };
export type AiConfig = {
  provider: Provider;
  url: string;
  model: string;
  key: string | null | undefined;
  pause: number;
  think: boolean;
};
type Message = { role: 'system' | 'user'; content: string };

export const DEFAULTS: Record<Provider, { url: string; model: string; pause: number }> = {
  ollama: { url: 'http://localhost:11434/api/chat', model: 'gemma4:e4b', pause: 0 },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemma-4-26b-a4b-it:free',
    pause: 3500,
  },
};

export function aiConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: { provider?: string; model?: string; think?: boolean } = {}
): AiConfig {
  const provider: string = overrides.provider ?? env.AI_PROVIDER ?? (env.OPENROUTER_API_KEY ? 'openrouter' : 'ollama');
  const defaults = (DEFAULTS as Record<string, (typeof DEFAULTS)[Provider] | undefined>)[provider];
  if (!defaults) throw new Error(`unknown AI_PROVIDER "${provider}" (ollama or openrouter)`);
  if (provider === 'openrouter' && !env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
  return {
    provider: provider as Provider,
    url: provider === 'ollama' && env.OLLAMA_URL ? `${env.OLLAMA_URL}/api/chat` : defaults.url,
    model: overrides.model ?? env.AI_MODEL ?? defaults.model,
    key: provider === 'openrouter' ? env.OPENROUTER_API_KEY : null,
    pause: defaults.pause,
    think: overrides.think ?? /^(1|true|yes)$/i.test(env.AI_THINK ?? ''),
  };
}

function body(config: AiConfig, { system, user, schema }: Question) {
  const messages: [Message, Message] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  if (config.provider === 'ollama') {
    // Ollama can't force a schema while the model thinks (the reasoning uses up the reply and the answer comes back
    // empty), so a thinking model gets the schema in the prompt and its JSON is read from the reply.
    if (config.think) messages[1].content += `\n\nReply with JSON matching this schema:\n${JSON.stringify(schema)}`;
    return {
      model: config.model,
      messages,
      ...(!config.think && { format: schema }),
      think: config.think,
      // Streamed: a slow answer (a big model on a laptop) would otherwise outlast fetch's 5-minute wait for headers.
      stream: true,
      // Ollama's default context (4,096 tokens) cuts a long post plus its reasoning off before the answer. An answer
      // is short: a model that loops (the same item over and over) is cut off, and its JSON then fails to parse.
      options: { temperature: 0, num_ctx: 16384, ...(!config.think && { num_predict: 2048 }) },
    };
  }
  return {
    model: config.model,
    messages,
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema } },
    reasoning: { enabled: config.think },
  };
}

// The first JSON object in a reply (models sometimes wrap it in ``` fences or a sentence).
export function parseJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`no JSON object in the reply: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

// Ollama's streamed reply (one JSON object per line) as one: { message: { content } }.
async function streamed(res: Response): Promise<{ message: { content: string } }> {
  const text = await res.text();
  const parts = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as { error?: string; message?: { content?: string } });
  const error = parts.find((p) => p.error);
  if (error) throw new Error(`ollama: ${error.error}`);
  return { message: { content: parts.map((p) => p.message?.content ?? '').join('') } };
}

// A reply worth trying again (429, 5xx): its message is the error `ask` ends with if the tries run out.
class Retry extends Error {}
// A dropped connection ("fetch failed"): tried again like a 5xx, but only for the first two tries.
class Dropped extends Error {
  original: Error;
  constructor(original: Error) {
    super(original.message);
    this.original = original;
  }
}

let last = 0;
export async function ask(config: AiConfig, { system, user, schema }: Question): Promise<unknown> {
  const post = async (): Promise<Response> => {
    const wait = last + config.pause - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.key && { Authorization: `Bearer ${config.key}` }),
        ...(config.provider === 'openrouter' && { 'X-Title': 'Umaddoc' }),
      },
      body: JSON.stringify(body(config, { system, user, schema })),
    }).catch((err: Error) => {
      throw new Dropped(err);
    });
    if (res.status === 429 || res.status >= 500)
      throw new Retry(`${config.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  };
  // Up to 5 retries after 5 s, 10 s, 20 s, 40 s, 80 s (each try waits for the provider's pacing first).
  let res: Response;
  try {
    res = await pRetry(post, {
      retries: 5,
      minTimeout: 5000,
      factor: 2,
      randomize: false,
      shouldRetry: ({ error, attemptNumber }) =>
        error instanceof Retry || (error instanceof Dropped && attemptNumber <= 2),
      onFailedAttempt: ({ error, attemptNumber }) => {
        if (error instanceof Dropped && attemptNumber <= 2)
          console.warn(
            `  ${config.provider}: ${error.message} (${(error.original as Error & { cause?: { code?: string } }).cause?.code ?? '?'}), again`
          );
      },
    });
  } catch (err) {
    throw err instanceof Dropped ? err.original : err;
  }
  if (!res.ok) throw new Error(`${config.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: {
    message?: { content?: string };
    choices?: { message?: { content?: string } }[];
  } = config.provider === 'ollama' ? await streamed(res) : await res.json();
  const content = json.message?.content ?? json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.provider}: empty reply ${JSON.stringify(json).slice(0, 300)}`);
  return parseJson(content);
}
