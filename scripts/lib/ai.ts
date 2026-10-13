// @ts-nocheck
// A small language model for the parts of news posts the rules aren't sure about (scripts/lib/events.js `doubts`).
// One client for both places it runs, as both speak the OpenAI-style chat completions API:
//   ollama      local (http://localhost:11434), for testing and backfills; no key, no limits
//   openrouter  https://openrouter.ai, its free models, for the daily news run (OPENROUTER_API_KEY); free models allow
//               20 requests a minute and 50 a day (1,000 once the account has bought $10 of credits), so requests are
//               paced and 429s retried
// Environment: AI_PROVIDER (ollama | openrouter; default openrouter when OPENROUTER_API_KEY is set, else ollama),
// AI_MODEL, OLLAMA_URL, AI_THINK (1: let the model think first; Gemma 4 thinks by default, which on a laptop takes
// minutes per answer and sometimes ends with an empty reply, so it's off unless asked for).
//
// ask(config, { system, user, schema }) → the answer as an object. The model is asked for JSON fitting `schema`
// (Ollama's native /api/chat with `format` = the schema and `think`; OpenRouter's response_format json_schema and
// `reasoning`), temperature 0; what comes back is still parsed defensively (code fences, text around it), and callers
// validate it.

export const DEFAULTS = {
  ollama: { url: 'http://localhost:11434/api/chat', model: 'gemma4:e4b', pause: 0 },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemma-4-26b-a4b-it:free',
    pause: 3500,
  },
};

export function aiConfig(env = process.env, overrides = {}) {
  const provider = overrides.provider ?? env.AI_PROVIDER ?? (env.OPENROUTER_API_KEY ? 'openrouter' : 'ollama');
  const defaults = DEFAULTS[provider];
  if (!defaults) throw new Error(`unknown AI_PROVIDER "${provider}" (ollama or openrouter)`);
  if (provider === 'openrouter' && !env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
  return {
    provider,
    url: provider === 'ollama' && env.OLLAMA_URL ? `${env.OLLAMA_URL}/api/chat` : defaults.url,
    model: overrides.model ?? env.AI_MODEL ?? defaults.model,
    key: provider === 'openrouter' ? env.OPENROUTER_API_KEY : null,
    pause: defaults.pause,
    think: overrides.think ?? /^(1|true|yes)$/i.test(env.AI_THINK ?? ''),
  };
}

// The request body: Ollama's native chat API, or the OpenAI-style one OpenRouter speaks.
function body(config, { system, user, schema }) {
  const messages = [
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The first JSON object in a reply (models sometimes wrap it in ``` fences or a sentence).
export function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`no JSON object in the reply: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

// Ollama's streamed reply (one JSON object per line) as one: { message: { content } }.
async function streamed(res) {
  const text = await res.text();
  const parts = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const error = parts.find((p) => p.error);
  if (error) throw new Error(`ollama: ${error.error}`);
  return { message: { content: parts.map((p) => p.message?.content ?? '').join('') } };
}

let last = 0;
export async function ask(config, { system, user, schema }) {
  for (let attempt = 0; ; attempt++) {
    const wait = last + config.pause - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    // (A dropped connection, "fetch failed": tried again like a 5xx.)
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.key && { Authorization: `Bearer ${config.key}` }),
        ...(config.provider === 'openrouter' && { 'X-Title': 'Umaddoc' }),
      },
      body: JSON.stringify(body(config, { system, user, schema })),
    }).catch((err) => (attempt < 2 ? { status: 599, dropped: err } : Promise.reject(err)));
    if (res.dropped)
      console.warn(`  ${config.provider}: ${res.dropped.message} (${res.dropped.cause?.code ?? '?'}), again`);
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(2 ** attempt * 5000); // 5 s, 10 s, 20 s…
      continue;
    }
    if (!res.ok) throw new Error(`${config.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = config.provider === 'ollama' ? await streamed(res) : await res.json();
    const content = json.message?.content ?? json.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${config.provider}: empty reply ${JSON.stringify(json).slice(0, 300)}`);
    return parseJson(content);
  }
}
