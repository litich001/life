/**
 * AI crawler traffic.
 *
 * Cloudflare Web Analytics deliberately excludes bots, so an AI crawler never
 * shows up there. This middleware classifies the User-Agent against the known
 * AI crawlers and writes one data point per hit into Analytics Engine, which
 * gives us a dedicated view of who is reading the site and training on it.
 *
 * It never blocks anything and never touches the response body -- a crawler that
 * gets a 403 because of analytics would be strictly worse for everyone.
 */

const AI_BOTS = [
  // --- OpenAI ---
  ['GPTBot', 'OpenAI', 'train', 'GPT training crawl'],
  ['OAI-SearchBot', 'OpenAI', 'search', 'ChatGPT search results'],
  ['ChatGPT-User', 'OpenAI', 'search', 'on-demand, user-initiated'],
  // --- Anthropic ---
  ['ClaudeBot', 'Anthropic', 'train', 'Claude training crawl'],
  ['Claude-User', 'Anthropic', 'search', 'on-demand, user-initiated'],
  ['Claude-SearchBot', 'Anthropic', 'search', 'Claude search results'],
  ['anthropic-ai', 'Anthropic', 'search', 'Anthropic fetcher'],
  // --- Google ---
  ['Google-Extended', 'Google', 'train', 'Gemini / Vertex grounding'],
  ['GoogleOther', 'Google', 'search', 'Google other products'],
  // --- Perplexity ---
  ['PerplexityBot', 'Perplexity', 'search', 'Perplexity index'],
  ['Perplexity-User', 'Perplexity', 'search', 'on-demand, user-initiated'],
  // --- Microsoft ---
  ['bingbot', 'Microsoft', 'search', 'Bing index'],
  // --- Apple ---
  ['Applebot-Extended', 'Apple', 'train', 'Apple Intelligence'],
  // --- Meta ---
  ['meta-externalagent', 'Meta', 'train', 'Meta AI training'],
  ['facebookbot', 'Meta', 'search', 'Facebook sharing'],
  // --- Amazon / Alexa ---
  ['Amazonbot', 'Amazon', 'train', 'Alexa / Rufus'],
  // --- ByteDance ---
  ['Bytespider', 'ByteDance', 'train', 'Doubao / TikTok'],
  // --- Others with published AI crawlers ---
  ['CCBot', 'Common Crawl', 'train', 'open dataset for LLM training'],
  ['cohere-ai', 'Cohere', 'search', 'Cohere fetcher'],
  ['cohere-training-data-crawler', 'Cohere', 'train', 'Cohere training'],
  ['Diffbot', 'Diffbot', 'train', 'knowledge graph extraction'],
  ['MistralAI-User', 'Mistral', 'search', 'Le Chat, on-demand'],
  ['AI2Bot', 'AI2', 'train', 'AI2 research crawl'],
  ['PanguBot', 'Huawei', 'train', 'Pangu / Huawei'],
  ['Webzio-Extended', 'Webzio', 'train', 'LLM training'],
  ['YouBot', 'You.com', 'search', 'You.com search'],
  ['Timpibot', 'Timpibot', 'train', 'open crawl dataset'],
  ['Omgilibot', 'Webz.io', 'train', 'structured data for LLM'],
  ['Kangaroo Bot', 'Kangaroo', 'search', 'Australia Post / others'],
];

/** Match the UA against the table. First hit wins, so order matters. */
function classify(ua) {
  if (!ua) return null;
  for (const [token, vendor, kind, note] of AI_BOTS) {
    if (ua.includes(token)) return { token, vendor, kind, note };
  }
  return null;
}

/** Assets nobody crawls for meaning -- don't inflate the counts. */
function isNoise(pathname) {
  return /\.(css|js|json|svg|webp|png|jpg|jpeg|ico|woff2?|woff|xml|txt|map)$/i.test(pathname)
    || pathname.startsWith('/_');
}

export const onRequest = async (context) => {
  const { request, env, next } = context;

  try {
    if (!isNoise(new URL(request.url).pathname)) {
      const ua = request.headers.get('user-agent') || '';
      const hit = classify(ua);

      if (hit && env.AI_TRAFFIC) {
        const country = request.cf?.country || '??';
        // Two writes so the two questions people actually ask are each one
        // GROUP BY: "which vendor is reading this" and "is it training or search".
        env.AI_TRAFFIC.writeDataPoint({
          blobs: [hit.vendor, country, new URL(request.url).pathname],
          doubles: [1],
          indexes: [hit.vendor],
        });
        env.AI_TRAFFIC.writeDataPoint({
          blobs: [hit.token, hit.kind],
          indexes: [hit.vendor, hit.kind],
        });
      }
    }
  } catch {
    // Analytics must never be able to take the site down.
  }

  return next();
};