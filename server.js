import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile, mkdir, stat, rm, copyFile, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORKSPACE = path.join(__dirname, 'workspace');
const SCHEDULES_FILE = path.join(WORKSPACE, 'schedules.json');
const FOLDERS_FILE = path.join(WORKSPACE, 'allowed-folders.json');
const MEDIA_JOBS_FILE = path.join(WORKSPACE, 'media-jobs.json');
const FFMPEG_BIN = process.env.FFMPEG_PATH
  || path.join(__dirname, 'runtime', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const FFPROBE_BIN = process.env.FFPROBE_PATH
  || path.join(__dirname, 'runtime', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
await mkdir(WORKSPACE, { recursive: true });

let jobs = [];
let allowedFolders = [];
let mediaJobs = [];
const runningJobs = new Set();
const mediaRunning = new Set();
const cancelledJobs = new Set();
const ffmpegJobs = [];
const ffmpegRunning = new Set();
const ffmpegChildren = new Map();
let ffmpegVersionCache = null;
let ffmpegEncodersCache = null;
const stockImageCache = new Map();

const PORT = Number(process.env.PORT || 4173);
const UPSTREAM_BASE = (process.env.UPSTREAM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'minimaxai/minimax-m3.1-flash';
const DEFAULT_IMAGE_MODEL = process.env.DEFAULT_IMAGE_MODEL || 'flux';
const DEFAULT_VIDEO_MODEL = process.env.DEFAULT_VIDEO_MODEL || 'kwaivgi/kling-v4.0-flash';
let mediaKey = (process.env.POLLINATIONS_API_KEY || '').trim();
let cloudflareAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
let cloudflareToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
let hfToken = (process.env.HF_TOKEN || '').trim();
const HF_IMAGE_MODELS = [
  'black-forest-labs/FLUX.1-schnell',
];
const HF_FLUX_SPACES = [
  'https://black-forest-labs-flux-1-schnell.hf.space',
  'https://evalstate-flux1-schnell.hf.space',
];
const BING_SUPPORTED = process.platform === 'win32'; // Chrome/CDP profile sirf local Windows par hota hai
const DEFAULT_IMAGE_PROVIDER = process.env.DEFAULT_IMAGE_PROVIDER || (BING_SUPPORTED ? 'bing' : 'auto');
const DEFAULT_VIDEO_PROVIDER = process.env.DEFAULT_VIDEO_PROVIDER || 'ltx';
const CF_IMAGE_MODELS = [
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/black-forest-labs/flux-2-klein-4b',
  '@cf/black-forest-labs/flux-2-klein-9b',
  '@cf/black-forest-labs/flux-2-dev',
];
const IMAGE_PROVIDERS = [
  { id: 'bing', label: 'Bing Image Creator', note: 'Free · best quality · Chrome required' },
  { id: 'cloudflare', label: 'Cloudflare Flux', note: 'Free 10k neurons/day · needs free token' },
  { id: 'huggingface', label: 'Hugging Face Flux', note: 'Free ZeroGPU Space · token optional (5 min/day)' },
  { id: 'stock', label: 'Free stock images', note: 'Openverse CC0/PDM · copyright-free · no key' },
];
const VIDEO_PROVIDERS = [
  { id: 'ltx', label: 'LTX-Video · GitHub/HF', note: 'Free open-source model · no card' },
];
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const BROWSER_PROFILE = path.join(WORKSPACE, '.browser-profile');
// Alag headless Chrome — Bing generation iske andar hoti hai, screen par kuch nahi dikhta.
const IMG_CDP_PORT = Number(process.env.IMG_CDP_PORT || 9223);
const IMG_BROWSER_PROFILE = path.join(WORKSPACE, '.bing-headless-profile');
// Login cookies ka reader — asli profile ko hidden Chrome me kholkar cookies nikalta hai.
const COOKIE_CDP_PORT = Number(process.env.COOKIE_CDP_PORT || 9224);
const BING_COOKIE_FILE = path.join(WORKSPACE, 'bing-auth.json');
const WORKER_TOKEN_FILE = path.join(WORKSPACE, 'image-worker-token.json');
const LIVE_URL = (process.env.LIVE_URL || 'https://nova-ai-9gbh.onrender.com').replace(/\/+$/, '');
let bingCookie = (process.env.BING_AUTH_COOKIE || '').trim();
try {
  const savedBing = JSON.parse(await readFile(BING_COOKIE_FILE, 'utf8'));
  bingCookie = String(savedBing.cookie || '').trim() || bingCookie;
} catch {
  /* first run */
}
let imageWorkerToken = (process.env.NOVA_WORKER_TOKEN || '').trim();
let imageWorkerLastSeen = 0;
const pendingImageJobs = new Map();
try {
  const savedWorker = JSON.parse(await readFile(WORKER_TOKEN_FILE, 'utf8'));
  imageWorkerToken = String(savedWorker.token || '').trim() || imageWorkerToken;
} catch {
  /* first run */
}
if (BING_SUPPORTED && !imageWorkerToken) {
  imageWorkerToken = randomBytes(24).toString('hex');
  await writeFile(
    WORKER_TOKEN_FILE,
    JSON.stringify({ token: imageWorkerToken, createdAt: Date.now() }),
    'utf8',
  ).catch(() => {});
}
let browserTargetId = null;
let imageTargetId = null;

const TIERS = [
  { id: 'auto', label: 'Auto', hint: 'Balanced default', model: 'minimaxai/minimax-m3.1-flash' },
  { id: 'fast', label: 'Fast', hint: 'Quick everyday answers', model: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
  { id: 'expert', label: 'Expert', hint: 'Deeper answers', model: 'google/gemma-4-31b-it' },
  { id: 'heavy', label: 'Heavy', hint: 'Hardest problems', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
];

const BASE_PERSONA =
  process.env.SYSTEM_PROMPT ||
  'You are Nova, a helpful, sharp and direct AI assistant. Use Markdown, keep code correct and runnable, and never invent facts.';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.py': 'text/x-python; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* ---------------------------------- utils --------------------------------- */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function readBinaryBody(req, limit = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('File too large (max 80 MB)'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const PROVIDER_ENV_KEYS = {
  nvidia: 'NVIDIA_API_KEY',
  groq: 'GROQ_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  pollinations: 'POLLINATIONS_API_KEY',
};

function serverKeyState() {
  return Object.fromEntries(
    Object.entries(PROVIDER_ENV_KEYS).map(([id, envName]) => [id, Boolean((process.env[envName] || '').trim())]),
  );
}

function apiKeyFrom(req) {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const provider = String(req.headers['x-provider'] || '').trim().toLowerCase();
  if (provider) {
    const envName = PROVIDER_ENV_KEYS[provider];
    return envName ? (process.env[envName] || '').trim() : '';
  }
  return (process.env.NVIDIA_API_KEY || '').trim();
}

/** Allow the local UI to point at another OpenAI-compatible provider. */
function baseUrlFrom(req) {
  const header = req.headers['x-upstream-base'];
  if (typeof header === 'string') {
    const value = header.trim().replace(/\/+$/, '');
    if (/^https?:\/\/[^\s]+$/.test(value)) return value;
  }
  return UPSTREAM_BASE;
}

const sse = (res, event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function providerErrorMessage(detail, status) {
  if (status === 429) {
    let raw = '';
    try {
      const parsed = JSON.parse(detail);
      raw = parsed?.error?.message || parsed?.message || parsed?.title || '';
    } catch {
      raw = String(detail || '').slice(0, 200);
    }
    return `Rate limit reached (429). ${raw ? `${raw} ` : ''}Wait a minute and try again.`;
  }
  try {
    const parsed = JSON.parse(detail);
    if (parsed?.error?.message) return parsed.error.message;
    if (parsed?.detail) return parsed.detail;
    if (parsed?.message) return parsed.message;
    if (parsed?.title) return `${parsed.title} (${status})`;
  } catch {
    /* keep raw text */
  }
  return detail || `Provider responded with ${status}`;
}

function decodeHtml(text) {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapBingUrl(href) {
  try {
    const decoded = href.replace(/&amp;/g, '&');
    const url = new URL(decoded);
    const u = url.searchParams.get('u');
    if (u && u.startsWith('a1')) {
      const raw = u.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(raw, 'base64').toString('utf8');
    }
    return decoded;
  } catch {
    return href;
  }
}

/* --------------------------------- search --------------------------------- */

async function bingSearch(query) {
  const response = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return [];
  const html = await response.text();
  const results = [];
  for (const match of html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/g)) {
    const block = match[0];
    const anchor = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!anchor) continue;
    const snippet = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block);
    const url = unwrapBingUrl(anchor[1]);
    if (!/^https?:\/\//.test(url)) continue;
    results.push({
      title: decodeHtml(anchor[2]) || url,
      url,
      snippet: snippet ? decodeHtml(snippet[1]).slice(0, 320) : '',
    });
    if (results.length >= 6) break;
  }
  return results;
}

async function wikipediaSearch(query) {
  const endpoint =
    'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=4&srsearch=' +
    encodeURIComponent(query);
  const response = await fetch(endpoint, { headers: { 'user-agent': 'NovaApp/1.0' }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) return [];
  const data = await response.json();
  return (data?.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    snippet: decodeHtml(item.snippet || '').slice(0, 320),
  }));
}

async function webSearch(query) {
  try {
    const results = await bingSearch(query);
    if (results.length) return results;
  } catch {
    /* fall through */
  }
  try {
    return await wikipediaSearch(query);
  } catch {
    return [];
  }
}

/* ---------------------------------- chat ---------------------------------- */

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const part of content.slice(0, 10)) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      parts.push({ type: 'text', text: part.text.slice(0, 200_000) });
    } else if (
      part?.type === 'image_url' &&
      typeof part.image_url?.url === 'string' &&
      part.image_url.url.startsWith('data:image/')
    ) {
      parts.push({ type: 'image_url', image_url: { url: part.image_url.url } });
    }
  }
  return parts;
}

function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const cleaned = [];
  for (const message of raw) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) continue;
    const content = normalizeContent(message.content);
    if (typeof content === 'string' ? !content.trim() : content.length === 0) continue;
    cleaned.push({ role: message.role, content });
  }
  return cleaned.slice(-40);
}

function plainText(content) {
  if (typeof content === 'string') return content;
  return content.map((part) => (part.type === 'text' ? part.text : '')).join(' ');
}

function resolveModel(tier, messages, modes) {
  const chosen = TIERS.find((t) => t.id === tier) || TIERS[0];
  if (chosen.id !== 'auto') return chosen.model;
  const last = messages[messages.length - 1];
  const prompt = last ? plainText(last.content) : '';
  if (modes.think || prompt.length > 400) return 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
  return TIERS[0].model;
}

function buildSystem(modes, results) {
  const chunks = [BASE_PERSONA, `Current date: ${new Date().toISOString().slice(0, 10)}.`];

  if (modes.fun) {
    chunks.push(
      'Personality: Fun mode. Be witty, playful and a little cheeky, but still accurate and genuinely useful. Keep the humour light and never rude about real people.',
    );
  }
  if (modes.think) {
    chunks.push(
      'Work through the problem carefully before answering. In the final answer, show the reasoning compactly as short numbered steps, then the conclusion.',
    );
  }
  if (modes.search) {
    if (results.length) {
      const list = results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
        .join('\n\n');
      chunks.push(
        `You have live web results below. Base factual claims on them, cite sources inline like [1], [2], and say so plainly if the results do not answer the question.\n\nWEB RESULTS:\n${list}`,
      );
    } else {
      chunks.push('No live web results were available for this query. Answer from your knowledge and say that it is not freshly verified.');
    }
  }

  return chunks.join('\n\n');
}

async function handleChat(req, res, key) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const messages = normalizeMessages(payload.messages);
  if (!messages.length) return sendJson(res, 400, { error: 'At least one user message is required.' });

  const modes = {
    think: Boolean(payload.modes?.think),
    search: Boolean(payload.modes?.search),
    fun: Boolean(payload.modes?.fun),
  };

  const model =
    typeof payload.model === 'string' && payload.model.trim()
      ? payload.model.trim()
      : resolveModel(payload.tier, messages, modes);

  const temperature = Number.isFinite(payload.temperature) ? Math.min(2, Math.max(0, payload.temperature)) : 0.7;
  const maxTokens = Number.isFinite(payload.maxTokens) && payload.maxTokens > 0 ? Math.min(32000, payload.maxTokens) : 3072;

  let results = [];
  if (modes.search) {
    const last = messages[messages.length - 1];
    const query = plainText(last.content).replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (query) results = await webSearch(query);
  }

  const system = typeof payload.system === 'string' && payload.system.trim()
    ? `${payload.system.trim()}\n\n${buildSystem(modes, results)}`
    : buildSystem(modes, results);

  const upstreamBody = {
    model,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    messages: [{ role: 'system', content: system }, ...messages],
  };

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const base = baseUrlFrom(req);

  let upstream;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    return sendJson(res, 502, { error: `Could not reach the model provider: ${err.message}` });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    const message = providerErrorMessage(detail, upstream.status);
    return sendJson(res, upstream.status === 401 || upstream.status === 403 ? 401 : 502, {
      error: message || `Provider responded with ${upstream.status}`,
      status: upstream.status,
    });
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  sse(res, { type: 'meta', model, sources: results });
  if (results.length) sse(res, { type: 'sources', sources: results });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }

        const choice = json?.choices?.[0] || {};
        const delta = choice.delta || {};
        const content = typeof delta.content === 'string' ? delta.content : '';
        const reasoning =
          typeof delta.reasoning_content === 'string'
            ? delta.reasoning_content
            : typeof delta.reasoning === 'string'
              ? delta.reasoning
              : '';

        if (content || reasoning) sse(res, { type: 'delta', content, reasoning });
        if (choice.finish_reason) {
          finished = true;
          sse(res, { type: 'done', finishReason: choice.finish_reason });
        }
      }
    }
    if (!finished) sse(res, { type: 'done' });
  } catch (err) {
    if (!controller.signal.aborted) sse(res, { type: 'error', error: err.message || 'Stream failed' });
  } finally {
    res.end();
  }
}

/* --------------------------------- imagine -------------------------------- */

const IMAGE_STYLES = {
  none: '',
  photo: ', photorealistic, natural lighting, 35mm photograph, highly detailed',
  art: ', digital painting, rich colour, dramatic composition, concept art',
  anime: ', anime illustration, clean line art, vibrant colours',
  '3d': ', 3d render, soft studio lighting, octane, high detail',
};

const MEDIA_MODEL_CATALOG = {
  image: [
    { id: 'auto', title: 'Provider default', note: 'Bing / Cloudflare / HF best model' },
    ...CF_IMAGE_MODELS.map((id) => ({ id, title: id.split('/').pop(), note: 'Cloudflare Flux · free' })),
    ...HF_IMAGE_MODELS.map((id) => ({ id, title: id.split('/').pop(), note: 'Hugging Face · free tier' })),
  ],
  video: [
    { id: 'ltx', title: 'LTX-Video', note: 'GitHub/HF · free · no key' },
  ],
};

async function handleImagine(req, res, url) {
  const prompt = (url.searchParams.get('prompt') || '').trim().slice(0, 700);
  if (!prompt) return sendJson(res, 400, { error: 'Prompt is required.' });

  const style = IMAGE_STYLES[url.searchParams.get('style')] ?? '';
  const model = (url.searchParams.get('model') || DEFAULT_IMAGE_MODEL).trim().slice(0, 120);
  const provider = (url.searchParams.get('provider') || DEFAULT_IMAGE_PROVIDER).trim().slice(0, 40);
  const ratio = url.searchParams.get('ratio') === '9:16' || url.searchParams.get('ratio') === '1:1'
    ? url.searchParams.get('ratio')
    : '16:9';
  const finalPrompt = `${prompt}${style}`;
  const multi = url.searchParams.get('multi') === '1';

  try {
    const { bytes, images = [bytes], provider: usedProvider } = await generateImageSmart(finalPrompt, {
      provider,
      model,
      ratio,
    });
    if (multi) {
      return sendJson(res, 200, {
        images: images.map((item) => `data:${imageContentType(item)};base64,${item.toString('base64')}`),
        provider: usedProvider,
        count: images.length,
      });
    }
    res.writeHead(200, {
      'content-type': imageContentType(bytes),
      'content-length': bytes.length,
      'cache-control': 'public, max-age=86400',
    });
    res.end(bytes);
  } catch (err) {
    sendJson(res, 502, { error: `Image generation failed: ${err.message}` });
  }
}

function imageContentType(bytes) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes.length > 4 && bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

async function handleVideo(req, res, url) {
  const prompt = (url.searchParams.get('prompt') || '').trim().slice(0, 500);
  if (!prompt) return sendJson(res, 400, { error: 'Prompt is required.' });

  const model = (url.searchParams.get('model') || DEFAULT_VIDEO_MODEL).trim().slice(0, 120);
  const duration = Math.min(15, Math.max(2, Number(url.searchParams.get('duration')) || 5));
  const provider = (url.searchParams.get('provider') || DEFAULT_VIDEO_PROVIDER).trim().slice(0, 40);
  const ratio = url.searchParams.get('ratio') === '9:16' ? '9:16' : '16:9';

  try {
    const { bytes } = await generateVideoSmart(prompt, { provider, model, duration, ratio });
    res.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': bytes.length,
      'cache-control': 'public, max-age=86400',
    });
    res.end(bytes);
  } catch (err) {
    sendJson(res, 502, { error: `Video generation failed: ${err.message}` });
  }
}

async function handleMediaKey(req, res) {
  if (req.method === 'DELETE') {
    mediaKey = '';
    return sendJson(res, 200, { ok: true, configured: false });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  const raw = await readBody(req);
  let key = String(req.headers['x-media-key'] || '').trim();
  if (!key) {
    try {
      key = String((JSON.parse(raw || '{}') || {}).key || '').trim();
    } catch {
      key = '';
    }
  }
  mediaKey = key;
  return sendJson(res, 200, { ok: true, configured: Boolean(key) });
}

async function handleMediaModels(req, res) {
  return sendJson(res, 200, {
    ...MEDIA_MODEL_CATALOG,
    source: 'local',
  });
}

/* ------------------------------- media jobs -------------------------------- */

function safeFileName(input, fallback = 'file') {
  const clean = String(input || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function webPath(absolute) {
  return `/workspace/${path.relative(WORKSPACE, absolute).replace(/\\/g, '/')}`;
}

function inferMediaStyle(prompt, type) {
  const text = String(prompt || '').toLowerCase();
  if (/cartoon|anime|comic|chibi/.test(text)) return 'cartoon';
  if (/meme|funny|comedy|joke/.test(text) || type === 'meme') return 'meme';
  if (/cinematic|movie|film|dramatic/.test(text) || type === 'song') return 'cinematic';
  return type === 'cartoon' ? 'cartoon' : 'cinematic';
}

function inferMediaFx(prompt) {
  const text = String(prompt || '').toLowerCase();
  const fx = [];
  if (/glitch/.test(text)) fx.push('glitch');
  if (/shake|action/.test(text)) fx.push('shake');
  if (/sparkle|glow|magic/.test(text)) fx.push('sparkle');
  if (/zoom/.test(text)) fx.push('zoom');
  if (/pan|slide|travel/.test(text)) fx.push('pan');
  return fx.length ? fx : ['zoom', 'pan'];
}

function inferTransitions(prompt) {
  const text = String(prompt || '').toLowerCase();
  const list = [];
  if (/wipe/.test(text)) list.push('wipe');
  if (/slide/.test(text)) list.push('slide');
  if (/fade|soft|emotional/.test(text)) list.push('fade');
  return list.length ? list : ['fade', 'zoom'];
}

function splitCaptions(prompt, count) {
  const text = String(prompt || '').trim();
  const parts = text.split(/[.!?।]+\s*|\n+/).map((item) => item.trim()).filter(Boolean);
  if (parts.length >= count) return parts.slice(0, count);
  const words = text.split(/\s+/).filter(Boolean);
  const perScene = Math.max(3, Math.ceil((words.length || 1) / count));
  return Array.from({ length: count }, (_, index) =>
    words.slice(index * perScene, (index + 1) * perScene).join(' ') ||
    parts[index % (parts.length || 1)] ||
    `Scene ${index + 1}`,
  ).slice(0, count);
}

async function loadMediaJobs() {
  try {
    const parsed = JSON.parse(await readFile(MEDIA_JOBS_FILE, 'utf8'));
    mediaJobs = Array.isArray(parsed) ? parsed : [];
  } catch {
    mediaJobs = [];
  }
}

async function saveMediaJobs() {
  await writeFile(MEDIA_JOBS_FILE, JSON.stringify(mediaJobs, null, 2));
}

async function updateMediaJob(job, patch) {
  Object.assign(job, patch, { updatedAt: Date.now() });
  await saveMediaJobs().catch(() => {});
}

function cleanStockQuery(prompt) {
  return String(prompt || '')
    .replace(/Scene\s+\d+\s*:/gi, ' ')
    .replace(/style,?\s+high detail,?\s+cinematic composition\.?/gi, ' ')
    .replace(/\b(?:hook|setup|build-up|twist|climax|reveal|payoff|takeaway)\s*:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'cinematic';
}

async function generateStockImages(prompt, count = 1) {
  const wanted = Math.min(20, Math.max(1, Number(count) || 1));
  const query = cleanStockQuery(prompt);
  const cacheKey = `${query}|${wanted}`;
  const cached = stockImageCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 10 * 60_000) return cached.images.slice(0, wanted);

  const searchUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}`
    + `&license=cc0,pdm&page_size=${wanted}&mature=false`;
  const response = await fetch(searchUrl, {
    headers: { 'user-agent': 'Nova-AI/1.0 (copyright-free video images)' },
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail ? `Free stock search failed: ${data.detail}` : `Free stock search failed (${response.status}).`);
  }
  const results = Array.isArray(data.results) ? data.results : [];
  if (!results.length) throw new Error(`"${query}" ke liye koi CC0/public-domain image nahi mili.`);

  const images = [];
  for (const item of results) {
    const imageUrl = item.url || item.thumbnail;
    if (!imageUrl) continue;
    try {
      const imageResponse = await fetch(imageUrl, {
        headers: { 'user-agent': 'Nova-AI/1.0 (copyright-free video images)' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!imageResponse.ok) continue;
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      if (bytes.length < 2048 || bytes.length > 12 * 1024 * 1024) continue;
      images.push(bytes);
    } catch {
      /* try next result */
    }
  }
  if (!images.length) throw new Error('Free stock images download nahi hui.');
  stockImageCache.set(cacheKey, { ts: Date.now(), images });
  if (stockImageCache.size > 20) stockImageCache.delete(stockImageCache.keys().next().value);
  return images.slice(0, wanted);
}

async function fetchImageResult(prompt, model, provider, ratio) {
  if (provider === 'bing') {
    if (!BING_SUPPORTED) {
      throw new Error(
        'Bing direct Render par captcha dikhaata hai. Local PC chalte rehne dein (auto image worker) ya Cloudflare/Hugging Face free token use karein.',
      );
    }
    return { images: await generateBingImages(prompt), provider: 'bing' };
  }
  if (provider === 'cloudflare') {
    return { images: [await generateCloudflareImage(prompt, model)], provider: 'cloudflare' };
  }
  if (provider === 'huggingface') {
    return { images: [await generateHuggingFaceImage(prompt, model, ratio)], provider: 'huggingface' };
  }
  if (provider === 'stock') {
    return { images: await generateStockImages(prompt, 1), provider: 'stock' };
  }
  if (provider === 'worker') {
    return { images: await generateImageViaWorker(prompt, ratio), provider: 'worker' };
  }
  if (provider === 'pollinations') {
    throw new Error('Pollinations band hai — app Bing/Cloudflare/Hugging Face free providers use karti hai.');
  }
  throw new Error(`Unknown image provider: ${provider}. Available: bing, cloudflare, huggingface, worker.`);
}

async function fetchMediaBytes(kind, prompt, model, duration = 5, provider = 'auto', ratio = '16:9') {
  if (kind === 'image') {
    const { images } = await fetchImageResult(prompt, model, provider, ratio);
    return images[0];
  }
  if (provider === 'ltx') return generateLtxVideo(prompt, { duration, ratio });
  if (provider === 'pollinations') {
    throw new Error('Pollinations video band hai — LTX-Video free provider use karein.');
  }
  if (provider === 'bing') throw new Error('Bing video available nahi hai — LTX-Video use karein.');
  throw new Error(`Unknown video provider: ${provider}. Available: ltx.`);
}

function configuredImageProviders() {
  return [
    ...(!BING_SUPPORTED && imageWorkerConnected() ? ['worker'] : []),
    ...(BING_SUPPORTED ? ['bing'] : []),
    ...(cloudflareAccount && cloudflareToken ? ['cloudflare'] : []),
    ...(hfToken ? ['huggingface'] : []),
    'stock',
  ];
}

async function generateImageSmart(prompt, options = {}) {
  const requested = options.provider || DEFAULT_IMAGE_PROVIDER;
  const useAuto = requested === 'auto';
  const order = useAuto ? configuredImageProviders() : [requested];
  if (!order.length) {
    throw new Error(
      'Koi free image provider configured nahi hai. Local PC kholein ya Settings me Cloudflare/Hugging Face free token daalo.',
    );
  }
  let lastError = null;
  for (const provider of order) {
    try {
      const result = await fetchImageResult(
        prompt,
        options.model || DEFAULT_IMAGE_MODEL,
        provider,
        options.ratio || '16:9',
      );
      return {
        bytes: result.images[0],
        images: result.images,
        provider: result.provider,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Koi image provider available nahi hai.');
}

async function generateVideoSmart(prompt, options = {}) {
  const requested = options.provider || DEFAULT_VIDEO_PROVIDER;
  const order = requested === 'auto' ? ['ltx'] : [requested];
  let lastError = null;
  for (const provider of order) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const bytes = await fetchMediaBytes(
          'video',
          prompt,
          options.model || DEFAULT_VIDEO_MODEL,
          options.duration || 5,
          provider,
          options.ratio || '16:9',
        );
        return { bytes, provider };
      } catch (err) {
        lastError = err;
        const ltxBusy = /LTX-Video (error: null|queue busy|queue|stream|download)|queue unavailable|Space down|timed out/i.test(err.message);
        if (!ltxBusy || attempt === 2) break;
        await sleep(6000);
      }
    }
  }
  throw lastError || new Error('Koi video provider available nahi hai.');
}

async function fetchMediaBytesWithRetry(job, kind, prompt, model, duration, provider, ratio = '16:9') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchMediaBytes(kind, prompt, model, duration, provider, ratio);
    } catch (err) {
      const ltxBusy = /LTX-Video (error: null|queue|stream|download)|queue unavailable|Space down|timed out/i.test(err.message);
      if (!ltxBusy || attempt === 2) throw err;
      await updateMediaJob(job, { step: 'LTX free queue busy — dobara try kar rahe hain…' });
      await sleep(6000);
    }
  }
  throw new Error('Media provider unavailable.');
}

async function createMediaJob(payload = {}) {
  const id = `mj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const prompt = String(payload.prompt || '').trim().slice(0, 1200);
  if (!prompt) throw new Error('Prompt is required.');

  const type = ['story', 'song', 'meme', 'cartoon'].includes(payload.type) ? payload.type : 'story';
  const ratio = payload.ratio === '9:16' ? '9:16' : '16:9';
  const style = String(payload.style || inferMediaStyle(prompt, type)).slice(0, 60);
  const fx = (Array.isArray(payload.fx) ? payload.fx : String(payload.fx || '').split(','))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  const transitions = (Array.isArray(payload.transitions) ? payload.transitions : String(payload.transitions || '').split(','))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  let audioPath = null;
  if (payload.audioPath) {
    audioPath = resolveJobAudioPath(payload.audioPath);
    if (audioPath && !path.isAbsolute(String(payload.audioPath))) {
      audioPath = path.relative(WORKSPACE, audioPath).replace(/\\/g, '/');
    }
  }

  const durationSeconds = Math.min(900, Math.max(15, Number(payload.durationSeconds) || 60));
  const requestedScenes = Number(payload.sceneCount) || 0;
  const sceneCount = Math.min(60, Math.max(6,
    requestedScenes > 0 ? requestedScenes : Math.round(durationSeconds / 12),
  ));

  const job = {
    id,
    type,
    prompt,
    ratio,
    style,
    fx: fx.length ? fx : inferMediaFx(prompt),
    transitions: transitions.length ? transitions : inferTransitions(prompt),
    sceneCount,
    durationSeconds,
    clipSeconds: Math.min(10, Math.max(2, Number(payload.clipSeconds) || 5)),
    audioPath,
    lyrics: String(payload.lyrics || '').slice(0, 12_000),
    narration: payload.narration !== false,
    voice: String(payload.voice || '').slice(0, 120),
    analysis: null,
    useAiVideo:
      payload.useAiVideo !== false &&
      (Boolean(mediaKey) || String(payload.videoProvider || DEFAULT_VIDEO_PROVIDER) === 'ltx'),
    imageModel: String(payload.imageModel || DEFAULT_IMAGE_MODEL).slice(0, 120),
    videoModel: String(payload.videoModel || DEFAULT_VIDEO_MODEL).slice(0, 120),
    imageProvider: String(payload.imageProvider || DEFAULT_IMAGE_PROVIDER).slice(0, 40),
    videoProvider: String(payload.videoProvider || DEFAULT_VIDEO_PROVIDER).slice(0, 40),
    chatId: payload.chatId ? String(payload.chatId).slice(0, 80) : null,
    status: 'queued',
    progress: 0,
    step: 'Job queue me hai…',
    scenes: [],
    output: null,
    outputUrl: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  mediaJobs.unshift(job);
  await saveMediaJobs();
  runMediaJob(job).catch(() => {});
  return job;
}

async function runMediaJob(job) {
  if (mediaRunning.has(job.id)) return;
  mediaRunning.add(job.id);
  try {
    if (cancelledJobs.has(job.id)) throw new Error('Video cancelled.');
    await updateMediaJob(job, { status: 'assets', step: 'Scene assets prepare ho rahe hain…', progress: 5 });
    const directory = path.join(WORKSPACE, 'media-jobs', job.id);
    await mkdir(directory, { recursive: true });
    const audioPath = resolveJobAudioPath(job.audioPath);
    let captions = splitCaptions(job.prompt, job.sceneCount);

    if (audioPath && (job.type === 'song' || job.lyrics)) {
      await updateMediaJob(job, {
        step: 'Song analyse ho raha hai — BPM, zones aur energy…',
        progress: 6,
      });
      const analysis = await analyzeSongAudio(audioPath).catch(() => null);
      if (analysis?.available) {
        job.analysis = analysis;
        await updateMediaJob(job, {
          step: `Song ${analysis.bpm} BPM · ${analysis.zones.length} zones mil gaye`,
          progress: 8,
        });
      }
    }

    const lyricsLines = String(job.lyrics || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const hooks = ['Hook', 'Setup', 'Build-up', 'Twist', 'Climax', 'Reveal', 'Payoff', 'Takeaway'];
    const zones = job.analysis?.zones || [];
    captions = captions.map((caption, index) => {
      const zone = zones.length ? zones[Math.floor((index / job.sceneCount) * zones.length)] : null;
      if (lyricsLines.length) {
        return `${lyricsLines[index % lyricsLines.length]}${zone ? ` · ${zone.label}` : ''}`;
      }
      if (zone) return `${zone.label} · ${caption}`;
      return `${hooks[index % hooks.length]}: ${caption}`;
    });

    let stockImages = [];
    if (job.imageProvider === 'stock') {
      await updateMediaJob(job, {
        step: 'Copyright-free stock images dhoondh rahe hain (Openverse CC0/PDM)…',
        progress: 9,
      });
      stockImages = await generateStockImages(job.prompt, job.sceneCount);
    }

    const useMotion = job.useAiVideo && job.sceneCount <= 8 && !job.analysis;
    for (let index = 0; index < job.sceneCount; index += 1) {
      if (cancelledJobs.has(job.id)) throw new Error('Video cancelled.');
      const scene = job.scenes[index] || { index: index + 1, caption: captions[index] || `Scene ${index + 1}` };
      scene.caption = captions[index] || scene.caption;
      if (!scene.image) {
        await updateMediaJob(job, {
          step: `Scene ${index + 1}/${job.sceneCount}: ${job.style} image ban rahi hai…`,
          progress: 10 + Math.round(((index + 0.3) / job.sceneCount) * 60),
        });
        const scenePrompt = `${job.prompt}. Scene ${index + 1}: ${scene.caption}. ${job.style} style, high detail, cinematic composition.`;
        const bytes = stockImages.length
          ? stockImages[index % stockImages.length]
          : await fetchMediaBytesWithRetry(job, 'image', scenePrompt, job.imageModel, 5, job.imageProvider);
        const file = `scene-${String(index + 1).padStart(2, '0')}.jpg`;
        await writeFile(path.join(directory, file), bytes);
        scene.image = `media-jobs/${job.id}/${file}`;
      }

      if (useMotion && !scene.video && !scene.videoError) {
        await updateMediaJob(job, {
          step: `Scene ${index + 1}/${job.sceneCount}: AI motion clip ban raha hai…`,
          progress: 10 + Math.round(((index + 0.7) / job.sceneCount) * 60),
        });
        try {
          const motionPrompt = `${scene.caption}. ${job.style} style, ${(job.fx || []).join(', ')} motion.`;
          const bytes = await fetchMediaBytesWithRetry(
            job,
            'video',
            motionPrompt,
            job.videoModel,
            job.clipSeconds,
            job.videoProvider,
            job.ratio,
          );
          const file = `scene-${String(index + 1).padStart(2, '0')}.mp4`;
          await writeFile(path.join(directory, file), bytes);
          scene.video = `media-jobs/${job.id}/${file}`;
        } catch (err) {
          scene.videoError = String(err.message || err).slice(0, 300);
        }
      }

      job.scenes[index] = scene;
      await updateMediaJob(job, { progress: 10 + Math.round(((index + 1) / job.sceneCount) * 60) });
    }

    if (cancelledJobs.has(job.id)) throw new Error('Video cancelled.');
    let narrationPath = null;
    if (job.narration && !audioPath) {
      await updateMediaJob(job, { step: 'Voice-over ban raha hai…', progress: 73 });
      try {
        narrationPath = await synthesizeNarration(
          captions.join('. '),
          job.voice,
          path.join(directory, 'narration.wav'),
        );
      } catch (err) {
        await updateMediaJob(job, { step: `Voice optional chhod diya: ${String(err.message || err).slice(0, 120)}` });
      }
    }

    const bin = await ffmpegExecutable('ffmpeg');
    if (!bin) {
      await updateMediaJob(job, {
        status: 'awaiting-render',
        progress: 75,
        step: 'Final video browser me render hona baaki hai…',
      });
    } else {
      await assembleVideoWithFfmpeg(job, directory, { narration: narrationPath });
    }
  } catch (err) {
    await updateMediaJob(job, {
      status: 'error',
      error: String(err.message || err).slice(0, 600),
      step: 'Error',
    });
  } finally {
    mediaRunning.delete(job.id);
  }
}

async function resumeMediaJobs() {
  for (const job of mediaJobs) {
    const lastTouch = Number(job.updatedAt || job.createdAt || 0);
    if (!['done', 'error'].includes(job.status) && Date.now() - lastTouch > 45 * 60_000) {
      await updateMediaJob(job, {
        status: 'error',
        error: 'Video job timeout — dobara try karein.',
        step: 'Error',
      });
      continue;
    }
    if (job.status === 'queued' || job.status === 'assets') {
      runMediaJob(job).catch(() => {});
    } else if (job.status === 'rendering') {
      const directory = path.join(WORKSPACE, 'media-jobs', job.id);
      await updateMediaJob(job, { step: 'Restart ke baad FFmpeg render resume…', progress: 75 });
      if (job.scenes?.length) assembleVideoWithFfmpeg(job, directory, {}).catch(() => {});
      else await updateMediaJob(job, { status: 'awaiting-render', step: 'Browser render resume…', progress: 75 });
    }
  }
}

/* --------------------------------- agent ---------------------------------- */

function safeWorkspacePath(rel = '', root = WORKSPACE) {
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const target = path.resolve(root, clean || '.');
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Access outside the allowed folder is not allowed.');
  }
  return target;
}

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the live web for current information. Use it for news, prices, facts, or anything time-sensitive.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in the local workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file from the workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a text file in the workspace. Use this to save reports, code, or notes the user asked for.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Run JavaScript (node) or Python code in the workspace and return its output. Use it for calculations, data processing or code the user asked to execute.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string', enum: ['js', 'python'] },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate a high-quality image with a free provider (Bing locally, Cloudflare Flux or Hugging Face Flux online). Returns an image URL. Pollinations is disabled.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          model: { type: 'string' },
          provider: { type: 'string', enum: ['auto', 'bing', 'cloudflare', 'huggingface'] },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description: 'Generate a short MP4 with LTX-Video (open-source, GitHub/Hugging Face, no key). Returns a video URL. Pollinations is disabled.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          duration: { type: 'number' },
          model: { type: 'string' },
          ratio: { type: 'string', enum: ['16:9', '9:16'] },
          provider: { type: 'string', enum: ['auto', 'ltx'] },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_media_job',
      description: 'Create a resumable video editing job. Use this whenever the user asks for a story video, cartoon video, cinematic clip, meme/funny video, or a video for an MP3 song. Pick ratio 16:9 or 9:16, infer style/fx/transitions from the request, and pass audioPath when a workspace MP3 is provided. The app keeps the job alive across restarts and renders it in the browser.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          type: { type: 'string', enum: ['story', 'song', 'meme', 'cartoon'] },
          ratio: { type: 'string', enum: ['16:9', '9:16'] },
          style: { type: 'string', enum: ['auto', 'cinematic', 'cartoon', 'meme', 'anime', 'realistic'] },
          fx: {
            type: 'array',
            items: { type: 'string', enum: ['zoom', 'pan', 'glitch', 'shake', 'sparkle', 'fade'] },
          },
          transitions: {
            type: 'array',
            items: { type: 'string', enum: ['fade', 'slide', 'zoom', 'wipe'] },
          },
          audioPath: { type: 'string' },
          sceneCount: { type: 'number' },
          clipSeconds: { type: 'number' },
          useAiVideo: { type: 'boolean' },
          imageModel: { type: 'string' },
          videoModel: { type: 'string' },
          chatId: { type: 'string' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_folder',
      description: 'Create a folder inside the allowed root folder.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a single file inside the allowed root folder. Folders are not deleted.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copy_file',
      description: 'Copy a file inside the allowed root folder.',
      parameters: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Move or rename a file inside the allowed root folder.',
      parameters: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_webpage',
      description: 'Open a webpage in the user\'s browser. Use for showing docs, dashboards, search results or a published page.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_open',
      description: 'Open a URL in the controlled browser and make it the active page for later browser_click/browser_type calls.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_wait',
      description: 'Wait until a CSS selector appears on the active browser page. Use after opening a page before clicking or reading it.',
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' }, timeoutMs: { type: 'number' } },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element on the active browser page using a CSS selector.',
      parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description: 'Type text into the focused element or the element matching a CSS selector on the active browser page.',
      parameters: {
        type: 'object',
        properties: { selector: { type: 'string' }, text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_text',
      description: 'Read the visible text of an element (or the whole page) on the active browser page.',
      parameters: { type: 'object', properties: { selector: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Save a screenshot of the active browser page into the allowed folder.',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    },
  },
];

const TOOL_LABELS = {
  web_search: 'Searching the web…',
  list_files: 'Listing workspace files…',
  read_file: 'Reading a file…',
  write_file: 'Writing a file…',
  run_code: 'Running code…',
  generate_image: 'Creating an image…',
  generate_video: 'Creating a short video…',
  create_media_job: 'Starting resumable video project…',
  create_folder: 'Creating a folder…',
  delete_file: 'Deleting a file…',
  copy_file: 'Copying a file…',
  move_file: 'Moving a file…',
  open_webpage: 'Opening a webpage…',
  browser_open: 'Opening browser page…',
  browser_wait: 'Waiting for page to load…',
  browser_click: 'Clicking in browser…',
  browser_type: 'Typing in browser…',
  browser_text: 'Reading browser page…',
  browser_screenshot: 'Taking screenshot…',
};

function runCommand(command, args, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: WORKSPACE, windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout?.on('data', (chunk) => { out += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { err += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ out: '', err: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ out: out.slice(0, 20_000), err: err.slice(0, 5_000), code });
    });
  });
}

async function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function cdpAvailable() {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(1200),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureBrowser() {
  if (await cdpAvailable()) return;
  const executable = await findBrowserExecutable();
  if (!executable) throw new Error('Chrome or Edge was not found on this PC.');

  // Purana browser sudden close hone par singleton locks bache rehte hain —
  // unke karan naya Chrome same profile ke saath start nahi hota aur login dobara mangta hai.
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    await rm(path.join(BROWSER_PROFILE, lock), { force: true }).catch(() => {});
  }

  const child = spawn(
    executable,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${BROWSER_PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore', windowsHide: false },
  );
  child.unref();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(400);
    if (await cdpAvailable()) return;
  }
  throw new Error('The browser started but the debugging port did not open.');
}

async function cookieCdpAvailable() {
  try {
    const response = await fetch(`http://127.0.0.1:${COOKIE_CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(1200),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureCookieBrowser() {
  if (await cookieCdpAvailable()) return;
  const executable = await findBrowserExecutable();
  if (!executable) throw new Error('Chrome or Edge was not found on this PC.');
  // Visible Chrome nahi chal raha — yahi profile hidden mode me kholkar login cookies padhein.
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    await rm(path.join(BROWSER_PROFILE, lock), { force: true }).catch(() => {});
  }
  const child = spawn(
    executable,
    [
      '--headless=new',
      `--remote-debugging-port=${COOKIE_CDP_PORT}`,
      `--user-data-dir="${BROWSER_PROFILE}"`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  child.unref();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(400);
    if (await cookieCdpAvailable()) return;
  }
  throw new Error('Cookie reader browser start nahi hua.');
}

async function cookiesFromCdpPort(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(8000),
  });
  const targets = await response.json();
  const target = targets.find((item) => item.type === 'page') || targets[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('Browser me page nahi mila.');
  const result = await cdpCommand(target.webSocketDebuggerUrl, 'Storage.getCookies', {});
  return (result.cookies || []).filter((item) =>
    /bing\.com$/i.test(String(item.domain || '').replace(/^\./, '')),
  );
}

async function openBrowserLogin() {
  const urls = [
    'https://www.bing.com/images/create',
    'https://login.live.com/',
    'https://accounts.google.com/',
  ];
  const opened = [];
  for (const target of urls) {
    try {
      await browserTarget(target);
      opened.push(target);
    } catch {
      /* one tab fail hone se baaki tabs kholo */
    }
  }
  if (!opened.length) throw new Error('Chrome login tabs nahi khul paaye.');
  return opened;
}

async function cdpCommand(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try { socket.close(); } catch { /* ignore */ }
      reject(new Error(`Browser command timed out: ${method}`));
    }, 25_000);

    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method, params }));
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id !== 1) return;
      clearTimeout(timer);
      try { socket.close(); } catch { /* ignore */ }
      if (message.error) reject(new Error(message.error.message || 'Browser command failed'));
      else resolve(message.result || {});
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Could not connect to the browser.'));
    };
  });
}

async function browserTarget(openUrl = '') {
  await ensureBrowser();

  if (openUrl) {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(openUrl)}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const target = await response.json();
      browserTargetId = target.id;
      return target;
    }
  }

  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, { signal: AbortSignal.timeout(8000) });
  const targets = await response.json();
  const target =
    targets.find((item) => item.type === 'page' && item.id === browserTargetId) ||
    targets.find((item) => item.type === 'page');
  if (!target) throw new Error('No browser page is available.');
  browserTargetId = target.id;
  return target;
}

async function pageEvaluate(expression) {
  const target = await browserTarget();
  const result = await cdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Page script failed.');
  }
  return result.result?.value;
}

/* ---------- hidden Chrome for Bing (screen par page kabhi nahi dikhta) ------- */

async function imageCdpAvailable() {
  try {
    const response = await fetch(`http://127.0.0.1:${IMG_CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(1200),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureImageBrowser() {
  if (await imageCdpAvailable()) return;
  const executable = await findBrowserExecutable();
  if (!executable) throw new Error('Chrome or Edge was not found on this PC.');
  await mkdir(IMG_BROWSER_PROFILE, { recursive: true });
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    await rm(path.join(IMG_BROWSER_PROFILE, lock), { force: true }).catch(() => {});
  }
  const child = spawn(
    executable,
    [
      '--headless=new',
      `--remote-debugging-port=${IMG_CDP_PORT}`,
      `--user-data-dir=${IMG_BROWSER_PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  child.unref();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(400);
    if (await imageCdpAvailable()) return;
  }
  throw new Error('Hidden Bing browser started, par debugging port nahi khula.');
}

async function imageBrowserTarget(openUrl = '') {
  await ensureImageBrowser();
  if (openUrl) {
    const response = await fetch(`http://127.0.0.1:${IMG_CDP_PORT}/json/new?${encodeURIComponent(openUrl)}`, {
      method: 'PUT',
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const target = await response.json();
      imageTargetId = target.id;
      return target;
    }
  }
  const response = await fetch(`http://127.0.0.1:${IMG_CDP_PORT}/json/list`, {
    signal: AbortSignal.timeout(8000),
  });
  const targets = await response.json();
  const target =
    targets.find((item) => item.type === 'page' && item.id === imageTargetId) ||
    targets.find((item) => item.type === 'page');
  if (!target) throw new Error('Hidden Bing browser me koi page nahi hai.');
  imageTargetId = target.id;
  return target;
}

async function imagePageEvaluate(expression) {
  const target = await imageBrowserTarget();
  const result = await cdpCommand(target.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Page script failed.');
  }
  return result.result?.value;
}

function cookiesFromHeader(header) {
  return String(header || '')
    .split(';')
    .map((part) => {
      const index = part.indexOf('=');
      if (index < 1) return null;
      return {
        name: part.slice(0, index).trim(),
        value: part.slice(index + 1).trim(),
        domain: '.bing.com',
        path: '/',
      };
    })
    .filter((item) => item?.name && item.value);
}

async function injectImageBrowserCookies(cookies) {
  if (!cookies?.length) return;
  const target = await imageBrowserTarget();
  const clean = cookies
    .filter((item) => item?.name && item?.value)
    .map((item) => ({
      name: item.name,
      value: item.value,
      domain: item.domain,
      path: item.path || '/',
      secure: Boolean(item.secure),
      httpOnly: Boolean(item.httpOnly),
    }));
  await cdpCommand(target.webSocketDebuggerUrl, 'Storage.setCookies', { cookies: clean });
}

/* --------------------------- free media providers -------------------------- */

let bingQueue = Promise.resolve();

function withBingLock(task) {
  const run = bingQueue.then(task, task);
  bingQueue = run.catch(() => {});
  return run;
}

async function bingImageTarget() {
  await ensureBrowser();
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
      signal: AbortSignal.timeout(8000),
    });
    const targets = await response.json();
    const existing = targets.find(
      (item) => item.type === 'page' && /bing\.com\/images\/create/i.test(item.url || ''),
    );
    if (existing) {
      browserTargetId = existing.id;
      return existing;
    }
  } catch {
    /* fall through to open a fresh tab */
  }
  return browserTarget('https://www.bing.com/images/create');
}

async function waitForPageValue(expression, timeout = 120_000, evaluator = pageEvaluate) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluator(expression);
    } catch {
      last = null; // page navigation ke dauran evaluate fail ho sakta hai
    }
    if (last) return last;
    await sleep(700);
  }
  return last || false;
}

const BING_IMG_SELECTOR = 'img.aigc-display__img, img.aigc-batch__thumb';

function bingImageUrlsScript(previous, minCount) {
  return `(() => {
    const nodes = [...document.querySelectorAll('${BING_IMG_SELECTOR}')];
    const srcs = [...new Set(nodes
      .map((i) => i.src || i.dataset.src || '')
      .filter((u) => u.indexOf('http') === 0))];
    const fresh = srcs.filter((u) => !${JSON.stringify(previous)}.includes(u));
    const loaded = fresh.filter((u) => nodes.some(
      (i) => (i.src || i.dataset.src || '') === u && i.naturalWidth > 0,
    ));
    if (loaded.length >= ${minCount}) return JSON.stringify(loaded.slice(0, 4));
    const text = document.body.innerText || '';
    if (/guest creation limit|sign in to use your own prompts|out of creations|you.?ve reached|creation limit|captcha|unusual traffic/i.test(text)) {
      return 'ERROR: Bing free limit ya captcha. Hidden Chrome profile me Microsoft sign-in check karein.';
    }
    return false;
  })()`;
}

async function generateBingImages(prompt) {
  return withBingLock(async () => {
    // Login cookies hidden browser me copy — generation poori tarah background me, koi page visible nahi.
    try {
      if (await cdpAvailable()) {
        await injectImageBrowserCookies(await cookiesFromCdpPort(CDP_PORT));
      } else {
        await ensureCookieBrowser();
        await injectImageBrowserCookies(await cookiesFromCdpPort(COOKIE_CDP_PORT));
      }
    } catch {
      if (bingCookie) await injectImageBrowserCookies(cookiesFromHeader(bingCookie)).catch(() => {});
    }

    const target = await imageBrowserTarget();
    // Bing UI "Generating" state ko clear karne ke liye har baar fresh page.
    await cdpCommand(target.webSocketDebuggerUrl, 'Page.navigate', {
      url: 'https://www.bing.com/images/create',
    });
    await sleep(2500);
    await waitForPageValue(
      `(() => {
        const box = document.querySelector('textarea.gmc__textarea');
        const button = document.querySelector('button.gmbtn__btn');
        if (!box || !button) return false;
        const label = (button.innerText || '').trim();
        return /^Generate/i.test(label) && !/Generating/i.test(label);
      })()`,
      60_000,
      imagePageEvaluate,
    );
    await sleep(1800); // Bing React UI ko hydrate hone do

    const previousSrcs =
      (await imagePageEvaluate(
        `(() => [...new Set([...document.querySelectorAll('${BING_IMG_SELECTOR}')]
          .map((i) => i.src || i.dataset.src || '')
          .filter((u) => u.indexOf('http') === 0))])()`,
      )) || [];

    const started = await imagePageEvaluate(
      `(() => {
        const box = document.querySelector('textarea.gmc__textarea');
        if (!box) throw new Error('Bing prompt box not found.');
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        box.focus();
        setter.call(box, ${JSON.stringify(prompt)});
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.dispatchEvent(new Event('change', { bubbles: true }));
        if (box.value !== ${JSON.stringify(prompt)}) throw new Error('Bing prompt box ne text accept nahi ki.');
        const button = document.querySelector('button.gmbtn__btn') ||
          [...document.querySelectorAll('button')].find((item) => /^Generate/i.test((item.innerText || '').trim()));
        if (!button || /Generating/i.test(button.innerText || '')) throw new Error('Bing Generate button abhi busy hai.');
        button.click();
        return true;
      })()`,
    );
    if (!started) throw new Error('Bing image generation could not start.');
    await sleep(1500);

    const first = await waitForPageValue(bingImageUrlsScript(previousSrcs, 1), 240_000, imagePageEvaluate);
    if (typeof first === 'string' && first.startsWith('ERROR:')) throw new Error(first.slice(6));
    if (!first || typeof first !== 'string') {
      throw new Error('Bing ne image return nahi ki. Free limit ya sign-in check karein.');
    }
    let urls = JSON.parse(first).slice(0, 4);

    // Bing usually 4 images deta hai — thoda wait karke baaki bhi pakad lein.
    if (urls.length < 4) {
      const extra = await waitForPageValue(
        bingImageUrlsScript(previousSrcs, 4),
        25_000,
        imagePageEvaluate,
      ).catch(() => null);
      if (typeof extra === 'string' && extra.startsWith('[')) {
        urls = [...new Set([...urls, ...JSON.parse(extra)])].slice(0, 4);
      }
    }
    if (!urls.length) throw new Error('Bing ne image return nahi ki.');

    const settled = await Promise.allSettled(
      urls.map((url) =>
        fetch(url, {
          headers: { 'user-agent': UA },
          signal: AbortSignal.timeout(90_000),
        }).then(async (response) => {
          if (!response.ok) throw new Error(`Bing image download failed (${response.status}).`);
          return Buffer.from(await response.arrayBuffer());
        }),
      ),
    );
    const images = settled
      .filter((item) => item.status === 'fulfilled' && item.value?.length > 128)
      .map((item) => item.value);
    if (!images.length) {
      throw new Error(settled.find((item) => item.status === 'rejected')?.reason?.message || 'Bing image download failed.');
    }
    return images;
  });
}

async function generateBingImage(prompt) {
  const images = await generateBingImages(prompt);
  return images[0];
}

async function bingCookiesFromBrowser(openTab = false) {
  await ensureBrowser();
  const target = await browserTarget(openTab ? 'https://www.bing.com/images/create' : '');
  const result = await cdpCommand(target.webSocketDebuggerUrl, 'Storage.getCookies', {});
  const cookies = (result.cookies || []).filter((item) =>
    /bing\.com$/i.test(String(item.domain || '').replace(/^\./, '')),
  );
  const auth = cookies.find((item) => item.name === '_U' && item.value);
  if (!auth) {
    throw new Error('Bing me Microsoft sign-in nahi hua. Pehle Settings → “Open login tabs in Chrome” se login karein.');
  }
  return {
    header: cookies.map((item) => `${item.name}=${item.value}`).join('; ').slice(0, 12_000),
    cookies,
  };
}

async function syncBingLoginToLive() {
  let cookie;
  let cookies;
  if (await cdpAvailable()) {
    ({ header: cookie, cookies } = await bingCookiesFromBrowser());
  } else {
    await ensureCookieBrowser();
    cookies = await cookiesFromCdpPort(COOKIE_CDP_PORT);
    cookie = cookies.map((item) => `${item.name}=${item.value}`).join('; ').slice(0, 12_000);
  }
  if (!cookie || !/_U=[^;]+/.test(cookie)) {
    throw new Error('Bing me Microsoft sign-in nahi hai. Settings → “Open login tabs in Chrome” se ek baar login karein.');
  }
  // Login cookies hidden image browser me bhi copy — generation bilkul background me chalegi.
  await injectImageBrowserCookies(cookies).catch(() => {});
  const response = await fetch(`${LIVE_URL}/api/bing-cookie`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cookie, workerToken: imageWorkerToken, currentToken: imageWorkerToken }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Live sync failed (${response.status}).`);
  return LIVE_URL;
}

function bingHttpHeaders() {
  return {
    'content-type': 'application/x-www-form-urlencoded',
    'user-agent': UA,
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    origin: 'https://www.bing.com',
    referer: 'https://www.bing.com/images/create/',
    cookie: bingCookie,
  };
}

async function generateBingImageHttp(prompt) {
  if (!bingCookie) {
    throw new Error('Bing login cookie sync nahi hua. Local PC se Settings → “Sync Bing login to live” dabayein.');
  }
  const q = encodeURIComponent(String(prompt).slice(0, 700));
  const headers = bingHttpHeaders();
  const post = (rt) =>
    fetch(`https://www.bing.com/images/create?q=${q}&rt=${rt}&FORM=GENCRE`, {
      method: 'POST',
      headers,
      body: `q=${q}&rt=${rt}&FORM=GENCRE`,
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    });

  let response = await post(4);
  let body = await response.text();
  const blocked = /0 coins available|out of creations|you.?ve reached|creation limit|captcha|unusual traffic/i.exec(body);
  if (blocked) {
    throw new Error(
      `Bing ne ${blocked[0]} dikhaaya. ${body.replace(/\s+/g, ' ').slice(Math.max(0, blocked.index - 40), blocked.index + 90)}`,
    );
  }
  let location = response.headers.get('location') || '';
  if (response.status !== 302 || !location) {
    response = await post(3);
    body = await response.text();
    location = response.headers.get('location') || '';
    if (response.status !== 302 || !location) throw new Error(`Bing image start failed (${response.status}).`);
  }

  const redirectUrl = (/^https?:\/\//i.test(location) ? location : `https://www.bing.com${location}`).replace(
    /&nfy=1/i,
    '',
  );
  const id = decodeURIComponent((redirectUrl.split('id=').pop() || '').split('&')[0]);
  if (!id) throw new Error('Bing ne request id nahi diya.');
  await fetch(redirectUrl, { headers, redirect: 'manual', signal: AbortSignal.timeout(60_000) }).catch(() => {});

  const pollUrl = `https://www.bing.com/images/create/async/results/${encodeURIComponent(id)}?q=${q}`;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const polled = await fetch(pollUrl, { headers, signal: AbortSignal.timeout(60_000) });
    const text = await polled.text();
    if (!polled.ok) throw new Error(`Bing polling failed (${polled.status}).`);
    if (!text || /GenerativeImagesStatusPage/i.test(text)) {
      await sleep(1200);
      continue;
    }
    let errorMessage = '';
    try {
      errorMessage = JSON.parse(text)?.errorMessage || '';
    } catch {
      /* html result */
    }
    if (errorMessage) throw new Error(`Bing: ${errorMessage}`);

    const urls = [...text.matchAll(/<img\b[^>]*>/gi)]
      .map((match) => match[0])
      .filter((tag) => /\bmimg\b/i.test(tag))
      .map((tag) => (/\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1] || '')
      .map((url) => url.replace(/&amp;/g, '&').split('?w=')[0])
      .filter((url) => /^https?:\/\//i.test(url));
    if (!urls.length) throw new Error('Bing ne image return nahi ki.');

    const imageResponse = await fetch(urls[0], {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(90_000),
    });
    if (!imageResponse.ok) throw new Error(`Bing image download failed (${imageResponse.status}).`);
    return Buffer.from(await imageResponse.arrayBuffer());
  }
  throw new Error('Bing image generation timed out.');
}

/* ---------- live → local PC image worker (Bing UI par Render se bhejkar) ---------- */

function imageWorkerConnected() {
  return Boolean(imageWorkerToken && Date.now() - imageWorkerLastSeen < 90_000);
}

function generateImageViaWorker(prompt, ratio) {
  if (!imageWorkerToken) {
    throw new Error(
      'Live PC image worker connected nahi hai. Local PC kholein aur Settings → “Sync Bing login to live site” dabayein.',
    );
  }
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      pendingImageJobs.delete(id);
      reject(
        new Error(
          'Local PC se image nahi mili. PC chaloo aur Settings → “Sync Bing login to live site” dabayein.',
        ),
      );
    }, 240_000);
    pendingImageJobs.set(id, {
      id,
      prompt: String(prompt).slice(0, 700),
      ratio: ratio || '16:9',
      status: 'queued',
      createdAt: Date.now(),
      finish: (err, images) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingImageJobs.delete(id);
        if (err) reject(err);
        else resolve(Array.isArray(images) ? images : [images]);
      },
    });
  });
}

function workerTokenFrom(req, body = {}) {
  return String(req.headers['x-worker-token'] || body.workerToken || body.token || body.currentToken || '').trim();
}

function authorizedWorker(req, body = {}) {
  return Boolean(imageWorkerToken && workerTokenFrom(req, body) === imageWorkerToken);
}

async function handleImageWorkerPoll(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
  if (!authorizedWorker(req)) return sendJson(res, 401, { error: 'Worker token invalid.' });
  imageWorkerLastSeen = Date.now();
  const now = Date.now();
  for (const job of pendingImageJobs.values()) {
    if (job.status === 'queued' || (job.status === 'claimed' && now - (job.claimedAt || 0) > 90_000)) {
      job.status = 'claimed';
      job.claimedAt = now;
      return sendJson(res, 200, { job: { id: job.id, prompt: job.prompt, ratio: job.ratio } });
    }
  }
  return sendJson(res, 200, { job: null, connected: true });
}

async function handleImageWorkerResult(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
  let body = {};
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }
  if (!authorizedWorker(req, body)) return sendJson(res, 401, { error: 'Worker token invalid.' });
  imageWorkerLastSeen = Date.now();
  const job = pendingImageJobs.get(String(body.id || ''));
  if (!job) return sendJson(res, 404, { error: 'Image job not found.' });
  if (body.error) {
    job.finish(new Error(String(body.error).slice(0, 500)));
    return sendJson(res, 200, { ok: true });
  }
  let images;
  try {
    const encoded = Array.isArray(body.images) && body.images.length
      ? body.images
      : [String(body.image || '')];
    images = encoded
      .map((item) => Buffer.from(String(item || ''), 'base64'))
      .filter((item) => item.length >= 128);
    if (!images.length) throw new Error('Empty image.');
  } catch (err) {
    job.finish(new Error('Local worker sent invalid image bytes.'));
    return sendJson(res, 200, { ok: true });
  }
  job.finish(null, images.slice(0, 4));
  return sendJson(res, 200, { ok: true });
}

let imageWorkerBusy = false;
async function pollImageWorker() {
  if (imageWorkerBusy || !BING_SUPPORTED || !imageWorkerToken) return;
  imageWorkerBusy = true;
  try {
    const response = await fetch(`${LIVE_URL}/api/image-worker/poll`, {
      headers: { 'x-worker-token': imageWorkerToken },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401 || response.status === 403) {
      // Render restart / token mismatch — local PC dobara setup kar deta hai.
      await syncBingLoginToLive().catch(() => {});
      return;
    }
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    const job = data.job;
    if (!job?.id) return;
    try {
      const images = await generateBingImages(String(job.prompt || '').slice(0, 700));
      await fetch(`${LIVE_URL}/api/image-worker/result`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-worker-token': imageWorkerToken,
        },
        body: JSON.stringify({
          id: job.id,
          image: images[0].toString('base64'),
          images: images.map((item) => item.toString('base64')),
        }),
        signal: AbortSignal.timeout(120_000),
      });
      console.log(`  Image worker: ${images.length} image bheji gayi -> ${String(job.id).slice(0, 8)}`);
    } catch (err) {
      await fetch(`${LIVE_URL}/api/image-worker/result`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-worker-token': imageWorkerToken,
        },
        body: JSON.stringify({ id: job.id, error: String(err.message || err).slice(0, 500) }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => {});
    }
  } catch {
    /* offline — agle tick me dobara try */
  } finally {
    imageWorkerBusy = false;
  }
}

function startImageWorker() {
  if (!BING_SUPPORTED || !imageWorkerToken) return;
  setTimeout(() => pollImageWorker().catch(() => {}), 3000);
  setInterval(() => pollImageWorker().catch(() => {}), 2500);
  console.log(`  Image worker: local Bing -> ${LIVE_URL}\n`);
}

async function generateCloudflareImage(prompt, model) {
  if (!cloudflareAccount || !cloudflareToken) {
    throw new Error('Cloudflare image ke liye Settings → Cloudflare Account ID + API token chahiye.');
  }
  const candidates = [...new Set([
    CF_IMAGE_MODELS.includes(model) ? model : CF_IMAGE_MODELS[0],
    CF_IMAGE_MODELS[0],
  ])];
  let lastError = null;
  for (const useModel of candidates) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccount)}/ai/run/${useModel}`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${cloudflareToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 4 }),
        signal: AbortSignal.timeout(180_000),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const detail = data.errors?.map((item) => item.message).filter(Boolean).join('; ');
      const message = detail || `Cloudflare image failed (${response.status}).`;
      if (/auth|unauthor|permission|forbidden|token|invalid|10000|9109/i.test(message)) {
        throw new Error(
          `${message} — token Workers AI ka hona chahiye (Global API key / Cloudflare Images token nahi). `
          + 'Dashboard → AI → Workers AI → Use REST API se token banayein aur Settings me dobara daalein.',
        );
      }
      lastError = new Error(`${message} (${useModel})`);
      continue;
    }
    const raw = String(data.result?.image || '');
    if (!raw) {
      lastError = new Error('Cloudflare ne image return nahi ki.');
      continue;
    }
    return Buffer.from(raw.replace(/^data:image\/[^;]+;base64,/i, ''), 'base64');
  }
  throw lastError || new Error('Cloudflare image nahi ban payi.');
}

async function resolveHfImageRef(ref, space, useAuth = true) {
  if (typeof ref === 'string') {
    const trimmed = ref.trim();
    if (/^data:image\/[^;]+;base64,/i.test(trimmed)) {
      return Buffer.from(trimmed.split(',')[1] || '', 'base64');
    }
    if (/^[A-Za-z0-9+/=]{500,}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'base64');
    }
    return fetchHfImageFile(trimmed, space, useAuth);
  }
  if (!ref || typeof ref !== 'object') throw new Error('HF Flux ne image return nahi ki.');
  if (ref.url) return resolveHfImageRef(String(ref.url), space, useAuth);
  if (ref.path) return fetchHfImageFile(String(ref.path), space, useAuth);
  throw new Error('HF Flux ne image return nahi ki.');
}

async function fetchHfImageFile(url, space, useAuth = true) {
  const target = /^https?:\/\//i.test(url)
    ? url
    : url.startsWith('/')
      ? `${space}${url}`
      : `${space}/gradio_api/file=${url}`;
  const withAuth = useAuth && hfToken && /(^|\.)huggingface\.co$|(^|\.)hf\.space$/i.test(new URL(target).hostname);
  const headers = withAuth ? { authorization: `Bearer ${hfToken}` } : {};
  const response = await fetch(target, {
    headers,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok && withAuth) {
    const retry = await fetch(target, { signal: AbortSignal.timeout(120_000) });
    if (retry.ok) return Buffer.from(await retry.arrayBuffer());
    throw new Error(`HF image download failed (${response.status}/${retry.status}).`);
  }
  if (!response.ok) throw new Error(`HF image download failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function callHfFluxSpace(space, prompt, width = 1024, height = 1024, useAuth = true) {
  const headers = { 'content-type': 'application/json' };
  if (useAuth && hfToken) headers.authorization = `Bearer ${hfToken}`;
  const w = Math.max(256, Math.min(2048, Number(width) || 1024));
  const h = Math.max(256, Math.min(2048, Number(height) || 1024));

  const data = [
    String(prompt || '').slice(0, 2048),
    0,
    true,
    w,
    h,
    4,
  ];

  const submitted = await fetch(`${space}/gradio_api/call/infer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(60_000),
  });
  const submittedText = await submitted.text().catch(() => '');
  if (!submitted.ok) {
    throw new Error(`HF Flux Space unavailable (${submitted.status}). ${submittedText.slice(0, 160)}`);
  }
  let eventId = '';
  try {
    eventId = JSON.parse(submittedText).event_id || '';
  } catch {
    /* ignore malformed submit response */
  }
  if (!eventId) throw new Error('HF Flux ne job id nahi diya.');

  const stream = await fetch(`${space}/gradio_api/call/infer/${eventId}`, {
    headers,
    signal: AbortSignal.timeout(6 * 60_000),
  });
  if (!stream.ok || !stream.body) throw new Error(`HF Flux stream failed (${stream.status}).`);
  const raw = await stream.text();

  let imageRef = null;
  let errorDetail = '';
  for (const block of raw.split('\n\n')) {
    const event = /^event:\s*(\S+)/m.exec(block);
    const payload = /^data:\s*(.+)$/m.exec(block);
    if (!event || !payload) continue;
    if (event[1] === 'error') {
      try {
        const parsed = JSON.parse(payload[1]);
        errorDetail = typeof parsed === 'string' ? parsed : parsed?.detail || parsed?.message || '';
      } catch {
        errorDetail = payload[1] === 'null' ? '' : payload[1].slice(0, 200);
      }
    }
    if (event[1] === 'complete') {
      try {
        const parsed = JSON.parse(payload[1]);
        if (parsed && parsed[0]) imageRef = parsed[0];
      } catch {
        /* ignore malformed complete block */
      }
    }
  }

  if (imageRef) return resolveHfImageRef(imageRef, space, useAuth);
  if (/quota|rate limit|limit reached|unauthorized|invalid token/i.test(errorDetail)) {
    throw new Error(`HF Flux: ${errorDetail.slice(0, 220)}`);
  }
  const hint = errorDetail || raw.replace(/\s+/g, ' ').trim().slice(-120);
  throw new Error(`HF Flux queue busy${hint ? ` (${hint.slice(0, 160)})` : ' (null)'}.`);
}

function hfQuotaError(data) {
  const runs = data?.runs || {};
  const remaining = Number(runs.remaining);
  const seconds = Number(data?.current);
  if (remaining !== 0 && !(seconds < 60)) return null;
  const reset = remaining === 0 ? runs.resetsAt : data?.resetsAt;
  const when = reset ? new Date(reset).toLocaleString('en-IN') : 'thodi der baad';
  return new Error(
    `HF free GPU quota khatam hai (${runs.used || 0}/${runs.limit || 0} runs, ${Math.max(0, Math.floor(seconds))}s left). Reset: ${when}.`,
  );
}

async function checkHfServerQuota() {
  if (!hfToken) return;
  let data = null;
  try {
    const response = await fetch('https://huggingface.co/api/spaces/zero-gpu/quota', {
      headers: { authorization: `Bearer ${hfToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) data = await response.json().catch(() => null);
  } catch {
    return;
  }
  const error = hfQuotaError(data);
  if (error) throw error;
}

async function generateHuggingFaceImage(prompt, model, ratio = '16:9') {
  const size = ratio === '9:16' ? [768, 1344] : ratio === '1:1' ? [1024, 1024] : [1344, 768];
  const [width, height] = size;
  await checkHfServerQuota();
  // Token hai to usi account ka quota use karo; nahi to public pool.
  const useAuth = Boolean(hfToken);
  let lastError = null;
  for (const space of HF_FLUX_SPACES) {
    try {
      return await callHfFluxSpace(space, prompt, width, height, useAuth);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Hugging Face Flux abhi image nahi bana pa raha. ${lastError?.message || ''}`.trim(),
  );
}

async function generateLtxVideo(prompt, options = {}) {
  const SPACE = 'https://lightricks-ltx-video-distilled.hf.space';
  const duration = Math.min(8.5, Math.max(0.3, Number(options.duration) || 3));
  const portrait = options.ratio === '9:16';
  const headers = { 'content-type': 'application/json' };
  if (hfToken) headers.authorization = `Bearer ${hfToken}`;

  const data = [
    String(prompt || '').slice(0, 800),
    'worst quality, blurry, distorted, watermark',
    '',
    '',
    portrait ? 704 : 512,
    portrait ? 512 : 704,
    'text-to-video',
    duration,
    9,
    42,
    true,
    1,
    true,
  ];

  const submitted = await fetch(`${SPACE}/gradio_api/call/text_to_video`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!submitted.ok) {
    throw new Error(`LTX-Video queue unavailable (${submitted.status}). Free Space busy ho sakta hai.`);
  }
  const eventId = (await submitted.json().catch(() => ({}))).event_id;
  if (!eventId) throw new Error('LTX-Video ne job id nahi diya.');

  const stream = await fetch(`${SPACE}/gradio_api/call/text_to_video/${eventId}`, {
    headers,
    signal: AbortSignal.timeout(6 * 60_000),
  });
  if (!stream.ok || !stream.body) throw new Error(`LTX-Video stream failed (${stream.status}).`);
  const raw = await stream.text();

  let videoUrl = '';
  for (const block of raw.split('\n\n').reverse()) {
    const event = /^event:\s*(\S+)/m.exec(block);
    const payload = /^data:\s*(.+)$/m.exec(block);
    if (!event || !payload) continue;
    if (event[1] === 'error') {
      const detail = String(payload?.[1] || '').slice(0, 300);
      throw new Error(
        detail && detail !== 'null' ? `LTX-Video error: ${detail}` : 'LTX-Video queue busy (null).',
      );
    }
    if (event[1] === 'complete') {
      try {
        const parsed = JSON.parse(payload[1]);
        videoUrl = parsed?.[0]?.video?.url || '';
      } catch {
        /* ignore malformed block */
      }
      if (videoUrl) break;
    }
  }
  if (!videoUrl) throw new Error('LTX-Video ne video return nahi ki. Queue timeout ya Space down hai.');
  if (/^\//.test(videoUrl)) videoUrl = `${SPACE}${videoUrl}`;

  const videoResponse = await fetch(videoUrl, {
    headers: hfToken ? { authorization: `Bearer ${hfToken}` } : {},
    signal: AbortSignal.timeout(120_000),
  });
  if (!videoResponse.ok) throw new Error(`LTX-Video download failed (${videoResponse.status}).`);
  return Buffer.from(await videoResponse.arrayBuffer());
}

function mediaProviderState() {
  return {
    defaults: { image: DEFAULT_IMAGE_PROVIDER, video: DEFAULT_VIDEO_PROVIDER },
    image: IMAGE_PROVIDERS.map((item) => ({
      ...item,
      configured:
        item.id === 'bing'
          ? Boolean(BING_SUPPORTED || bingCookie)
          : item.id === 'cloudflare'
            ? Boolean(cloudflareAccount && cloudflareToken)
            : item.id === 'stock'
              ? true
              : Boolean(hfToken),
    })),
    video: VIDEO_PROVIDERS.map((item) => ({ ...item, configured: true })),
    credentials: {
      bing: Boolean(BING_SUPPORTED || bingCookie),
      cloudflare: Boolean(cloudflareAccount && cloudflareToken),
      huggingface: Boolean(hfToken),
      stock: true,
      imageWorker: imageWorkerConnected(),
    },
    imageWorker: imageWorkerConnected(),
  };
}

async function handleMediaProviders(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
  return sendJson(res, 200, mediaProviderState());
}

async function testCloudflareCredentials() {
  if (!cloudflareAccount || !cloudflareToken) {
    return {
      ok: false,
      error: 'Account ID ya token server tak nahi pahuncha. Settings open karke fields dobara type karein ya Save settings dabayein.',
    };
  }
  try {
    // Actual Workers AI run call — isi se pata chalta hai ki token image bana bhi sakta hai.
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccount)}/ai/run/${CF_IMAGE_MODELS[0]}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cloudflareToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'Nova token test', steps: 1 }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    const data = await response.json().catch(() => ({}));
    const detail = (data.errors || []).map((item) => item.message).filter(Boolean).join('; ');
    if (!response.ok || data.success === false) {
      return {
        ok: false,
        error: `${detail || `Cloudflare API responded ${response.status}.`} — token Workers AI ka hona chahiye (Global API key / Images token nahi). Dashboard → AI → Workers AI → Use REST API se banayein.`,
      };
    }
    return {
      ok: true,
      account: cloudflareAccount,
      message: 'Token sahi hai aur Workers AI se image bhi ban gayi. Ab Imagine use karein.',
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 300) };
  }
}

async function handleMediaCredentials(req, res) {
  let body = {};
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    body = {};
  }
  const kind = String(body.kind || '').trim().toLowerCase();

  if (req.method === 'DELETE' || body.clear === true) {
    if (!kind || kind === 'cloudflare') {
      cloudflareAccount = '';
      cloudflareToken = '';
    }
    if (!kind || kind === 'pollinations') mediaKey = '';
    if (!kind || kind === 'huggingface') hfToken = '';
    if (!kind || kind === 'bing') {
      bingCookie = '';
      await rm(BING_COOKIE_FILE, { force: true }).catch(() => {});
    }
    return sendJson(res, 200, { ok: true, ...mediaProviderState() });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  // Empty values mean "no credential in this tab" — never erase a token synced by another tab.
  if (body.cloudflareAccount) cloudflareAccount = String(body.cloudflareAccount).trim().slice(0, 120);
  if (body.cloudflareToken) cloudflareToken = String(body.cloudflareToken).trim().slice(0, 300);
  if (body.hfToken) hfToken = String(body.hfToken).trim().slice(0, 300);
  if (body.key) mediaKey = String(body.key).trim().slice(0, 300);
  return sendJson(res, 200, { ok: true, ...mediaProviderState() });
}

async function runTool(name, args, root = WORKSPACE) {
  try {
    if (name === 'web_search') {
      const query = String(args.query || '').slice(0, 240);
      if (!query) return 'Error: empty query.';
      const results = await webSearch(query);
      return results.length
        ? results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
        : 'No web results available.';
    }

    if (name === 'list_files') {
      const dir = safeWorkspacePath(args.path || '', root);
      const entries = await readdir(dir, { withFileTypes: true });
      return entries
        .map((entry) => `${entry.isDirectory() ? '[dir] ' : ''}${entry.name}`)
        .join('\n') || '(workspace is empty)';
    }

    if (name === 'read_file') {
      const file = safeWorkspacePath(args.path || '', root);
      const text = await readFile(file, 'utf8');
      return text.slice(0, 60_000);
    }

    if (name === 'write_file') {
      const file = safeWorkspacePath(args.path || 'output.txt', root);
      await mkdir(path.dirname(file), { recursive: true });
      const content = String(args.content ?? '');
      await writeFile(file, content, 'utf8');
      const relative = path.relative(root, file).replace(/\\/g, '/');
      return `Saved ${relative} (${content.length} characters). FILE:${file}`;
    }

    if (name === 'run_code') {
      const code = String(args.code || '').slice(0, 30_000);
      const language = args.language === 'python' ? 'python' : 'js';
      const result = await runCommand(language === 'python' ? 'python' : 'node', [language === 'python' ? '-c' : '-e', code]);
      return [
        result.out ? `STDOUT:\n${result.out}` : '',
        result.err ? `STDERR:\n${result.err}` : '',
        `EXIT: ${result.code}`,
      ].filter(Boolean).join('\n') || '(no output)';
    }

    if (name === 'generate_image') {
      const prompt = String(args.prompt || '').slice(0, 700);
      const model = String(args.model || DEFAULT_IMAGE_MODEL).slice(0, 120);
      const provider = String(args.provider || DEFAULT_IMAGE_PROVIDER).slice(0, 40);
      const seed = Math.floor(Math.random() * 1_000_000);
      return `Image ready: /api/imagine?prompt=${encodeURIComponent(prompt)}&seed=${seed}&width=1024&height=1024&model=${encodeURIComponent(model)}&provider=${encodeURIComponent(provider)}`;
    }

    if (name === 'generate_video') {
      const prompt = String(args.prompt || '').slice(0, 500);
      const provider = String(args.provider || DEFAULT_VIDEO_PROVIDER).slice(0, 40);
      if (provider === 'pollinations') {
        return 'Error: Pollinations video is disabled. Use provider ltx (free, no key) instead.';
      }
      const model = String(args.model || DEFAULT_VIDEO_MODEL).slice(0, 120);
      const duration = Math.min(15, Math.max(2, Number(args.duration) || 5));
      const ratio = args.ratio === '9:16' ? '9:16' : '16:9';
      return `Video ready: /api/video?prompt=${encodeURIComponent(prompt)}&model=${encodeURIComponent(model)}&duration=${duration}&ratio=${ratio}&provider=${encodeURIComponent(provider)}`;
    }

    if (name === 'create_media_job') {
      const job = await createMediaJob({ ...args, chatId: args.chatId });
      return `Video job started: ${job.id}. Status: ${job.status}. Progress updates chat me dikhenge aur PC restart ke baad bhi resume hoga.`;
    }

    if (name === 'create_folder') {
      const dir = safeWorkspacePath(args.path || 'new-folder', root);
      await mkdir(dir, { recursive: true });
      return `Folder ready: ${dir}`;
    }

    if (name === 'delete_file') {
      const file = safeWorkspacePath(args.path || '', root);
      const info = await stat(file);
      if (info.isDirectory()) return 'Error: delete_file only removes files, not folders.';
      await rm(file);
      return `Deleted file: ${path.relative(root, file).replace(/\\/g, '/')}`;
    }

    if (name === 'copy_file' || name === 'move_file') {
      const from = safeWorkspacePath(args.from || '', root);
      const to = safeWorkspacePath(args.to || '', root);
      await mkdir(path.dirname(to), { recursive: true });
      if (name === 'copy_file') await copyFile(from, to);
      else await rename(from, to);
      return `${name === 'copy_file' ? 'Copied' : 'Moved'} ${path.relative(root, from).replace(/\\/g, '/')} → ${path.relative(root, to).replace(/\\/g, '/')}`;
    }

    if (name === 'open_webpage') {
      const raw = String(args.url || '').trim();
      if (!/^https?:\/\/[^\s]+$/i.test(raw)) return 'Error: provide a valid http(s) URL.';
      return `OPEN:${raw}`;
    }

    if (name === 'browser_open') {
      const raw = String(args.url || '').trim();
      if (!/^https?:\/\/[^\s]+$/i.test(raw)) return 'Error: provide a valid http(s) URL.';
      const target = await browserTarget(raw);
      return `Opened ${target.url || raw} in the browser.`;
    }

    if (name === 'browser_wait') {
      const selector = String(args.selector || '').trim();
      if (!selector) return 'Error: selector is required.';
      const timeout = Math.min(30_000, Math.max(1000, Number(args.timeoutMs) || 15_000));
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const found = await pageEvaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
        if (found) return `Found ${selector}.`;
        await sleep(500);
      }
      return `Error: selector not found within ${timeout}ms: ${selector}`;
    }

    if (name === 'browser_click') {
      const selector = String(args.selector || '').trim();
      if (!selector) return 'Error: selector is required.';
      const result = await pageEvaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)}); el.click(); return 'Clicked ' + ${JSON.stringify(selector)}; })()`,
      );
      return String(result);
    }

    if (name === 'browser_type') {
      const text = String(args.text ?? '');
      const selector = String(args.selector || '').trim();
      if (selector) {
        await pageEvaluate(
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)}); el.focus(); return true; })()`,
        );
      }
      const target = await browserTarget();
      await cdpCommand(target.webSocketDebuggerUrl, 'Input.insertText', { text });
      return `Typed ${text.length} characters${selector ? ` into ${selector}` : ''}.`;
    }

    if (name === 'browser_text') {
      const selector = String(args.selector || '').trim();
      const expression = selector
        ? `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.innerText : null; })()`
        : 'document.body.innerText';
      const text = await pageEvaluate(expression);
      return text == null ? 'Element not found.' : String(text).slice(0, 30_000);
    }

    if (name === 'browser_screenshot') {
      const target = await browserTarget();
      const shot = await cdpCommand(target.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
      const file = safeWorkspacePath(args.path || `screenshots/shot-${Date.now()}.png`, root);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(shot.data || '', 'base64'));
      return `Screenshot saved. FILE:${file}`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool error: ${err.message}`;
  }
}

function escapeHtmlText(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function offlineAppTitle(prompt) {
  const cleaned = String(prompt || '')
    .replace(/\b(banao|bnao|bno|banayein|banaye|create|make|build|please|ek|a|the|app|application|website|web site|site|project)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
  const title = words.join(' ') || 'Nova App';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function offlineAppSlug(prompt) {
  const slug = offlineAppTitle(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'nova-app';
}

function offlineAppFiles(title) {
  const safeTitle = escapeHtmlText(title);
  const jsTitle = JSON.stringify(title);
  return {
    'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <p class="eyebrow">Built with Nova</p>
        <h1>${safeTitle}</h1>
      </div>
      <button id="themeBtn" class="ghost" type="button">Theme</button>
    </header>
    <section class="composer">
      <input id="itemInput" type="text" placeholder="Add an item..." maxlength="140" />
      <button id="addBtn" type="button">Add</button>
    </section>
    <section class="tools">
      <input id="searchInput" type="search" placeholder="Search..." />
      <button id="exportBtn" class="ghost" type="button">Export JSON</button>
    </section>
    <ul id="list" class="list"></ul>
    <p id="empty" class="empty">Nothing here yet. Add your first item.</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
    'styles.css': `:root {
  color-scheme: light;
  --bg: #f5f6f8;
  --card: #ffffff;
  --text: #16171a;
  --muted: #6b7078;
  --accent: #6c5ce7;
  --line: #e4e6eb;
}
body.dark {
  color-scheme: dark;
  --bg: #0d0e11;
  --card: #17191e;
  --text: #f2f3f5;
  --muted: #9aa0aa;
  --line: #292c33;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.shell { width: min(720px, calc(100% - 32px)); margin: 48px auto; }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.eyebrow { margin: 0 0 4px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(26px, 5vw, 40px); }
button, input {
  font: inherit;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 14px;
  background: var(--card);
  color: var(--text);
}
button { cursor: pointer; font-weight: 650; }
button:not(.ghost) { border-color: var(--accent); background: var(--accent); color: #fff; }
.ghost { background: transparent; }
.composer, .tools { display: flex; gap: 10px; margin-bottom: 12px; }
.composer input, .tools input { flex: 1; min-width: 0; }
.list { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 8px; }
.list li {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--card);
}
.list li.done span { text-decoration: line-through; color: var(--muted); }
.list span { flex: 1; overflow-wrap: anywhere; }
.list button { padding: 6px 9px; border-radius: 8px; font-size: 12px; }
.empty { color: var(--muted); text-align: center; padding: 24px; }
`,
    'app.js': `const APP_TITLE = ${jsTitle};
const KEY = 'nova-starter-items';
const items = JSON.parse(localStorage.getItem(KEY) || '[]');
const list = document.getElementById('list');
const input = document.getElementById('itemInput');
const search = document.getElementById('searchInput');
const empty = document.getElementById('empty');

function save() {
  localStorage.setItem(KEY, JSON.stringify(items));
  render();
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = items.filter((item) => item.text.toLowerCase().includes(query));
  list.replaceChildren();
  visible.forEach((item) => {
    const li = document.createElement('li');
    li.className = item.done ? 'done' : '';
    const text = document.createElement('span');
    text.textContent = item.text;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = item.done ? 'Undo' : 'Done';
    toggle.onclick = () => { item.done = !item.done; save(); };
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.onclick = () => { items.splice(items.indexOf(item), 1); save(); };
    li.append(text, toggle, del);
    list.append(li);
  });
  empty.hidden = visible.length > 0;
  document.title = APP_TITLE;
}

document.getElementById('addBtn').onclick = () => {
  const text = input.value.trim();
  if (!text) return;
  items.unshift({ text, done: false, ts: Date.now() });
  input.value = '';
  save();
};
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.getElementById('addBtn').click();
});
search.addEventListener('input', render);
document.getElementById('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'items.json';
  link.click();
  URL.revokeObjectURL(link.href);
};
document.getElementById('themeBtn').onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('nova-starter-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};
if (localStorage.getItem('nova-starter-theme') === 'dark') document.body.classList.add('dark');
render();
`,
    'server.js': `import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const name = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log('App running at http://localhost:' + port));
`,
    'package.json': `{
  "name": "nova-starter-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js"
  }
}
`,
    'README.md': `# ${safeTitle}

Nova ne ye starter app offline banaya hai — koi npm install zaroori nahi.

## Chalane ke liye
\`\`\`powershell
cd "${safeTitle}"
node server.js
\`\`\`

Phir browser me kholein: http://localhost:5173

## Files
- \`index.html\` — page structure
- \`styles.css\` — light/dark styling
- \`app.js\` — add/search/complete/delete/export/theme logic
- \`server.js\` — zero-dependency static server
`,
  };
}

async function uniqueScaffoldPath(root, base) {
  let candidate = safeWorkspacePath(base, root);
  for (let index = 2; ; index += 1) {
    try {
      await stat(candidate);
      candidate = safeWorkspacePath(`${base}-${index}`, root);
    } catch {
      return candidate;
    }
  }
}

async function scaffoldOfflineApp(root, prompt) {
  const target = await uniqueScaffoldPath(root, offlineAppSlug(prompt));
  await mkdir(target, { recursive: true });
  const files = offlineAppFiles(offlineAppTitle(prompt));
  for (const [relative, content] of Object.entries(files)) {
    await writeFile(path.join(target, relative), content, 'utf8');
  }
  return target;
}

function codingRequest(text) {
  const value = String(text || '');
  const noun = /\b(code|coding|app|application|website|web\s*site|site|project|software|script|file|folder|bug|fix|debug|api|backend|frontend|component|function|database|db|html|css|javascript|python|node|react|flutter|server|page|ui)\b/i;
  const verb = /\b(ban|bana|bna|bno|bnao|banao|banayein|banaye|likh|likho|create|build|develop|implement|fix|write|do|de)\b/i;
  return noun.test(value) && verb.test(value);
}

function providerFailure(text, status) {
  return /auth|unauthor|forbidden|invalid|key|quota|limit|rate|429|401|403|exhausted|no candidate/i.test(`${status || ''} ${text || ''}`);
}

async function streamOfflineScaffold(res, root, prompt, reason) {
  const target = await scaffoldOfflineApp(root, prompt);
  const files = await readdir(target);
  sse(res, {
    type: 'step',
    label: 'Provider limit/auth fail — offline starter app bana diya…',
  });
  for (const file of files) {
    const full = path.join(target, file);
    sse(res, {
      type: 'file',
      path: path.relative(root, full).replace(/\\/g, '/'),
      url: `/api/file?path=${encodeURIComponent(full)}`,
    });
  }
  const message = `AI provider abhi available nahi hai (${String(reason || 'provider error').slice(0, 180)}). `
    + 'Isliye maine selected coding folder me ek complete offline starter app bana diya hai — index.html, styles.css, app.js, server.js aur README. '
    + 'Files neeche cards me hain; unhe open karke dekh sakte ho. Provider theek hone par dobara bolo to main usi folder me aapki details ke saath badal dunga.';
  for (let index = 0; index < message.length; index += 36) {
    sse(res, { type: 'delta', content: message.slice(index, index + 36) });
  }
  sse(res, { type: 'done' });
  res.end();
}

function agentSystem(modes, customSystem = '', root = WORKSPACE) {
  const toolNames = AGENT_TOOLS.map((tool) => tool.function.name).join(', ');
  return [
    BASE_PERSONA,
    customSystem ? `Additional user instructions: ${customSystem}` : '',
    `Allowed folder for all filesystem tools: ${root}. Never access paths outside it.`,
    `Current date: ${new Date().toISOString().slice(0, 10)}.`,
    'You are an AGENT. Complete the user\'s request end-to-end instead of only explaining how. Use tools whenever the task needs fresh information, files, code execution, or generated images, and keep using them until the task is actually done.',
    'CODE RULE: For any request to create/fix an app, website, code file, script or project, ALWAYS call write_file (and create_folder when needed). Write real complete files into the allowed folder. If the folder is empty, scaffold the whole project. Never only describe or paste code in chat without saving it.',
    'IMAGE RULE: For any image request call generate_image. Prefer provider auto (Bing first, then Cloudflare Flux, then Hugging Face Flux). Never use Pollinations — the user disabled it because of poor quality.',
    'VIDEO RULE: If the user asks for any video — story, cartoon, cinematic, meme/funny, or a video from an MP3 song — call create_media_job, never just describe it. Infer style (cinematic/cartoon/meme/anime/realistic), fx and transitions from the request. Use ratio 9:16 for reels/stories/short-form and 16:9 for normal video. If the user attached an MP3, pass its workspace audioPath. Default video provider is ltx (free open-source); Pollinations is disabled.',
    `Available tools: ${toolNames}.`,
    'You may emit several tool calls across several turns. After tools run, continue automatically. Only give the final Markdown answer when the task is complete; include links to any files or images you created.',
    'IMPORTANT fallback: if native tool calling is not available, put each action on its own line as <tool_call>{"name":"tool_name","arguments":{...}}</tool_call> and nothing else in that turn. After seeing results, continue. Never claim you did something you did not actually do.',
    modes.fun ? 'Personality: witty and playful, but still accurate.' : '',
    modes.search ? 'Prefer web_search for anything time-sensitive or factual.' : '',
    modes.think ? 'Plan carefully before acting and verify the result of each tool call.' : '',
  ].filter(Boolean).join('\n\n');
}

async function agentFetch(url, options, res, step) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, options);
    if (response.status !== 429 || attempt === 2) return response;
    const detail = await response.text().catch(() => '');
    const match = /try again in ([\d.]+)\s*s/i.exec(detail);
    const wait = Math.min(30, Math.max(3, Math.ceil(Number(match?.[1]) || (attempt + 1) * 8)));
    sse(res, { type: 'step', step, label: `Rate limit — ${wait}s baad retry…` });
    await sleep(wait * 1000);
  }
}

async function handleAgent(req, res, key) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const messages = normalizeMessages(payload.messages);
  if (!messages.length) return sendJson(res, 400, { error: 'At least one user message is required.' });

  const modes = {
    think: Boolean(payload.modes?.think),
    search: Boolean(payload.modes?.search),
    fun: Boolean(payload.modes?.fun),
  };
  const model = typeof payload.model === 'string' && payload.model.trim()
    ? payload.model.trim()
    : resolveModel(payload.tier, messages, modes);
  const base = baseUrlFrom(req);
  let root;
  try {
    root = resolveRoot(payload.rootDir);
  } catch (err) {
    return sendJson(res, 403, { error: err.message });
  }
  const conversation = [
    { role: 'system', content: agentSystem(modes, payload.system, root) },
    ...messages,
  ];

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  sse(res, { type: 'meta', model });

  try {
    let nativeTools = true;
    let finalText = '';

    for (let step = 1; step <= 16; step += 1) {
      sse(res, { type: 'step', step, label: step === 1 ? 'Planning…' : `Working (step ${step})…` });

      const requestBody = {
        model,
        stream: false,
        temperature: Number.isFinite(payload.temperature) ? payload.temperature : 0.4,
        max_tokens: 4096,
        messages: conversation,
      };
      if (nativeTools) {
        requestBody.tools = AGENT_TOOLS;
        requestBody.tool_choice = 'auto';
      }

      const response = await agentFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120_000),
      }, res, step);

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        if (nativeTools && /tool|function/i.test(detail)) {
          nativeTools = false;
          continue;
        }
        const message = providerErrorMessage(detail, response.status)
          || `Provider responded with ${response.status}`;
        const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content || '';
        if (payload.rootDir && codingRequest(lastUser) && providerFailure(message, response.status)) {
          return await streamOfflineScaffold(res, root, lastUser, message);
        }
        sse(res, { type: 'error', error: message });
        return res.end();
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message || {};
      const calls = [];

      if (message.tool_calls?.length) {
        for (const call of message.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(call.function?.arguments || '{}');
          } catch { /* keep empty */ }
          calls.push({ id: call.id || `call_${calls.length}`, name: call.function?.name, args });
        }
      } else if (message.content) {
        for (const match of message.content.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g)) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed?.name) calls.push({ id: `call_${calls.length}`, name: parsed.name, args: parsed.arguments || {} });
          } catch { /* ignore malformed actions */ }
        }
      }

      if (calls.length) {
        conversation.push({
          role: 'assistant',
          content: message.content || '',
          ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
        });

        const results = [];
        for (const call of calls) {
          sse(res, { type: 'tool', name: call.name, label: TOOL_LABELS[call.name] || `Using ${call.name}…`, args: call.args });
          const toolArgs =
            call.name === 'create_media_job' && !call.args.chatId && payload.chatId
              ? { ...call.args, chatId: payload.chatId }
              : call.args;
          const result = await runTool(call.name, toolArgs, root);
          results.push(`${call.name}: ${result}`);
          const fileMatch = /FILE:(.+)$/m.exec(result);
          if (fileMatch) {
            const fullPath = fileMatch[1].trim();
            sse(res, {
              type: 'file',
              path: path.relative(root, fullPath).replace(/\\/g, '/'),
              url: `/api/file?path=${encodeURIComponent(fullPath)}`,
            });
          }
          if (result.startsWith('OPEN:')) {
            sse(res, { type: 'open_url', url: result.slice(5).trim() });
          }
          if (call.name === 'generate_image') {
            const match = /(\/api\/imagine\?[^\s]+)/.exec(result);
            if (match) sse(res, { type: 'image', url: match[1] });
          }
          if (call.name === 'create_media_job') {
            const match = /\b(mj_[a-z0-9_]+)\b/i.exec(result);
            const job = match ? mediaJobs.find((item) => item.id === match[1]) : null;
            if (job) sse(res, { type: 'media_job', job });
          }
          if (message.tool_calls) {
            conversation.push({ role: 'tool', tool_call_id: call.id, content: result });
          }
          sse(res, { type: 'tool_result', name: call.name, result: result.slice(0, 1200) });
        }

        if (!message.tool_calls) {
          conversation.push({
            role: 'user',
            content: `TOOL RESULTS:\n${results.join('\n\n')}\n\nContinue the task. When it is complete, give the final answer in Markdown.`,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }

      finalText = String(message.content || '');
      break;
    }

    if (!finalText) {
      sse(res, { type: 'error', error: 'The agent reached its step limit before finishing. Try a smaller request.' });
      return res.end();
    }

    for (let i = 0; i < finalText.length; i += 36) {
      sse(res, { type: 'delta', content: finalText.slice(i, i + 36) });
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    sse(res, { type: 'done' });
    res.end();
  } catch (err) {
    const message = err.message || 'Agent failed';
    const lastUser = [...messages].reverse().find((item) => item.role === 'user')?.content || '';
    if (payload.rootDir && codingRequest(lastUser) && providerFailure(message, 0)) {
      return await streamOfflineScaffold(res, root, lastUser, message);
    }
    sse(res, { type: 'error', error: message });
    res.end();
  }
}

/* ------------------------------- scheduler -------------------------------- */

async function loadJobs() {
  try {
    const data = JSON.parse(await readFile(SCHEDULES_FILE, 'utf8'));
    jobs = Array.isArray(data) ? data : [];
  } catch {
    jobs = [];
  }
}

async function saveJobs() {
  await writeFile(SCHEDULES_FILE, JSON.stringify(jobs, null, 2), 'utf8');
}

async function loadAllowedFolders() {
  try {
    const data = JSON.parse(await readFile(FOLDERS_FILE, 'utf8'));
    allowedFolders = Array.isArray(data) ? data : [];
  } catch {
    allowedFolders = [];
  }
  if (!allowedFolders.includes(WORKSPACE)) allowedFolders.unshift(WORKSPACE);
}

async function saveAllowedFolders() {
  await writeFile(FOLDERS_FILE, JSON.stringify(allowedFolders, null, 2), 'utf8');
}

function resolveRoot(rootDir) {
  if (!rootDir) return WORKSPACE;
  const abs = path.resolve(String(rootDir));
  if (!allowedFolders.includes(abs)) {
    throw new Error('This folder is not allowed yet. Add it from the Bots panel first.');
  }
  return abs;
}

function pathInAllowedFolders(target) {
  return allowedFolders.some((root) => target === root || target.startsWith(root + path.sep));
}

/* ------------------------------- ffmpeg --------------------------------- */

const FFMPEG_OPERATIONS = new Set([
  'trim', 'compress', 'convert', 'mute', 'add-audio', 'extract-audio', 'resize', 'merge',
]);

async function ffmpegExecutable(kind = 'ffmpeg') {
  const candidates = kind === 'ffprobe'
    ? [FFPROBE_BIN, 'ffprobe']
    : [FFMPEG_BIN, 'ffmpeg'];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function ffmpegEncoderSet(bin) {
  if (!ffmpegEncodersCache) {
    const result = await runCommand(bin, ['-hide_banner', '-encoders'], 15_000);
    const text = `${result.out || ''}\n${result.err || ''}`;
    ffmpegEncodersCache = new Set(
      [...text.matchAll(/(?:^|\n)\s*[VAS.]{6}\s+([A-Za-z0-9_-]+)/g)].map((match) => match[1]),
    );
  }
  return ffmpegEncodersCache;
}

async function ffmpegVideoCodecArgs(bin, crf = 23) {
  const encoders = await ffmpegEncoderSet(bin);
  if (encoders.has('libx264')) {
    return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf)];
  }
  if (encoders.has('libopenh264')) {
    return ['-c:v', 'libopenh264', '-b:v', '4M'];
  }
  return ['-c:v', 'mpeg4', '-q:v', '3'];
}

async function ffmpegStatus() {
  const bin = await ffmpegExecutable('ffmpeg');
  if (!bin) return { available: false, version: null, note: 'FFmpeg bundled nahi mila.' };
  if (!ffmpegVersionCache) {
    const result = await runCommand(bin, ['-version'], 8000);
    ffmpegVersionCache = (result.out || result.err || '').split('\n')[0].slice(0, 180) || 'FFmpeg ready';
  }
  return { available: true, version: ffmpegVersionCache };
}

function ffmpegAllowedPath(raw, label) {
  const clean = String(raw || '').trim().replace(/^"|"$/g, '');
  if (!clean) throw new Error(`${label} path required hai.`);
  const abs = path.resolve(clean);
  if (!pathInAllowedFolders(abs)) {
    throw new Error(`${label} allowed folder ke bahar hai. Pehle folder allow karein.`);
  }
  return abs;
}

function ffmpegSafeName(raw, fallback, ext) {
  let name = path.basename(String(raw || fallback))
    .replace(/[^a-zA-Z0-9._ -]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  if (!name) name = fallback;
  if (!path.extname(name)) name += ext;
  return name;
}

async function probeMediaDuration(bin, file) {
  if (!bin) return 0;
  const result = await runCommand(
    bin,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    10_000,
  );
  const seconds = Number(String(result.out || '').trim());
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function sanitizeFfmpegJob(job) {
  const { _concatFile, ...clean } = job;
  return clean;
}

async function updateFfmpegJob(job, patch) {
  Object.assign(job, patch, { updatedAt: Date.now() });
  return sanitizeFfmpegJob(job);
}

async function ffmpegBuildArgs(operation, payload, output) {
  const args = ['-y'];
  const input = ffmpegAllowedPath(payload.input, 'Source file');
  const accurate = payload.accurate !== false;
  const start = Math.max(0, Number(payload.start) || 0);
  const duration = Math.max(0, Number(payload.duration) || 0);
  const end = Math.max(0, Number(payload.end) || 0);
  const span = duration || (end > start ? end - start : 0);
  const crf = Math.min(40, Math.max(18, Number(payload.crf) || 23));
  const width = Math.max(0, Math.min(3840, Number(payload.width) || 0));
  const height = Math.max(0, Math.min(3840, Number(payload.height) || 0));
  const bin = await ffmpegExecutable('ffmpeg');
  const reencode = [
    ...(bin ? await ffmpegVideoCodecArgs(bin, crf) : ['-c:v', 'mpeg4', '-q:v', '3']),
    '-c:a', 'aac', '-b:a', '128k',
  ];

  if (operation === 'trim') {
    if (accurate) args.push('-i', input, '-ss', String(start));
    else args.push('-ss', String(start), '-i', input);
    if (span) args.push('-t', String(span));
    args.push(...(accurate ? reencode : ['-c', 'copy']), '-movflags', '+faststart', output);
  } else if (operation === 'compress' || operation === 'convert') {
    args.push('-i', input, ...reencode, '-movflags', '+faststart', output);
  } else if (operation === 'mute') {
    args.push('-i', input, '-an', '-c:v', 'copy', '-movflags', '+faststart', output);
  } else if (operation === 'add-audio') {
    const audio = ffmpegAllowedPath(payload.audio, 'Audio file');
    args.push(
      '-i', input, '-i', audio,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest',
      '-movflags', '+faststart', output,
    );
  } else if (operation === 'extract-audio') {
    args.push('-i', input, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', output);
  } else if (operation === 'resize') {
    if (!width && !height) throw new Error('Width ya height do mein se kam se kam ek do.');
    const filter = `scale=${width || -2}:${height || -2}`;
    args.push('-i', input, '-vf', filter, ...reencode, '-movflags', '+faststart', output);
  } else if (operation === 'merge') {
    const files = (Array.isArray(payload.inputs) ? payload.inputs : [])
      .map((item) => ffmpegAllowedPath(item, 'Clip'));
    if (files.length < 2) throw new Error('Merge ke liye kam se kam 2 clips chahiye.');
    for (const file of files) await stat(file);
    const listFile = path.join(WORKSPACE, `ffmpeg-concat-${Date.now()}-${randomBytes(3).toString('hex')}.txt`);
    const lines = files.map((file) => `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    await writeFile(listFile, lines.join('\n'), 'utf8');
    payload._concatFile = listFile;
    args.push('-f', 'concat', '-safe', '0', '-i', listFile, ...reencode, '-movflags', '+faststart', output);
  } else {
    throw new Error(`Unknown FFmpeg operation: ${operation}`);
  }
  return args;
}

async function createFfmpegJob(payload = {}) {
  const operation = String(payload.operation || '').trim().toLowerCase();
  if (!FFMPEG_OPERATIONS.has(operation)) throw new Error('Supported editing operation nahi mila.');
  const sourceRaw = operation === 'merge' ? (payload.inputs || [])[0] : payload.input;
  const source = ffmpegAllowedPath(sourceRaw, operation === 'merge' ? 'First clip' : 'Source file');
  await stat(source);
  if (operation === 'add-audio') await stat(ffmpegAllowedPath(payload.audio, 'Audio file'));

  const outputFolder = ffmpegAllowedPath(payload.outputFolder || path.dirname(source), 'Output folder');
  await mkdir(outputFolder, { recursive: true });
  const ext = operation === 'extract-audio' ? '.mp3' : '.mp4';
  const output = path.join(
    outputFolder,
    ffmpegSafeName(payload.outputName, `nova-${operation}-${Date.now()}`, ext),
  );
  const args = await ffmpegBuildArgs(operation, payload, output);
  const probe = await ffmpegExecutable('ffprobe');
  const duration = await probeMediaDuration(probe, source);
  const job = {
    id: `ff_${Date.now()}_${randomBytes(3).toString('hex')}`,
    operation,
    status: 'queued',
    step: 'Job queue me hai…',
    progress: 0,
    error: null,
    duration,
    output,
    outputUrl: `/api/file?path=${encodeURIComponent(output)}`,
    args,
    _concatFile: payload._concatFile || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  ffmpegJobs.unshift(job);
  runFfmpegJob(job).catch(() => {});
  return sanitizeFfmpegJob(job);
}

async function runFfmpegCommand(bin, args, duration, onProgress, jobId) {
  return new Promise((resolve, reject) => {
    const runArgs = args[0] === '-y'
      ? ['-y', '-progress', 'pipe:1', '-nostats', ...args.slice(1)]
      : ['-y', '-progress', 'pipe:1', '-nostats', ...args];
    const child = spawn(bin, runArgs, { cwd: WORKSPACE, windowsHide: true });
    if (jobId) ffmpegChildren.set(jobId, child);
    let stderr = '';
    let lastUpdate = 0;
    const finish = () => {
      if (jobId) ffmpegChildren.delete(jobId);
    };
    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      const micros = /out_time_ms=(\d+)/.exec(text);
      const clock = /out_time=(\d+):(\d+):([\d.]+)/.exec(text);
      let seconds = 0;
      if (micros) seconds = Number(micros[1]) / 1_000_000;
      else if (clock) seconds = Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
      const now = Date.now();
      if (seconds > 0 && duration > 0 && now - lastUpdate > 600) {
        lastUpdate = now;
        onProgress(Math.min(99, Math.round((seconds / duration) * 100)));
      }
    });
    child.stderr?.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on('error', (error) => {
      finish();
      reject(error);
    });
    child.on('close', (code) => {
      finish();
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-500) || 'unknown error'}`));
    });
  });
}

async function runFfmpegJob(job) {
  if (ffmpegRunning.has(job.id)) return;
  ffmpegRunning.add(job.id);
  try {
    if (cancelledJobs.has(job.id)) throw new Error('Editing cancelled.');
    const bin = await ffmpegExecutable('ffmpeg');
    if (!bin) throw new Error('FFmpeg available nahi hai — installer reinstall karein.');
    await updateFfmpegJob(job, { status: 'rendering', step: 'FFmpeg editing chal raha hai…', progress: 1 });
    await runFfmpegCommand(
      bin,
      job.args,
      job.duration,
      (progress) => updateFfmpegJob(job, { progress, step: `Editing… ${progress}%` }),
      job.id,
    );
    const info = await stat(job.output);
    if (!info.size) throw new Error('FFmpeg ne koi output nahi banaya.');
    await updateFfmpegJob(job, { status: 'done', step: 'Ready', progress: 100 });
  } catch (err) {
    await updateFfmpegJob(job, {
      status: 'error',
      error: String(err.message || err).slice(0, 600),
      step: 'Error',
    });
  } finally {
    ffmpegRunning.delete(job.id);
    if (job._concatFile) await rm(job._concatFile, { force: true }).catch(() => {});
  }
}

/* ----------------------- song analysis, TTS, assembly -------------------- */

function resolveJobAudioPath(audioPath) {
  const clean = String(audioPath || '').trim();
  if (!clean) return null;
  const abs = path.isAbsolute(clean) ? path.resolve(clean) : path.resolve(WORKSPACE, clean);
  return pathInAllowedFolders(abs) ? abs : null;
}

async function analyzeSongAudio(inputPath) {
  const bin = await ffmpegExecutable('ffmpeg');
  if (!bin) return { available: false, reason: 'FFmpeg unavailable.' };
  const analysisDir = path.join(WORKSPACE, 'analysis');
  await mkdir(analysisDir, { recursive: true });
  const wavPath = path.join(analysisDir, `audio-${Date.now()}-${randomBytes(3).toString('hex')}.wav`);
  try {
    await runCommand(
      bin,
      ['-y', '-i', inputPath, '-ac', '1', '-ar', '22050', '-f', 'wav', wavPath],
      180_000,
    );
    const buffer = await readFile(wavPath);
    let offset = 12;
    let dataOffset = -1;
    let dataLength = 0;
    let sampleRate = 22050;
    while (offset + 8 <= buffer.length) {
      const id = buffer.toString('ascii', offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      if (id === 'fmt ') sampleRate = buffer.readUInt32LE(offset + 12) || sampleRate;
      if (id === 'data') {
        dataOffset = offset + 8;
        dataLength = Math.min(size, buffer.length - dataOffset);
        break;
      }
      offset += 8 + size + (size % 2);
    }
    if (dataOffset < 0 || dataLength < 4096) throw new Error('Audio decode fail.');

    const frame = 1024;
    const hop = 512;
    const energies = [];
    for (let i = 0; i + frame <= dataLength - (dataLength % 2); i += hop) {
      let sum = 0;
      for (let j = 0; j < frame; j += 1) {
        const sample = buffer.readInt16LE(dataOffset + i + j * 2) / 32768;
        sum += sample * sample;
      }
      energies.push(Math.sqrt(sum / frame));
    }
    if (!energies.length) throw new Error('Audio analysis fail.');

    const duration = dataLength / 2 / sampleRate;
    const flux = energies.map((value, index) => Math.max(0, value - (energies[index - 1] || 0)));
    const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
    const variance = flux.reduce((a, b) => a + (b - mean) ** 2, 0) / flux.length;
    const threshold = mean + Math.sqrt(variance) * 0.8;
    const peaks = [];
    for (let i = 2; i < flux.length - 2 && peaks.length < 400; i += 1) {
      if (flux[i] > threshold && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) {
        const time = ((i * hop) + frame / 2) / sampleRate;
        if (!peaks.length || time - peaks[peaks.length - 1] > 0.22) peaks.push(time);
      }
    }
    const histogram = new Map();
    for (let a = 0; a < peaks.length; a += 1) {
      for (let b = a + 1; b < peaks.length; b += 1) {
        const delta = peaks[b] - peaks[a];
        if (delta < 0.25 || delta > 1.5) continue;
        let bpm = 60 / delta;
        while (bpm < 70) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        const key = Math.round(bpm);
        histogram.set(key, (histogram.get(key) || 0) + 1);
      }
    }
    let bpm = 120;
    let best = 0;
    for (const [key, value] of histogram) {
      if (value > best) {
        best = value;
        bpm = key;
      }
    }

    const zoneCount = Math.min(16, Math.max(6, Math.ceil(duration / 15)));
    const zoneSize = Math.max(1, Math.floor(energies.length / zoneCount));
    const rawZones = [];
    for (let z = 0; z < zoneCount; z += 1) {
      const slice = energies.slice(z * zoneSize, (z + 1) * zoneSize);
      rawZones.push(slice.reduce((a, b) => a + b, 0) / (slice.length || 1));
    }
    const maxEnergy = Math.max(...rawZones, 0.00001);
    const zones = [];
    rawZones.forEach((energy, index) => {
      const level = energy / maxEnergy;
      const label = level > 0.72 ? 'chorus' : level > 0.48 ? 'build' : level > 0.22 ? 'verse' : 'intro';
      const zone = {
        start: Number(((index * duration) / zoneCount).toFixed(2)),
        end: Number((((index + 1) * duration) / zoneCount).toFixed(2)),
        energy: Number(level.toFixed(3)),
        label,
      };
      const last = zones[zones.length - 1];
      if (last && last.label === label) {
        last.end = zone.end;
        last.energy = Number(((last.energy + zone.energy) / 2).toFixed(3));
      } else {
        zones.push(zone);
      }
    });

    return {
      available: true,
      duration: Number(duration.toFixed(2)),
      bpm,
      onsetCount: peaks.length,
      zones,
      suggestedSceneCount: Math.min(60, Math.max(8, Math.round(duration / 12))),
    };
  } finally {
    await rm(wavPath, { force: true }).catch(() => {});
  }
}

async function synthesizeNarration(text, voice, outPath) {
  const scriptPath = path.join(WORKSPACE, `tts-${Date.now()}-${randomBytes(3).toString('hex')}.ps1`);
  const b64 = (value) => Buffer.from(String(value || ''), 'utf8').toString('base64');
  const script = [
    `$Text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(String(text).slice(0, 14_000))}'))`,
    `$Out=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(outPath)}'))`,
    `$Voice=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(voice || '')}'))`,
    'Add-Type -AssemblyName System.Speech',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    'if ($Voice) { try { $synth.SelectVoice($Voice) } catch {} }',
    '$synth.SetOutputToWaveFile($Out)',
    '$synth.Speak($Text)',
    '$synth.Dispose()',
  ].join('\n');
  try {
    await writeFile(scriptPath, script, 'utf8');
    await runCommand(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      180_000,
    );
    const info = await stat(outPath);
    if (info.size < 1000) throw new Error('Voice audio ban nahi paya.');
    return outPath;
  } finally {
    await rm(scriptPath, { force: true }).catch(() => {});
  }
}

async function assembleVideoWithFfmpeg(job, directory, options = {}) {
  const bin = await ffmpegExecutable('ffmpeg');
  if (!bin) throw new Error('FFmpeg available nahi hai — installer reinstall karein.');
  const scenes = (job.scenes || []).filter((scene) => scene.image);
  if (!scenes.length) throw new Error('Video ke liye koi scene image nahi mili.');

  const portrait = job.ratio === '9:16';
  const width = portrait ? 720 : 1280;
  const height = portrait ? 1280 : 720;
  const fps = 24;
  const count = scenes.length;
  const target = Math.min(900, Math.max(5, Number(job.durationSeconds) || count * 5));
  const transition = Math.min(0.8, Math.max(0.3, target / count / 8));
  const perScene = target / count;
  const allowedTransitions = new Set([
    'fade', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleclose', 'circleopen',
  ]);
  const requested = String((job.transitions || [])[0] || 'fade').toLowerCase();
  const transitionName = allowedTransitions.has(requested) ? requested : 'fade';
  const output = path.join(directory, 'final.mp4');

  const args = [];
  for (const scene of scenes) {
    const image = path.resolve(WORKSPACE, String(scene.image).replace(/\\/g, '/'));
    if (!pathInAllowedFolders(image)) throw new Error('Scene image allowed folder ke bahar hai.');
    const inputDuration = scenes.indexOf(scene) < count - 1 ? perScene + transition : perScene;
    args.push('-loop', '1', '-framerate', String(fps), '-t', inputDuration.toFixed(3), '-i', image);
  }

  const audioPath = resolveJobAudioPath(job.audioPath);
  const songIndex = audioPath ? count : null;
  if (audioPath) args.push('-i', audioPath);
  const narrationPath = options.narration || null;
  const voiceIndex = narrationPath ? (songIndex === null ? count : count + 1) : null;
  if (narrationPath) args.push('-i', narrationPath);
  const silenceIndex = songIndex === null && voiceIndex === null ? count : null;
  if (silenceIndex !== null) args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');

  const filters = [];
  for (let index = 0; index < count; index += 1) {
    filters.push(
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,`
      + `crop=${width}:${height},setsar=1,`
      + `zoompan=z='min(pzoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}[v${index}]`,
    );
  }
  let current = 'v0';
  for (let index = 1; index < count; index += 1) {
    const label = `x${index}`;
    filters.push(
      `[${current}][v${index}]xfade=transition=${transitionName}:duration=${transition.toFixed(3)}`
      + `:offset=${(index * perScene).toFixed(3)}[${label}]`,
    );
    current = label;
  }
  filters.push(`[${current}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(target - 0.6).toFixed(3)}:d=0.6[vout]`);

  if (songIndex !== null && voiceIndex !== null) {
    filters.push(
      `[${songIndex}:a]volume=0.62,apad=pad_dur=${target.toFixed(3)}[song];`
      + `[${voiceIndex}:a]volume=1.1,apad=pad_dur=${target.toFixed(3)}[voice];`
      + `[song][voice]amix=inputs=2:duration=first:dropout_transition=1:normalize=0,`
      + `atrim=0:${target.toFixed(3)}[aout]`,
    );
  } else if (songIndex !== null) {
    filters.push(
      `[${songIndex}:a]volume=0.85,apad=pad_dur=${target.toFixed(3)},`
      + `atrim=0:${target.toFixed(3)}[aout]`,
    );
  } else {
    const index = voiceIndex === null ? silenceIndex : voiceIndex;
    filters.push(
      `[${index}:a]volume=1.1,apad=pad_dur=${target.toFixed(3)},`
      + `atrim=0:${target.toFixed(3)}[aout]`,
    );
  }

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-t', target.toFixed(3),
    ...await ffmpegVideoCodecArgs(bin, 23),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    output,
  );

  await updateMediaJob(job, {
    status: 'rendering',
    progress: 75,
    step: `FFmpeg final render — ${count} scenes · ${Math.round(target)}s · ${transitionName}`,
  });
  await runFfmpegCommand(
    bin,
    args,
    target,
    (progress) => updateMediaJob(job, {
      progress: 75 + Math.round(progress * 0.24),
      step: `FFmpeg render… ${progress}%`,
    }),
    job.id,
  );
  const info = await stat(output);
  if (!info.size) throw new Error('Final video ban nahi paya.');
  await updateMediaJob(job, {
    status: 'done',
    progress: 100,
    step: 'Ready',
    output: path.relative(WORKSPACE, output).replace(/\\/g, '/'),
    outputUrl: `/api/file?path=${encodeURIComponent(output)}`,
    error: null,
  });
  return output;
}

function sanitizeSchedule(task) {
  const { key, base, ...rest } = task;
  return {
    ...rest,
    base: base || UPSTREAM_BASE,
    keyHint: key ? `${key.slice(0, 8)}…${key.slice(-4)}` : 'server .env',
  };
}

function applyJobPatch(task, payload) {
  if (typeof payload.enabled === 'boolean') task.enabled = payload.enabled;
  if (typeof payload.name === 'string' && payload.name.trim()) task.name = payload.name.trim().slice(0, 90);
  if (typeof payload.prompt === 'string' && payload.prompt.trim()) task.prompt = payload.prompt.trim();
  if (typeof payload.model === 'string') task.model = payload.model.trim() || undefined;
  if (typeof payload.key === 'string' && payload.key.trim()) task.key = payload.key.trim();
  if (typeof payload.base === 'string' && payload.base.trim()) task.base = payload.base.trim();
  if (['once', 'hourly', 'daily', 'weekly'].includes(payload.repeat)) task.repeat = payload.repeat;
  if (payload.rootDir) task.rootDir = resolveRoot(payload.rootDir);
  if (payload.runAt !== undefined) {
    const value = payload.runAt ? new Date(payload.runAt).getTime() : null;
    task.runAt = Number.isFinite(value) ? value : null;
  }
  task.nextRun = task.enabled ? nextRunFor(task, Date.now() + 1000) : null;
}

function nextRunFor(task, fromMs = Date.now()) {
  if (!task.runAt) return null;
  const start = new Date(task.runAt).getTime();
  if (!Number.isFinite(start)) return null;
  if (task.repeat === 'once') return start;

  const steps = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };
  const step = steps[task.repeat] || steps.daily;
  let next = start;
  let guard = 0;
  while (next <= fromMs && guard < 100_000) {
    next += step;
    guard += 1;
  }
  return next;
}

function parseSseEvents(text) {
  return String(text || '')
    .split('\n\n')
    .map((block) => {
      const line = block.split('\n').find((part) => part.startsWith('data:'));
      if (!line) return null;
      try {
        return JSON.parse(line.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function runSchedule(task) {
  if (runningJobs.has(task.id)) return;
  runningJobs.add(task.id);
  const startedAt = Date.now();

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/agent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': task.key || '',
        'x-upstream-base': task.base || UPSTREAM_BASE,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: task.kind === 'bot' ? 'Start your assigned job now and finish it end-to-end.' : task.prompt,
          },
        ],
        model: task.model || undefined,
        tier: 'auto',
        temperature: 0.3,
        rootDir: task.rootDir || WORKSPACE,
        system:
          task.kind === 'bot'
            ? `You are a dedicated autonomous bot named "${task.name}". Your standing orders:\n${task.prompt}\nWork only inside the allowed folder. Be efficient: use browser_open, browser_text and browser_click; take a screenshot only if visual verification is essential. Report exactly what you did.`
            : `This is an unattended scheduled task named "${task.name}". Complete it and report exactly what you did.`,
        modes: { agent: true, think: false, search: false, fun: false },
      }),
      signal: AbortSignal.timeout(10 * 60_000),
    });

    const events = parseSseEvents(await response.text());
    const rawOutput = events.filter((event) => event.type === 'delta').map((event) => event.content).join('');
    const statusLine = rawOutput
      .split('\n')
      .map((line) => line.replace(/\u00a0/g, ' ').trim())
      .filter(Boolean)
      .reverse()
      .find((line) => /^(Success:|Error at step\b)/i.test(line));
    const output = statusLine || rawOutput;
    const failure = events.find((event) => event.type === 'error')?.error;
    const error = failure || (!response.ok ? providerErrorMessage('', response.status) : null);
    const files = events.filter((event) => event.type === 'file').map((event) => event.path);

    task.lastRun = startedAt;
    task.lastStatus = error ? 'error' : 'ok';
    task.lastOutput = (error || output || 'Finished without output.').slice(0, 2500);
    task.lastFiles = files;
    task.history = [
      { at: startedAt, status: task.lastStatus, output: task.lastOutput, files },
      ...(task.history || []),
    ].slice(0, 8);
  } catch (err) {
    task.lastRun = startedAt;
    task.lastStatus = 'error';
    task.lastOutput = err.message || 'Scheduled run failed';
    task.history = [{ at: startedAt, status: 'error', output: task.lastOutput, files: [] }, ...(task.history || [])].slice(0, 8);
  } finally {
    runningJobs.delete(task.id);
    await saveJobs().catch(() => {});
  }
}

async function scheduleTick() {
  const now = Date.now();
  let changed = false;

  for (const task of jobs) {
    if (!task.enabled || runningJobs.has(task.id)) continue;
    const due = Number.isFinite(task.nextRun) ? task.nextRun : nextRunFor(task, now);
    if (!Number.isFinite(due) || due > now) continue;

    if (task.repeat === 'once') {
      task.enabled = false;
      task.nextRun = due;
    } else {
      task.nextRun = nextRunFor(task, now + 1000);
    }
    changed = true;
    await runSchedule(task);
  }

  if (changed) await saveJobs().catch(() => {});
}

/* --------------------------------- static --------------------------------- */

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = path.join(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  try {
    const data = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch {
    try {
      const shell = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
      res.end(shell);
    } catch {
      sendJson(res, 404, { error: 'Not found' });
    }
  }
}

async function serveWorkspace(req, res, pathname) {
  const rel = decodeURIComponent(pathname.replace(/^\/workspace\/?/, ''));
  let target;
  try {
    target = safeWorkspacePath(rel);
  } catch {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  try {
    const data = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || (ext === '.md' ? 'text/markdown; charset=utf-8' : 'application/octet-stream');
    res.writeHead(200, {
      'content-type': type,
      'content-length': data.length,
      'cache-control': 'no-store',
      'content-disposition': 'inline',
    });
    return res.end(data);
  } catch {
    return sendJson(res, 404, { error: 'File not found in workspace.' });
  }
}

/* --------------------------------- server --------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const key = apiKeyFrom(req);

  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return sendJson(res, 200, {
        hasServerKey: Object.values(serverKeyState()).some(Boolean),
        serverKeys: serverKeyState(),
        liveUrl: LIVE_URL,
        imageWorkerConnected: imageWorkerConnected(),
        tiers: TIERS.map(({ id, label, hint, model }) => ({ id, label, hint, model })),
        defaultTier: 'auto',
        defaultModel: DEFAULT_MODEL,
        systemPrompt: BASE_PERSONA,
        features: {
          search: true,
          imagine: true,
          video: true,
          agent: true,
          workspace: true,
          schedules: true,
          bots: true,
        },
        mediaKeyConfigured: Boolean(mediaKey),
        mediaProviders: mediaProviderState(),
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/models') {
      if (!key) return sendJson(res, 401, { error: 'No API key configured.' });
      try {
        const response = await fetch(`${baseUrlFrom(req)}/models`, {
          headers: { authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(12000),
        });
        const data = await response.json().catch(() => ({}));
        const list = (data.data || [])
          .map((model) => model.id)
          .filter(Boolean)
          .sort();
        if (!response.ok) {
          return sendJson(res, response.status, {
            error: providerErrorMessage(JSON.stringify(data), response.status) || 'Could not list models',
            models: [],
          });
        }
        return sendJson(res, 200, { models: list });
      } catch (err) {
        return sendJson(res, 502, { error: `Could not reach the provider: ${err.message}`, models: [] });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, upstream: UPSTREAM_BASE, model: DEFAULT_MODEL, agent: true });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/workspace/')) {
      return await serveWorkspace(req, res, url.pathname);
    }

    if (req.method === 'GET' && url.pathname === '/api/imagine') {
      return await handleImagine(req, res, url);
    }

    if (req.method === 'GET' && url.pathname === '/api/video') {
      return await handleVideo(req, res, url);
    }

    if (url.pathname === '/api/media-key') {
      return await handleMediaKey(req, res);
    }

    if (url.pathname === '/api/media/test/cloudflare' && req.method === 'POST') {
      return sendJson(res, 200, await testCloudflareCredentials());
    }

    if (url.pathname === '/api/media-credentials') {
      return await handleMediaCredentials(req, res);
    }

    if (req.method === 'POST' && url.pathname === '/api/browser-login') {
      if (!BING_SUPPORTED) {
        return sendJson(res, 400, { error: 'Browser login sirf local Windows PC par chalega.' });
      }
      try {
        const opened = await openBrowserLogin();
        return sendJson(res, 200, { ok: true, opened, profile: BROWSER_PROFILE });
      } catch (err) {
        return sendJson(res, 502, { error: err.message || 'Chrome login tab nahi khul paaya.' });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/sync-bing-login') {
      if (!BING_SUPPORTED) {
        return sendJson(res, 400, { error: 'Bing login sync sirf local Windows PC se chalega.' });
      }
      try {
        const target = await syncBingLoginToLive();
        return sendJson(res, 200, { ok: true, target });
      } catch (err) {
        return sendJson(res, 502, { error: err.message || 'Bing login live par sync nahi hua.' });
      }
    }

    if (url.pathname === '/api/bing-cookie') {
      if (req.method === 'GET') {
        return sendJson(res, 200, {
          configured: Boolean(bingCookie),
          workerConfigured: Boolean(imageWorkerToken),
          workerConnected: imageWorkerConnected(),
        });
      }
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
      try {
        const body = JSON.parse((await readBody(req)) || '{}');
        const cookie = String(body.cookie || '').trim().slice(0, 12_000);
        if (!/_U=[^;]+/.test(cookie)) throw new Error('Bing auth cookie (_U) missing.');
        bingCookie = cookie;
        await writeFile(
          BING_COOKIE_FILE,
          JSON.stringify({ cookie, updatedAt: Date.now() }),
          'utf8',
        ).catch(() => {});
        const workerToken = String(body.workerToken || '').trim().slice(0, 200);
        if (workerToken) {
          if (
            imageWorkerToken &&
            String(body.currentToken || '') !== imageWorkerToken &&
            workerToken !== imageWorkerToken
          ) {
            throw new Error('Worker token mismatch — local PC aur live alag hain.');
          }
          imageWorkerToken = workerToken;
          imageWorkerLastSeen = Date.now();
          await writeFile(
            WORKER_TOKEN_FILE,
            JSON.stringify({ token: workerToken, updatedAt: Date.now() }),
            'utf8',
          ).catch(() => {});
        }
        return sendJson(res, 200, {
          ok: true,
          configured: true,
          workerConfigured: Boolean(imageWorkerToken),
          workerConnected: imageWorkerConnected(),
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Invalid Bing cookie.' });
      }
    }

    if (url.pathname === '/api/image-worker/poll') {
      return await handleImageWorkerPoll(req, res);
    }

    if (url.pathname === '/api/image-worker/result') {
      return await handleImageWorkerResult(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/media-providers') {
      return await handleMediaProviders(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/media-models') {
      return await handleMediaModels(req, res);
    }

    if (req.method === 'GET' && url.pathname === '/api/media-jobs') {
      return sendJson(res, 200, { jobs: mediaJobs });
    }

    if (req.method === 'POST' && url.pathname === '/api/media-jobs') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      try {
        const job = await createMediaJob(payload);
        return sendJson(res, 201, job);
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Could not create media job.' });
      }
    }

    const mediaJobMatch = /^\/api\/media-jobs\/([^/]+)(?:\/(render|error|status))?$/.exec(url.pathname);
    if (mediaJobMatch) {
      const job = mediaJobs.find((item) => item.id === mediaJobMatch[1]);
      if (!job) return sendJson(res, 404, { error: 'Media job not found.' });

      if (req.method === 'GET') return sendJson(res, 200, job);

      if (req.method === 'POST' && mediaJobMatch[2] === 'error') {
        let payload;
        try {
          payload = JSON.parse((await readBody(req)) || '{}');
        } catch {
          payload = {};
        }
        await updateMediaJob(job, {
          status: 'error',
          error: String(payload.error || 'Browser render failed.').slice(0, 600),
          step: 'Error',
        });
        return sendJson(res, 200, job);
      }

      if (req.method === 'POST' && mediaJobMatch[2] === 'status') {
        let payload;
        try {
          payload = JSON.parse((await readBody(req)) || '{}');
        } catch {
          payload = {};
        }
        const status = ['rendering', 'awaiting-render', 'assets'].includes(payload.status) ? payload.status : job.status;
        await updateMediaJob(job, {
          status,
          step: String(payload.step || job.step).slice(0, 300),
          progress: Math.max(0, Math.min(100, Number(payload.progress) || 0)),
        });
        return sendJson(res, 200, job);
      }

      if (req.method === 'DELETE') {
        cancelledJobs.add(job.id);
        ffmpegChildren.get(job.id)?.kill('SIGKILL');
        mediaJobs = mediaJobs.filter((item) => item.id !== job.id);
        await saveMediaJobs();
        setTimeout(() => cancelledJobs.delete(job.id), 60_000).unref?.();
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && mediaJobMatch[2] === 'render') {
        const bytes = await readBinaryBody(req);
        if (!bytes.length) return sendJson(res, 400, { error: 'Empty render.' });
        const directory = path.join(WORKSPACE, 'media-jobs', job.id);
        await mkdir(directory, { recursive: true });
        const extension = String(req.headers['x-media-extension'] || 'webm') === 'mp4' ? 'mp4' : 'webm';
        const file = `final-${Date.now()}.${extension}`;
        await writeFile(path.join(directory, file), bytes);
        await updateMediaJob(job, {
          status: 'done',
          progress: 100,
          step: 'Video ready.',
          output: `media-jobs/${job.id}/${file}`,
          error: null,
        });
        return sendJson(res, 200, job);
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/media-upload') {
      let name = String(req.headers['x-file-name'] || 'audio.mp3');
      try {
        name = decodeURIComponent(name);
      } catch {
        name = 'audio.mp3';
      }
      const bytes = await readBinaryBody(req);
      if (!bytes.length) return sendJson(res, 400, { error: 'Empty file.' });
      const directory = path.join(WORKSPACE, 'uploads');
      await mkdir(directory, { recursive: true });
      const file = `${Date.now()}-${safeFileName(name, 'audio.mp3')}`;
      const absolute = path.join(directory, file);
      await writeFile(absolute, bytes);
      return sendJson(res, 201, {
        path: path.relative(WORKSPACE, absolute).replace(/\\/g, '/'),
        url: webPath(absolute),
        name: safeFileName(name, 'audio.mp3'),
        size: bytes.length,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      if (!key) {
        return sendJson(res, 401, {
          error: 'No API key configured. Add NVIDIA_API_KEY to .env or paste a key in Settings.',
        });
      }
      return await handleChat(req, res, key);
    }

    if (req.method === 'POST' && url.pathname === '/api/agent') {
      if (!key) {
        return sendJson(res, 401, {
          error: 'No API key configured. Add NVIDIA_API_KEY to .env or paste a key in Settings.',
        });
      }
      return await handleAgent(req, res, key);
    }

    if (url.pathname === '/api/schedules' && req.method === 'GET') {
      return sendJson(res, 200, {
        tasks: jobs.filter((job) => job.kind !== 'bot').map(sanitizeSchedule),
        serverTime: Date.now(),
      });
    }

    if (url.pathname === '/api/schedules' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }

      const prompt = String(payload.prompt || '').trim();
      const runAt = new Date(payload.runAt).getTime();
      if (!prompt) return sendJson(res, 400, { error: 'Master prompt is required.' });
      if (!Number.isFinite(runAt)) return sendJson(res, 400, { error: 'Valid date and time are required.' });

      const repeat = ['once', 'hourly', 'daily', 'weekly'].includes(payload.repeat) ? payload.repeat : 'once';
      const task = {
        id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'schedule',
        name: String(payload.name || 'Scheduled task').slice(0, 90),
        workflow: payload.workflow === 'youtube' ? 'youtube' : 'custom',
        prompt,
        runAt,
        nextRun: runAt,
        repeat,
        enabled: payload.enabled !== false,
        key: String(req.headers['x-api-key'] || '').trim() || (process.env.NVIDIA_API_KEY || '').trim(),
        base: baseUrlFrom(req),
        model: String(payload.model || '').trim() || undefined,
        createdAt: Date.now(),
        lastRun: null,
        lastStatus: null,
        lastOutput: '',
        lastFiles: [],
        history: [],
      };

      jobs.unshift(task);
      await saveJobs();
      return sendJson(res, 201, sanitizeSchedule(task));
    }

    const scheduleMatch = /^\/api\/schedules\/([^/]+)(?:\/(run))?$/.exec(url.pathname);
    if (scheduleMatch) {
      const task = jobs.find((item) => item.id === scheduleMatch[1]);
      if (!task) return sendJson(res, 404, { error: 'Scheduled task not found.' });

      if (req.method === 'DELETE') {
        jobs = jobs.filter((item) => item.id !== task.id);
        await saveJobs();
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'PATCH') {
        let payload;
        try {
          payload = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON body.' });
        }
        applyJobPatch(task, payload);
        await saveJobs();
        return sendJson(res, 200, sanitizeSchedule(task));
      }

      if (req.method === 'POST' && scheduleMatch[2] === 'run') {
        await runSchedule(task);
        return sendJson(res, 200, sanitizeSchedule(task));
      }
    }

    if (url.pathname === '/api/folders' && req.method === 'GET') {
      return sendJson(res, 200, { folders: allowedFolders });
    }

    if (url.pathname === '/api/folders' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      const raw = String(payload.path || '').trim();
      if (!raw) return sendJson(res, 400, { error: 'Folder path is required.' });
      const abs = path.resolve(raw.replace(/^"|"$/g, ''));
      try {
        const info = await stat(abs);
        if (!info.isDirectory()) throw new Error('Path is not a folder.');
      } catch (err) {
        return sendJson(res, 400, { error: `Cannot use that folder: ${err.message}` });
      }
      if (!allowedFolders.includes(abs)) {
        allowedFolders.push(abs);
        await saveAllowedFolders();
      }
      return sendJson(res, 200, { folders: allowedFolders, added: abs });
    }

    if (url.pathname === '/api/folders' && req.method === 'DELETE') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        payload = {};
      }
      const abs = path.resolve(String(payload.path || '').replace(/^"|"$/g, ''));
      if (abs === WORKSPACE) {
        return sendJson(res, 400, { error: 'Default workspace cannot be removed.' });
      }
      allowedFolders = allowedFolders.filter((folder) => folder !== abs);
      await saveAllowedFolders();
      return sendJson(res, 200, { folders: allowedFolders, removed: abs });
    }

    if (url.pathname === '/api/ffmpeg/status' && req.method === 'GET') {
      return sendJson(res, 200, await ffmpegStatus());
    }

    if (url.pathname === '/api/ffmpeg/jobs' && req.method === 'GET') {
      return sendJson(res, 200, { jobs: ffmpegJobs.map(sanitizeFfmpegJob) });
    }

    if (url.pathname === '/api/ffmpeg/jobs' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      try {
        return sendJson(res, 200, await createFfmpegJob(payload));
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Could not start FFmpeg job.' });
      }
    }

    const ffmpegJobMatch = /^\/api\/ffmpeg\/jobs\/([^/]+)$/.exec(url.pathname);
    if (ffmpegJobMatch) {
      const job = ffmpegJobs.find((item) => item.id === ffmpegJobMatch[1]);
      if (!job) return sendJson(res, 404, { error: 'FFmpeg job not found.' });
      if (req.method === 'GET') return sendJson(res, 200, sanitizeFfmpegJob(job));
      if (req.method === 'DELETE') {
        cancelledJobs.add(job.id);
        ffmpegChildren.get(job.id)?.kill('SIGKILL');
        const index = ffmpegJobs.indexOf(job);
        if (index !== -1) ffmpegJobs.splice(index, 1);
        setTimeout(() => cancelledJobs.delete(job.id), 60_000).unref?.();
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    if (url.pathname === '/api/file' && req.method === 'GET') {
      const raw = String(url.searchParams.get('path') || '');
      const target = path.resolve(raw);
      if (!raw || !pathInAllowedFolders(target)) {
        return sendJson(res, 403, { error: 'File is outside the allowed folders.' });
      }
      try {
        const data = await readFile(target);
        const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, {
          'content-type': type,
          'content-length': data.length,
          'cache-control': 'no-store',
          'content-disposition': 'inline',
        });
        return res.end(data);
      } catch {
        return sendJson(res, 404, { error: 'File not found.' });
      }
    }

    if (url.pathname === '/api/bots' && req.method === 'GET') {
      return sendJson(res, 200, { bots: jobs.filter((job) => job.kind === 'bot').map(sanitizeSchedule) });
    }

    if (url.pathname === '/api/bots' && req.method === 'POST') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      const prompt = String(payload.prompt || '').trim();
      if (!prompt) return sendJson(res, 400, { error: 'Bot master prompt is required.' });

      let rootDir = WORKSPACE;
      try {
        rootDir = resolveRoot(payload.rootDir);
      } catch (err) {
        return sendJson(res, 403, { error: err.message });
      }

      const repeat = ['once', 'hourly', 'daily', 'weekly'].includes(payload.repeat) ? payload.repeat : 'once';
      const runAt = new Date(payload.runAt).getTime();
      const bot = {
        id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'bot',
        name: String(payload.name || 'My bot').slice(0, 90),
        prompt,
        rootDir,
        runAt: Number.isFinite(runAt) ? runAt : null,
        nextRun: Number.isFinite(runAt) ? runAt : null,
        repeat,
        enabled: payload.enabled !== false,
        key: String(req.headers['x-api-key'] || '').trim() || (process.env.NVIDIA_API_KEY || '').trim(),
        base: baseUrlFrom(req),
        model: String(payload.model || '').trim() || undefined,
        createdAt: Date.now(),
        lastRun: null,
        lastStatus: null,
        lastOutput: '',
        lastFiles: [],
        history: [],
      };
      jobs.unshift(bot);
      await saveJobs();
      return sendJson(res, 201, sanitizeSchedule(bot));
    }

    if (url.pathname === '/api/bots/run-all' && req.method === 'POST') {
      const bots = jobs.filter((job) => job.kind === 'bot' && job.enabled);
      for (const bot of bots) await runSchedule(bot);
      return sendJson(res, 200, { ran: bots.length, bots: jobs.filter((job) => job.kind === 'bot').map(sanitizeSchedule) });
    }

    const botMatch = /^\/api\/bots\/([^/]+)(?:\/(run))?$/.exec(url.pathname);
    if (botMatch) {
      const bot = jobs.find((job) => job.kind === 'bot' && job.id === botMatch[1]);
      if (!bot) return sendJson(res, 404, { error: 'Bot not found.' });

      if (req.method === 'DELETE') {
        jobs = jobs.filter((job) => job.id !== bot.id);
        await saveJobs();
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'PATCH') {
        let payload;
        try {
          payload = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON body.' });
        }
        applyJobPatch(bot, payload);
        await saveJobs();
        return sendJson(res, 200, sanitizeSchedule(bot));
      }

      if (req.method === 'POST' && botMatch[2] === 'run') {
        await runSchedule(bot);
        return sendJson(res, 200, sanitizeSchedule(bot));
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    return await serveStatic(req, res, url.pathname);
  } catch (err) {
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.message || 'Server error' });
    else res.end();
  }
});

await loadJobs();
await loadAllowedFolders();
await loadMediaJobs();
await resumeMediaJobs();
startImageWorker();
setInterval(() => {
  scheduleTick().catch(() => {});
}, 30_000);

server.listen(PORT, () => {
  console.log(`\n  Nova is running  ->  http://localhost:${PORT}`);
  console.log(`  Provider: ${UPSTREAM_BASE}`);
  console.log(`  Model:    ${DEFAULT_MODEL}`);
  console.log(`  Key:      ${(process.env.NVIDIA_API_KEY || '').trim() ? 'loaded from environment' : 'NOT set (paste it in Settings or .env)'}\n`);
});

// Render free tier sleeps after ~15 min idle. Ping our own health endpoint so the
// process keeps seeing traffic and stays awake — no GitHub Actions token needed.
const RENDER_URL = String(process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL || '').replace(/\/+$/, '');
if (RENDER_URL) {
  const keepAwake = async () => {
    try {
      await fetch(`${RENDER_URL}/api/health`, { signal: AbortSignal.timeout(20_000) });
    } catch {
      /* transient network issue — next ping will retry */
    }
  };
  setTimeout(keepAwake, 10_000);
  setInterval(keepAwake, 4 * 60_000);
  console.log(`  Keep-awake: enabled -> ${RENDER_URL}/api/health\n`);
}
