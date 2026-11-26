import http from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import tls from 'node:tls';
import { openSync, closeSync } from 'node:fs';
import { readFile, readdir, writeFile, mkdir, stat, rm, copyFile, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORKSPACE = path.join(__dirname, 'workspace');
const SCHEDULES_FILE = path.join(WORKSPACE, 'schedules.json');
const FOLDERS_FILE = path.join(WORKSPACE, 'allowed-folders.json');
const MEDIA_JOBS_FILE = path.join(WORKSPACE, 'media-jobs.json');
const MEMORY_FILE = path.join(WORKSPACE, 'memory.md');
const MEMORY_TEMPLATE = `# Nova Working Memory

Ye file har naye chat aur model change ke baad bhi padhi jaati hai. Yahan sirf wahi likho jo aage kaam chalu rakhne ke liye zaroori ho.

## Current goal
- (Abhi ka target likho.)

## Decisions
- (Facts jo baar baar nahi samjhane chahiye.)

## Next steps
- (Resume point.)

## Active jobs
- (Server khud yahan status nahi likhta; active video jobs system prompt me alag se dikhte hain.)
`;
const FFMPEG_BIN = process.env.FFMPEG_PATH
  || path.join(__dirname, 'runtime', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const FFPROBE_BIN = process.env.FFPROBE_PATH
  || path.join(__dirname, 'runtime', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
await mkdir(WORKSPACE, { recursive: true });
try {
  await access(MEMORY_FILE);
} catch {
  await writeFile(MEMORY_FILE, MEMORY_TEMPLATE, 'utf8');
}

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
const mediaTtsCredentials = new Map();
const agentAppProcesses = new Map();

const PORT = Number(process.env.PORT || 4173);
const UPSTREAM_BASE = (process.env.UPSTREAM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'minimaxai/minimax-m3.1-flash';
const DEFAULT_IMAGE_MODEL = process.env.DEFAULT_IMAGE_MODEL || 'flux';
const DEFAULT_VIDEO_MODEL = process.env.DEFAULT_VIDEO_MODEL || 'kwaivgi/kling-v4.0-flash';
let mediaKey = (process.env.POLLINATIONS_API_KEY || '').trim();
let cloudflareAccount = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
let cloudflareToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
let hfToken = (process.env.HF_TOKEN || '').trim();
let geminiToken = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
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

function parseByteRange(header, size) {
  if (!header) return { start: 0, end: Math.max(0, size - 1), total: size };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix < 1) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1), total: size };
}

async function sendFileBytes(req, res, target, type, options = {}) {
  const data = await readFile(target);
  const range = parseByteRange(req.headers.range, data.length);
  if (!range && req.headers.range) {
    res.writeHead(416, {
      'content-type': 'application/json; charset=utf-8',
      'content-range': `bytes */${data.length}`,
      'accept-ranges': 'bytes',
    });
    return res.end(JSON.stringify({ error: 'Invalid byte range.' }));
  }
  const partial = Boolean(range && req.headers.range);
  const headers = {
    'content-type': type,
    'content-length': partial ? range.end - range.start + 1 : data.length,
    'accept-ranges': 'bytes',
    'cache-control': options.cacheControl || 'no-store',
    'content-disposition': 'inline',
  };
  if (partial) headers['content-range'] = `bytes ${range.start}-${range.end}/${range.total}`;
  res.writeHead(partial ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  return res.end(partial ? data.subarray(range.start, range.end + 1) : data);
}

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

async function readWorkingMemory() {
  try {
    return (await readFile(MEMORY_FILE, 'utf8')).slice(0, 20_000);
  } catch {
    return '';
  }
}

async function writeWorkingMemory(text) {
  const value = String(text ?? '').slice(0, 30_000);
  await writeFile(MEMORY_FILE, value, 'utf8');
  return value;
}

async function activeVideoJobsSummary() {
  try {
    const parsed = JSON.parse(await readFile(MEDIA_JOBS_FILE, 'utf8'));
    const statuses = new Set(['queued', 'assets', 'rendering', 'awaiting-render']);
    return (Array.isArray(parsed) ? parsed : [])
      .filter((job) => statuses.has(job?.status))
      .slice(-8)
      .map((job) => `- ${job.id}: ${job.status} ${job.progress || 0}% — ${job.step || 'no step'} | ${job.durationSeconds || 0}s · ${job.sceneCount || 0} scenes | video=${job.video || '-'}`);
  } catch {
    return [];
  }
}

async function memoryContext() {
  const notes = (await readWorkingMemory()).trim();
  const active = await activeVideoJobsSummary();
  const chunks = [
    'WORKING MEMORY (persistent — model ya naya chat badalne par bhi yahi padha jata hai):',
    notes || '(empty)',
  ];
  if (active.length) {
    chunks.push(`ACTIVE VIDEO JOBS (app restart par auto resume):\n${active.join('\n')}`);
  }
  return chunks.join('\n\n');
}

async function buildSystem(modes, results) {
  const chunks = [BASE_PERSONA, `Current date: ${new Date().toISOString().slice(0, 10)}.`, await memoryContext()];

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

  const builtSystem = await buildSystem(modes, results);
  const system = typeof payload.system === 'string' && payload.system.trim()
    ? `${payload.system.trim()}\n\n${builtSystem}`
    : builtSystem;

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

function cleanStoryCell(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\*+/g, '')
    .replace(/[“”"]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Poori video me yahi chehra/banaav rahe — har scene ke image prompt me yahi lock dobara lagta hai.
function extractCharacterBible(text) {
  const line = String(text || '')
    .split(/\r?\n/)
    .find((item) => !/^\s*\|/.test(item)
      && /(?:CHARACTER\s+LOCK|CHILD\s+LOCK|MAIN\s+CAST|मुख्य\s+पात्र|पात्र\s+लॉक|किरदार\s+लॉक)/i.test(item));
  if (!line) return '';
  const colon = line.indexOf(':');
  const value = colon >= 0 ? line.slice(colon + 1) : line;
  return cleanStoryCell(value).slice(0, 600);
}

function withCharacterBible(prompt, bible) {
  const text = String(prompt || '').trim();
  if (!bible || !text) return text;
  if (text.toLowerCase().includes(bible.toLowerCase())) return text;
  const joiner = /[.!?।]$/.test(bible) ? ' ' : '. ';
  return `${bible}${joiner}${text}`;
}

function collectDurationSeconds(text) {
  let max = 0;
  const candidates = [
    /(\d+(?:\.\d+)?)\s*(?:min|mins|minute|minutes|मिनट|मिंट|मिनटों)/gi,
    /(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds|सेकंड|सेंकड)/gi,
  ];
  for (const pattern of candidates) {
    for (const match of String(text || '').matchAll(pattern)) {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) continue;
      const seconds = pattern.source.includes('min') ? value * 60 : value;
      max = Math.max(max, Math.round(seconds));
    }
  }
  return max;
}

function parseStoryboard(prompt) {
  const text = String(prompt || '');
  const result = {
    durationSeconds: 0,
    sceneCount: 0,
    narrationLines: [],
    imagePrompts: [],
    titles: [],
    sceneStarts: [],
    sceneEnds: [],
    characterBible: extractCharacterBible(text),
  };
  // "1 minute" paragraph ya "6 minutes" heading — sabme se longest total maanga jaata hai.
  result.durationSeconds = collectDurationSeconds(text);

  const rows = text.split(/\r?\n/).filter((line) => /^\s*\|/.test(line));
  const scenes = [];
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4 || !/^\d+$/.test(cells[0])) continue;
    const time = cells[1] || '';
    const range = /(\d+(?:\.\d+)?)\s*(?:-|‑|–|—|to)\s*(\d+(?:\.\d+)?)/i.exec(time);
    const single = /(\d+(?:\.\d+)?)/.exec(time);
    scenes.push({
      time,
      start: range ? Number(range[1]) : (single ? Number(single[1]) : null),
      end: range ? Number(range[2]) : null,
      title: cleanStoryCell(cells[2]),
      summary: cleanStoryCell(cells[3]),
      dialogue: cells.length >= 6 ? cleanStoryCell(cells[4]) : '',
      image: cleanStoryCell(cells[cells.length - 1]),
    });
  }
  if (scenes.length >= 2) {
    result.sceneCount = scenes.length;
    result.titles = scenes.map((item) => item.title).filter(Boolean);
    result.narrationLines = scenes.map((item) => {
      const speech = item.dialogue.replace(/[^.।!?\n]{1,24}:\s*/g, '').trim();
      // Hindi image description bhi story me shamil karo taaki har scene ki awaaz poori 30s bhare.
      const visual = /[\u0900-\u097F]/.test(item.image) ? item.image : '';
      return [item.summary, speech, visual].filter(Boolean).join('. ').replace(/\s+/g, ' ').trim();
    });
    result.imagePrompts = scenes.map((item) => item.image || item.summary || item.title).filter(Boolean);
    let maxEnd = 0;
    for (const item of scenes) {
      if (item.end !== null) maxEnd = Math.max(maxEnd, item.end);
      else if (item.start !== null) maxEnd = Math.max(maxEnd, item.start);
    }
    if (maxEnd > 0) result.durationSeconds = Math.max(result.durationSeconds, Math.round(maxEnd));
    const fallbackStep = (result.durationSeconds || scenes.length * 30) / scenes.length;
    result.sceneStarts = scenes.map((item, index) => Number.isFinite(item.start) ? item.start : index * fallbackStep);
    result.sceneEnds = scenes.map((item, index) => Number.isFinite(item.end)
      ? item.end
      : ((result.sceneStarts[index + 1] ?? result.durationSeconds) || (index + 1) * fallbackStep));
  }

  const numbered = [...text.matchAll(/^\s*\d+[.)]\s*\*\*[^*]+\*\*\s*(?:[–‑—-]|:)\s*[“"]?([^”"\n]+)[”"]?/gm)]
    .map((match) => cleanStoryCell(match[1]))
    .filter(Boolean);
  if (numbered.length >= 2 && numbered.length >= result.imagePrompts.length) {
    // “इमेज-प्रॉम्प्ट – उपयोग के लिये” list AI image generation ke liye best hai.
    result.imagePrompts = numbered;
    result.sceneCount = Math.max(result.sceneCount, numbered.length);
  }
  const explicitScenes = /(\d+)\s*(?:scenes|scene|दृश्य|दृश्यों)/i.exec(text);
  if (explicitScenes && !result.sceneCount) result.sceneCount = Number(explicitScenes[1]);
  if (result.characterBible) {
    result.imagePrompts = result.imagePrompts.map((prompt) => withCharacterBible(prompt, result.characterBible));
  }
  return result;
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

async function generateStoryScriptWithModel(job, creds, baseCaptions) {
  const key = String(creds?.key || '').trim();
  if (!key) throw new Error('Story model key unavailable.');
  const base = String(creds?.baseUrl || UPSTREAM_BASE).replace(/\/+$/, '');
  const count = Math.max(1, Number(job.sceneCount) || 6);
  const prompt = String(job.prompt || '').trim();
  const duration = Math.max(10, Number(job.durationSeconds) || 60);
  const model = String(process.env.STORY_MODEL || DEFAULT_MODEL || '').trim();
  const secondsPerScene = Math.max(5, Math.round(duration / count));
  const targetWords = Math.max(35, Math.min(120, Math.round(secondsPerScene * 2.4)));
  const system = [
    'You are a master short-film screenwriter and narrator.',
    `Write an original cinematic story for a ${duration}-second video, split into exactly ${count} scenes.`,
    'Return ONLY a JSON array of exactly N strings, one spoken narration line per scene.',
    `Each line must be about ${targetWords} words so natural speech fills its ${secondsPerScene}-second scene without speeding up or slowing down. Vivid, natural to speak, emotionally engaging, with hook, buildup, turn and payoff.`,
    'If the user named main characters, describe them with exactly the same appearance words in every line where they appear.',
    'Write in the same language/style as the user idea. Never copy the prompt word-for-word and never add headings, numbers or stage directions.',
  ].join('\n');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.9,
      max_tokens: Math.min(8000, Math.max(1200, count * 160)),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `User idea: ${prompt}\n\nGenerate the ${count} narration lines now.` },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Story model failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const raw = typeof content === 'string' ? content : JSON.stringify(content || '');
  let lines = [];
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed)) {
        lines = parsed.map((item) => String(typeof item === 'string' ? item : item?.text || item?.line || '').trim()).filter(Boolean);
      }
    } catch { /* try plain lines below */ }
  }
  if (!lines.length) {
    lines = raw.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').replace(/^["']|["']$/g, '').trim()).filter(Boolean);
  }
  lines = lines.slice(0, count).map((line) => String(line).replace(/\s+/g, ' ').trim());
  while (lines.length < count) {
    lines.push(String(baseCaptions[lines.length] || prompt || `Scene ${lines.length + 1}`).replace(/\s+/g, ' ').trim());
  }
  if (!lines.some(Boolean)) throw new Error('Story model ne koi script nahi di.');
  return lines.map((line, index) => line || baseCaptions[index] || `Scene ${index + 1}`);
}

function fallbackImagePrompts(job, captions) {
  const bible = String(job.characterBible || '').trim();
  return captions.map((line) => withCharacterBible(
    `${String(line || '').trim()} ${job.style ? `${job.style} style, ` : ''}single coherent scene, one illustration, no collage, no panels, no text.`,
    bible,
  ));
}

async function generateImagePromptsWithModel(job, captions, creds) {
  const key = String(creds?.key || '').trim();
  if (!key) throw new Error('Image-prompt model key unavailable.');
  const base = String(creds?.baseUrl || UPSTREAM_BASE).replace(/\/+$/, '');
  const model = String(process.env.STORYBOARD_MODEL || process.env.STORY_MODEL || DEFAULT_MODEL || '').trim();
  const lines = captions.map((line) => String(line || '').trim()).filter(Boolean);
  if (!lines.length) throw new Error('Image prompts ke liye story lines nahi mili.');
  const count = lines.length;
  const story = lines.map((line, index) => `Scene ${index + 1}: ${line}`).join('\n');
  const knownBible = String(job.characterBible || '').trim();
  const system = [
    'You are a film storyboard artist. Read the complete story below carefully before writing anything.',
    `Create exactly ${count} image prompts, one per scene, in the same order as the story.`,
    'Return ONLY valid JSON in this shape: {"characterBible":"...","imagePrompts":["..."]}.',
    'characterBible: one English paragraph describing the recurring main characters with exact age, face, hair, clothes and body proportions. State that they must look identical in every image and must never change age.',
    'Each image prompt: 35-60 English words, cinematic composition, exact setting/action/emotion of that scene, one coherent illustration, no collage, no split panels, no text, no watermark.',
    'Every prompt that shows a recurring character must repeat the same identity words from characterBible.',
    'Do not add, skip, reorder or merge scenes. One story line equals one image.',
  ].join('\n');
  const user = [
    knownBible ? `Existing character lock: ${knownBible}` : '',
    `User idea: ${String(job.prompt || '').slice(0, 4000)}`,
    `FULL STORY (${count} scenes):\n${story}`,
    `Return exactly ${count} image prompts now.`,
  ].filter(Boolean).join('\n\n');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.35,
      max_tokens: Math.min(8000, Math.max(1200, count * 140)),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Image-prompt model failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const raw = typeof content === 'string' ? content : JSON.stringify(content || '');
  let parsed = null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { parsed = null; }
  }
  if (!parsed) {
    const arrayStart = raw.indexOf('[');
    const arrayEnd = raw.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try { parsed = { imagePrompts: JSON.parse(raw.slice(arrayStart, arrayEnd + 1)) }; } catch { parsed = null; }
    }
  }
  const rawPrompts = parsed?.imagePrompts || parsed?.prompts || parsed?.images || [];
  const prompts = Array.isArray(rawPrompts)
    ? rawPrompts.map((item) => String(typeof item === 'string' ? item : item?.prompt || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
  if (!prompts.length) throw new Error('Model ne image prompts nahi diye.');
  const characterBible = String(parsed?.characterBible || knownBible || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  const filled = Array.from({ length: count }, (_, index) => prompts[index] || fallbackImagePrompts(job, [lines[index]])[0])
    .map((prompt) => withCharacterBible(prompt, characterBible));
  return { characterBible, imagePrompts: filled };
}

// Ek narration line me kai visual beats ho sakte hain — bell, ringing, darshan.
function splitLineVisualParts(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const sentences = text.split(/[।.!?;]+\s*/).map((part) => part.trim()).filter(Boolean);
  const parts = [];
  for (const sentence of sentences) {
    const pieces = sentence.split(/\s+(?:और\s+फिर|और|तथा|फिर|and\s+then|then|and)\s+/i).map((part) => part.trim()).filter(Boolean);
    if (pieces.length > 1 && pieces.every((part) => part.split(/\s+/).filter(Boolean).length >= 4)) {
      parts.push(...pieces);
    } else {
      parts.push(sentence);
    }
  }
  if (parts.length <= 1) return [text];
  if (parts.length > 3) return [parts[0], parts[1], parts.slice(2).join(' ')];
  return parts;
}

function fallbackLineImagePrompts(job, line, basePrompt = '') {
  const bible = String(job.characterBible || '').trim();
  const parts = splitLineVisualParts(line);
  const context = String(basePrompt || '').trim();
  const movieLook = job.type === 'song' || job.style === 'cinematic'
    ? 'cinematic film still, dramatic movie lighting, 35mm film look, wide establishing shot, depth of field, '
    : '';
  return parts.slice(0, 3).map((part) => withCharacterBible(
    `${part}. ${context ? `Story context: ${context.slice(0, 220)}. ` : ''}${movieLook}${job.style ? `${job.style} style, ` : ''}single coherent scene, one cinematic frame, no collage, no panels, no text.`,
    bible,
  ));
}

async function generateVisualBeatsWithModel(job, captions, creds) {
  const key = String(creds?.key || '').trim();
  if (!key) throw new Error('Visual storyboard model key unavailable.');
  const base = String(creds?.baseUrl || UPSTREAM_BASE).replace(/\/+$/, '');
  const model = String(process.env.STORYBOARD_MODEL || process.env.STORY_MODEL || DEFAULT_MODEL || '').trim();
  const lines = captions.map((line) => String(line || '').trim()).filter(Boolean);
  if (!lines.length) throw new Error('Visual storyboard ke liye story lines nahi mili.');
  const count = lines.length;
  const story = lines.map((line, index) => `Line ${index + 1}: ${line}`).join('\n');
  const knownBible = String(job.characterBible || '').trim();
  const hints = Array.isArray(job.imagePrompts) && job.imagePrompts.length === count
    ? job.imagePrompts.map((prompt, index) => `${index + 1}. ${prompt}`).join('\n')
    : '';
  const system = [
    'You are a film storyboard director. Read the complete story below before writing anything.',
    `There are exactly ${count} narration lines. For each line, create 1, 2 or 3 image prompts.`,
    'Use 2 or 3 images only when that line clearly contains multiple distinct visual events, objects or actions. A single event gets exactly 1 image.',
    'Example: "A big bell hangs near the temple entrance. Devotees ring it before entering, then see the deity." => 3 images: the bell at the entrance, devotees ringing it, and the devotee receiving darshan inside.',
    'Each image prompt: 25-55 English words, exactly one coherent scene, matching the exact subject/action/emotion of that part of the line. Add shot language: wide establishing shot, medium shot or close-up detail, plus lighting, mood and lens feel. For cinematic/song videos it must read like a 35mm film still, never a poster or collage. Never split panel, text or watermark.',
    'Every recurring character must keep the exact same age, face, hair, clothes and body proportions in every prompt.',
    'Return ONLY valid JSON: {"characterBible":"...","lineImages":[{"line":1,"images":["prompt 1","prompt 2"]}]}',
    'lineImages must contain exactly one entry per narration line, in order. Do not add, skip, reorder or merge lines.',
  ].join('\n');
  const user = [
    knownBible ? `Existing character lock: ${knownBible}` : '',
    hints ? `One-image hints already supplied by the user:\n${hints}` : '',
    `User idea: ${String(job.prompt || '').slice(0, 4000)}`,
    `FULL STORY (${count} lines):\n${story}`,
    `Return exactly ${count} line entries now.`,
  ].filter(Boolean).join('\n\n');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.35,
      max_tokens: Math.min(10_000, Math.max(1600, count * 260)),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Visual storyboard model failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const raw = typeof content === 'string' ? content : JSON.stringify(content || '');
  let parsed = null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { parsed = null; }
  }
  const rawLines = parsed?.lineImages || parsed?.lines || parsed?.scenes || [];
  if (!Array.isArray(rawLines)) throw new Error('Model ne line-wise image plan nahi diya.');
  const lineImages = lines.map((line, index) => {
    const entry = rawLines[index];
    const rawPrompts = Array.isArray(entry)
      ? entry
      : (entry?.images || entry?.prompts || entry?.imagePrompts || (entry?.prompt ? [entry.prompt] : []));
    const prompts = Array.isArray(rawPrompts)
      ? rawPrompts.map((item) => String(typeof item === 'string' ? item : item?.prompt || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 3)
      : [];
    return prompts.length ? prompts : fallbackLineImagePrompts(job, line, job.imagePrompts?.[index]);
  });
  if (!lineImages.some((images) => images.length)) throw new Error('Model ne koi visual image prompt nahi diya.');
  const characterBible = String(parsed?.characterBible || knownBible || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  return {
    characterBible,
    lineImages: lineImages.map((images) => images.map((prompt) => withCharacterBible(prompt, characterBible))),
  };
}

function withVisualBeatLock(job, beat) {
  return {
    lineIndex: Number(beat?.lineIndex) || 0,
    prompt: withCharacterBible(String(beat?.prompt || ''), job.characterBible),
    start: Number(beat?.start) || 0,
    end: Number(beat?.end) || 0,
  };
}

function buildVisualBeats(job, captions, lineImages) {
  const target = Math.min(900, Math.max(5, Number(job.durationSeconds) || captions.length * 30));
  const starts = Array.isArray(job.storyboardStarts) && job.storyboardStarts.length === captions.length
    ? job.storyboardStarts
    : captions.map((_, index) => (index * target) / captions.length);
  const ends = Array.isArray(job.storyboardEnds) && job.storyboardEnds.length === captions.length
    ? job.storyboardEnds
    : captions.map((_, index) => ((index + 1) * target) / captions.length);
  const beats = [];
  for (let lineIndex = 0; lineIndex < captions.length; lineIndex += 1) {
    const prompts = Array.isArray(lineImages[lineIndex]) && lineImages[lineIndex].length
      ? lineImages[lineIndex].slice(0, 3)
      : fallbackLineImagePrompts(job, captions[lineIndex], job.imagePrompts?.[lineIndex]);
    const lineStart = Number.isFinite(Number(starts[lineIndex])) ? Number(starts[lineIndex]) : (lineIndex * target) / captions.length;
    const lineEnd = Number.isFinite(Number(ends[lineIndex])) && Number(ends[lineIndex]) > lineStart
      ? Number(ends[lineIndex])
      : ((lineIndex + 1) * target) / captions.length;
    const span = Math.max(1, lineEnd - lineStart);
    // Image ka time uske bolne wale clause ki lambai ke hisaab se — lambi line ko zyada time.
    const clauseParts = splitLineVisualParts(captions[lineIndex]);
    const weights = prompts.map((_, part) => {
      if (clauseParts.length !== prompts.length) return 1;
      return Math.max(1, String(clauseParts[part] || '').split(/\s+/).filter(Boolean).length);
    });
    const totalWeight = weights.reduce((sum, value) => sum + value, 0) || prompts.length;
    let cursor = lineStart;
    for (let part = 0; part < prompts.length; part += 1) {
      const beatEnd = part === prompts.length - 1
        ? lineEnd
        : cursor + (span * weights[part]) / totalWeight;
      beats.push({
        lineIndex,
        prompt: withCharacterBible(prompts[part], job.characterBible),
        start: Number(cursor.toFixed(3)),
        end: Number(beatEnd.toFixed(3)),
      });
      cursor = beatEnd;
    }
  }
  return beats;
}

function buildStoryScript(job, baseCaptions) {
  const count = job.sceneCount;
  const prompt = String(job.prompt || '').trim();
  const beats = [
    'Hook', 'Setup', 'Build-up', 'First turn', 'Rising tension',
    'Twist', 'Climax', 'Reveal', 'Payoff', 'Resolution',
  ];
  const themes = prompt.split(/[.!?।]+\s*|\n+/).map((item) => item.trim()).filter(Boolean);
  const motif = (themes[0] || prompt || 'the story').replace(/^(a|an|the)\s+/i, '');
  const zones = job.analysis?.zones || [];
  return Array.from({ length: count }, (_, index) => {
    const beat = beats[index % beats.length];
    const detail = String(baseCaptions[index] || motif).trim();
    const zone = zones.length
      ? zones[Math.min(zones.length - 1, Math.floor((index / count) * zones.length))]?.label
      : '';
    const tail = zone ? `, ${String(zone).toLowerCase()}` : '';
    const lines = [
      `${beat}: ${detail} comes alive${tail}.`,
      `The camera moves closer as ${detail} takes shape${tail}.`,
      `Every beat pushes the story forward — ${detail}${tail}.`,
      `Then the mood shifts${tail}: ${detail}.`,
    ];
    return lines[index % lines.length];
  });
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
  // Har progress tick + har scene par autosave — app band ho jaye to wahin se resume.
  Object.assign(job, patch, { autosaveAt: Date.now(), updatedAt: Date.now() });
  await saveMediaJobs().catch(() => {});
}

function cleanStockQuery(prompt, maxWords = 4) {
  const stop = new Set([
    'cartoon', 'style', 'illustration', 'single', 'coherent', 'scene', 'one', 'no', 'collage',
    'panels', 'text', 'high', 'detail', 'cinematic', 'composition', 'bright', 'colorful',
    'vibrant', 'background', 'with', 'and', 'the', 'for', 'from', 'into', 'that',
    'this', 'small', 'tiny', 'large', 'young', 'age', 'holding', 'standing', 'walking',
    'smiling', 'looking', 'warm', 'soft', 'glowing', 'magic', 'magical', 'effect', 'softly',
    'friendly', 'animated', 'all', '4k', 'hook', 'setup', 'twist', 'climax', 'reveal',
    'payoff', 'takeaway',
  ]);
  const words = String(prompt || '')
    .toLowerCase()
    .replace(/scene\s+\d+\s*:/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word));
  const unique = [];
  for (const word of words) {
    if (!unique.includes(word)) unique.push(word);
  }
  return unique.slice(0, Math.max(1, Math.min(6, maxWords))).join(' ') || 'cartoon';
}

function pickStockImages(images, wanted, prompt) {
  if (!images.length) return [];
  const span = Math.max(1, images.length - wanted + 1);
  const hash = createHash('sha1').update(String(prompt || '')).digest();
  const offset = hash.readUInt32LE(0) % span;
  return images.slice(offset, offset + wanted);
}

async function generateStockImages(prompt, count = 1) {
  const wanted = Math.min(20, Math.max(1, Number(count) || 1));
  const queries = [...new Set([4, 2, 1].map((size) => cleanStockQuery(prompt, size)))];
  let lastError = null;
  for (const query of queries) {
    const cacheKey = `${query}|${wanted}`;
    const cached = stockImageCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 10 * 60_000) return pickStockImages(cached.images, wanted, prompt);

    const searchUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}`
      + `&license=cc0,pdm&page_size=${Math.max(4, wanted)}&mature=false`;
    try {
      const response = await fetch(searchUrl, {
        headers: { 'user-agent': 'Nova-AI/1.0 (copyright-free video images)' },
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = new Error(data.detail ? `Free stock search failed: ${data.detail}` : `Free stock search failed (${response.status}).`);
        continue;
      }
      const results = Array.isArray(data.results) ? data.results : [];
      if (!results.length) {
        lastError = new Error(`"${query}" ke liye koi CC0/public-domain image nahi mili.`);
        continue;
      }
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
      if (!images.length) {
        lastError = new Error('Free stock images download nahi hui.');
        continue;
      }
      stockImageCache.set(cacheKey, { ts: Date.now(), images });
      if (stockImageCache.size > 20) stockImageCache.delete(stockImageCache.keys().next().value);
      return pickStockImages(images, wanted, prompt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Free stock images unavailable.');
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

function validImageBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8000) return false;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes.length > 24
    && bytes[0] === 0x89 && bytes.toString('ascii', 1, 4) === 'PNG';
  const isWebp = bytes.length > 16
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) return false;

  let width = 0;
  let height = 0;
  if (isPng) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (isWebp) {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      width = 1 + bytes.readUIntLE(24, 3);
      height = 1 + bytes.readUIntLE(27, 3);
    } else if (chunk === 'VP8 ') {
      width = bytes.readUInt16LE(26) & 0x3fff;
      height = bytes.readUInt16LE(28) & 0x3fff;
    }
  } else {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const size = bytes.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = bytes.readUInt16BE(offset + 5);
        width = bytes.readUInt16BE(offset + 7);
        break;
      }
      offset += 2 + size;
    }
  }
  return width >= 256 && height >= 256;
}

async function collectJobImages(job, prompts, directory = null) {
  const provider = job.imageProvider || DEFAULT_IMAGE_PROVIDER;
  const list = Array.isArray(prompts) ? prompts.map((item) => String(item || '').trim()).filter(Boolean) : [];
  if (!list.length) throw new Error('Image prompts nahi mile — pehle story likhna zaroori hai.');
  const pool = [];
  const usedHashes = new Set();
  const pickUnique = (images) => {
    for (const bytes of images || []) {
      if (!validImageBytes(bytes)) continue;
      const hash = createHash('sha1').update(bytes).digest('hex');
      if (usedHashes.has(hash)) continue;
      usedHashes.add(hash);
      return bytes;
    }
    return null;
  };
  const requestUnique = async (text, forceProvider = provider) => {
    const result = forceProvider === 'auto'
      ? await generateImageSmart(text, { model: job.imageModel, ratio: job.ratio })
      : await fetchImageResult(text, job.imageModel, forceProvider, job.ratio);
    return pickUnique(result.images || []);
  };
  const movieLook = job.type === 'song' || job.style === 'cinematic'
    ? 'cinematic film still, dramatic movie lighting, 35mm film look, wide establishing shot, depth of field, '
    : '';
  const frameWord = job.style === 'cartoon' ? 'one illustration' : 'one cinematic frame';
  // Har story line ka apna prompt aur apni image — exact 1:1, koi duplicate/collage nahi.
  for (let index = 0; index < list.length; index += 1) {
    const scenePrompt = list[index];
    const firstSentence = scenePrompt.split(/(?<=[.!?।])\s+/)[0] || scenePrompt;
    const variants = [
      `${scenePrompt}. ${movieLook}${job.style ? `${job.style} style, ` : ''}single coherent scene, ${frameWord}, no collage, no panels, no text.`,
      `${firstSentence.slice(0, 220)}. ${movieLook}${job.style ? `${job.style} style, ` : ''}single coherent scene, ${frameWord}, no collage, no panels, no text.`,
      `${scenePrompt.slice(0, 260)}. ${movieLook}cinematic composition, one coherent scene, ${frameWord}, no collage, no panels, no text.`,
    ];
    const file = directory
      ? path.join(directory, `scene-${String(index + 1).padStart(2, '0')}.jpg`)
      : null;
    let chosen = null;
    // Retry par pehle se bani image reuse karo — itni mehnat dobara na ho.
    if (file) {
      try {
        await access(file);
        const bytes = await readFile(file);
        if (validImageBytes(bytes)) {
          const hash = createHash('sha1').update(bytes).digest('hex');
          if (!usedHashes.has(hash)) {
            usedHashes.add(hash);
            chosen = bytes;
          }
        }
      } catch { /* file nahi hai ya corrupt — dobara banayein */ }
    }
    // Ek scene fail ho to usi scene ko dobara banao; kabhi agle scene ki image repeat nahi.
    // Bing 2 baar fail ho to free fallback providers — poori video rukti nahi.
    const fallbacks = provider === 'bing'
      ? ['stock', 'cloudflare', 'huggingface', 'worker']
      : ['stock', 'auto'];
    let activeProvider = provider;
    for (let attempt = 0; attempt < 8 && !chosen; attempt += 1) {
      const text = variants[Math.min(attempt, variants.length - 1)];
      try {
        chosen = await requestUnique(text, activeProvider);
      } catch {
        chosen = null;
      }
      if (chosen) break;
      if (attempt >= 1) activeProvider = fallbacks[(attempt - 1) % fallbacks.length];
      if (!chosen) await sleep(800);
    }
    if (!chosen) {
      throw new Error(`Scene ${index + 1}/${list.length} ki unique image nahi bani. Bing/login check karke dobara try karein.`);
    }
    if (file) await writeFile(file, chosen);
    pool.push(chosen);
    await updateMediaJob(job, {
      step: `${provider === 'stock' ? 'Stock' : 'Bing'} se scene ${index + 1}/${list.length} ki image ready — story line se match…`,
      progress: 10 + Math.round(((index + 1) / list.length) * 55),
      ...(file ? { resumeOnStart: true } : {}),
    });
  }
  return pool;
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
  const fullPrompt = String(payload.prompt || '').trim();
  const type = ['story', 'song', 'meme', 'cartoon'].includes(payload.type) ? payload.type : 'story';
  // Storyboard (table + per-scene image prompts) 1200 chars me nahi aata — use 20k for stories.
  const prompt = fullPrompt.slice(0, type === 'story' ? 20_000 : 1200);
  if (!prompt) throw new Error('Prompt is required.');
  const ratio = payload.ratio === '9:16' ? '9:16' : '16:9';
  const style = String(payload.style || inferMediaStyle(prompt, type)).slice(0, 60);
  const studio = payload.studio === true;
  const limitFx = studio ? 24 : 8;
  const fx = (Array.isArray(payload.fx) ? payload.fx : String(payload.fx || '').split(','))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, limitFx);
  const transitions = (Array.isArray(payload.transitions) ? payload.transitions : String(payload.transitions || '').split(','))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, limitFx);
  const visualizers = (Array.isArray(payload.visualizers) ? payload.visualizers : String(payload.visualizers || '').split(','))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
  const audioFx = (Array.isArray(payload.audioFx) ? payload.audioFx : String(payload.audioFx || '').split(','))
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  const sourceAssets = studio ? normalizeStudioAssets(payload.sourceAssets) : [];
  let bgmPath = null;
  if (studio && payload.bgmPath) {
    bgmPath = resolveJobAudioPath(payload.bgmPath);
    if (bgmPath && !path.isAbsolute(String(payload.bgmPath))) {
      bgmPath = path.relative(WORKSPACE, bgmPath).replace(/\\/g, '/');
    }
  }

  let audioPath = null;
  if (payload.audioPath) {
    audioPath = resolveJobAudioPath(payload.audioPath);
    if (audioPath && !path.isAbsolute(String(payload.audioPath))) {
      audioPath = path.relative(WORKSPACE, audioPath).replace(/\\/g, '/');
    }
  }

  const audioDuration = audioPath ? await probeAudioDuration(audioPath) : 0;
  const sourceVideoDuration = sourceAssets
    .filter((asset) => asset.kind === 'video')
    .reduce((sum, asset) => sum + (Number(asset.duration) || 0), 0);
  const storyboard = type === 'story' ? parseStoryboard(prompt) : null;
  const requestedDuration = Number(payload.durationSeconds) || 0;
  // Uploaded MP3 ki asli length hamesha match karegi. User di hui duration next priority.
  const durationSeconds = Math.min(900, Math.max(15,
    audioDuration > 0
      ? Math.round(audioDuration)
      : requestedDuration > 0
        ? Math.round(requestedDuration)
        : sourceVideoDuration > 0
          ? Math.round(sourceVideoDuration)
          : storyboard?.durationSeconds || 60,
  ));
  const rawRequestedScenes = Number(payload.sceneCount) || 0;
  // Purane settings me 6 scenes saved ho to 3/5 min ke video me ignore karo — auto count lagao.
  let requestedScenes = rawRequestedScenes > 0 && rawRequestedScenes < 20
    && (audioPath || durationSeconds >= 120 || type === 'song')
    ? 0
    : rawRequestedScenes;
  if (storyboard?.sceneCount > 0) requestedScenes = storyboard.sceneCount;
  const sceneCount = sceneCountForDuration(durationSeconds, 0, requestedScenes);

  const job = {
    id,
    type,
    prompt,
    ratio,
    style,
    fx: fx.length ? fx : inferMediaFx(prompt),
    transitions: transitions.length ? transitions : inferTransitions(prompt),
    visualizers,
    audioFx,
    studio,
    sourceAssets,
    bgmPath,
    bpm: Math.max(0, Math.round(Number(payload.bpm) || 0)),
    sceneCount,
    manualSceneCount: requestedScenes > 0,
    durationSeconds,
    clipSeconds: Math.min(10, Math.max(2, Number(payload.clipSeconds) || 5)),
    audioPath,
    lyrics: String(payload.lyrics || '').slice(0, 12_000),
    imagePrompts: storyboard?.imagePrompts || [],
    characterBible: storyboard?.characterBible || '',
    storyboardLines: storyboard?.narrationLines || [],
    storyboardTitles: storyboard?.titles || [],
    storyboardStarts: storyboard?.sceneStarts || [],
    storyboardEnds: storyboard?.sceneEnds || [],
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

  if (studio && sourceAssets.some((asset) => asset.kind === 'image' || asset.kind === 'video')) {
    job.useAiVideo = false;
  }

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
        if (!job.manualSceneCount) {
          const beatScenes = sceneCountForDuration(job.durationSeconds, analysis.bpm, 0);
          if (beatScenes !== job.sceneCount) {
            await updateMediaJob(job, {
              sceneCount: beatScenes,
              step: `Beat/story ke hisaab se ${beatScenes} scenes set — images ab banenge…`,
              progress: 9,
            });
          }
        }
      }
    }

    const creds = mediaTtsCredentials.get(job.id) || {};
    await updateMediaJob(job, {
      step: 'Story script likhi ja rahi hai — pehle kahani, phir usi ki audio…',
      progress: 10,
    });
    const savedStoryLines = Array.isArray(job.storyLines) ? job.storyLines : [];
    let captions = savedStoryLines.length >= 2
      ? savedStoryLines.slice(0, job.sceneCount)
      : splitCaptions(job.prompt, job.sceneCount);
    if (job.type === 'story') {
      if (Array.isArray(job.storyboardLines) && job.storyboardLines.length >= 2) {
        captions = job.storyboardLines.slice(0, job.sceneCount);
        await updateMediaJob(job, { step: `Storyboard ke ${captions.length} scenes mil gaye — unhi par voice aur images…`, progress: 66 });
      } else if (savedStoryLines.length >= 2) {
        await updateMediaJob(job, { step: `Saved story mil gayi — ${captions.length} lines wahin se resume…`, progress: 66 });
      } else {
        try {
          captions = await generateStoryScriptWithModel(job, creds, captions);
          await updateMediaJob(job, { step: 'Asli story likhi gayi — ab usi par natural voice…', progress: 66 });
        } catch (err) {
          captions = buildStoryScript(job, captions);
          await updateMediaJob(job, { step: `Story model unavailable (${String(err.message || err).slice(0, 90)}) — local script use kar rahe hain…`, progress: 66 });
        }
      }
    } else if (savedStoryLines.length < 2) {
      captions = buildStoryScript(job, captions);
    }
    const narrationText = captions.map((line) => String(line).trim().replace(/[.!?।]+$/, '')).filter(Boolean).join('. ') + '.';
    const storyFile = path.join(directory, 'story.txt');
    await writeFile(storyFile, captions.map((line, index) => `${index + 1}. ${line}`).join('\n'), 'utf8');
    await updateMediaJob(job, {
      storyFile: `media-jobs/${job.id}/story.txt`,
      storyText: captions.join('\n'),
      storyLines: captions,
      stage: 'story',
      step: `Story ready — ${captions.length} scenes. Ab audio model se voice ban raha hai…`,
      progress: 68,
    });

    const lineCount = Math.max(1, captions.length);
    const savedBeats = Array.isArray(job.visualBeats) ? job.visualBeats : [];
    const savedLineImages = Array.isArray(job.lineImagePrompts) ? job.lineImagePrompts : [];
    const canReuseBeats = savedBeats.length > 0
      && savedLineImages.length === captions.length
      && savedBeats.length === Number(job.sceneCount)
      && savedBeats.every((beat) => {
        const lineIndex = Number(beat?.lineIndex);
        return Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < captions.length;
      });
    await updateMediaJob(job, {
      step: canReuseBeats
        ? 'Saved visual beats mil gaye — wahi images ke saath aage badh rahe hain…'
        : `Poori story padh kar visual beats bana rahe hain — har line me 1 se 3 images ho sakti hain…`,
      progress: 69,
    });
    let lineImages = [];
    let visualBeats = [];
    if (canReuseBeats) {
      lineImages = savedLineImages.map((images, index) => {
        const list = Array.isArray(images) && images.length
          ? images.slice(0, 3)
          : fallbackLineImagePrompts(job, captions[index], job.imagePrompts?.[index]);
        return list.map((prompt) => withCharacterBible(prompt, job.characterBible));
      });
      visualBeats = savedBeats.map((beat) => withVisualBeatLock(job, beat));
    } else {
      try {
        const generated = await generateVisualBeatsWithModel(job, captions, creds);
        lineImages = generated.lineImages;
        job.characterBible = generated.characterBible || job.characterBible || '';
        await updateMediaJob(job, {
          characterBible: job.characterBible,
          step: `Story ke ${lineCount} lines ke visual beats ready — characters locked…`,
        });
      } catch (err) {
        lineImages = captions.map((line, index) => fallbackLineImagePrompts(job, line, job.imagePrompts?.[index]));
        await updateMediaJob(job, {
          step: `Visual model unavailable (${String(err.message || err).slice(0, 90)}) — line ke clause se images bana rahe hain…`,
        });
      }
      lineImages = lineImages.map((images, index) => {
        const list = Array.isArray(images) && images.length
          ? images.slice(0, 3)
          : fallbackLineImagePrompts(job, captions[index], job.imagePrompts?.[index]);
        return list.map((prompt) => withCharacterBible(prompt, job.characterBible));
      });
      visualBeats = buildVisualBeats(job, captions, lineImages);
    }
    if (!visualBeats.length) throw new Error('Story se koi visual beat nahi bana.');
    const sceneImagePrompts = visualBeats.map((beat) => beat.prompt);
    await updateMediaJob(job, {
      sceneCount: visualBeats.length,
      narrationLineCount: captions.length,
      visualBeats,
      lineImagePrompts: lineImages,
      imagePrompts: sceneImagePrompts,
      step: `${captions.length} narration lines → ${visualBeats.length} matching images. Har image apni line ke saath sync hai…`,
      progress: 9,
    });
    // Naye beats bane ho to purani scene images hat do — warna purani image naye line ke saath galat lagegi.
    if (!canReuseBeats) {
      for (const scene of job.scenes || []) {
        scene.image = null;
        scene.video = null;
      }
      try {
        for (const file of await readdir(directory)) {
          if (/^scene-\d+\.(jpg|jpeg|png|webp)$/i.test(file)) {
            await rm(path.join(directory, file), { force: true });
          }
        }
      } catch { /* directory abhi nahi bani ya read fail */ }
    }
    // Studio uploads ko story ke visual beats par distribute karo — AI image tabhi banao jab upload na ho.
    const visualAssets = (job.sourceAssets || []).filter((asset) => asset.kind === 'image' || asset.kind === 'video');
    let imagePool = [];
    if (job.studio && visualAssets.length) {
      await updateMediaJob(job, {
        step: `${visualAssets.length} uploaded clips/images ko ${visualBeats.length} beats par arrange kar rahe hain…`,
        progress: 12,
      });
      for (let index = 0; index < visualBeats.length; index += 1) {
        const asset = visualAssets[index % visualAssets.length];
        const scene = job.scenes[index] || { index: index + 1 };
        scene.image = asset.kind === 'image' ? asset.path : null;
        scene.video = asset.kind === 'video' ? asset.path : null;
        scene.sourceAsset = asset.name;
        scene.imagePrompt = visualBeats[index]?.prompt || scene.imagePrompt;
        job.scenes[index] = scene;
      }
      await updateMediaJob(job, {
        imagePoolCount: visualAssets.length,
        step: `Timeline ready — ${visualBeats.length} scenes uploaded media se sync hain…`,
        progress: 13,
      });
    } else {
      // Ek image me multiple scenes/collage nahi: har visual beat ka apna prompt aur apni unique image.
      imagePool = await collectJobImages(job, sceneImagePrompts, directory);
      if (imagePool.length !== visualBeats.length) {
        throw new Error(`Sirf ${imagePool.length}/${visualBeats.length} images bani — duplicate images nahi lagayenge.`);
      }
      await updateMediaJob(job, {
        imagePoolCount: imagePool.length,
        step: `${imagePool.length} unique images ready — har ek apni narration line ke exact hisse se match karti hai…`,
        progress: 12,
      });
    }

    // Visual beats already get FFmpeg zoom/pan — extra LTX clips slow aur inconsistent hote hain.
    const useMotion = job.useAiVideo && job.sceneCount <= 8 && !job.analysis && !job.visualBeats?.length;
    for (let index = 0; index < job.sceneCount; index += 1) {
      if (cancelledJobs.has(job.id)) throw new Error('Video cancelled.');
      const beat = job.visualBeats?.[index] || { lineIndex: index, prompt: job.imagePrompts?.[index] };
      const lineIndex = Number.isFinite(Number(beat?.lineIndex)) ? Number(beat.lineIndex) : index;
      const scene = job.scenes[index] || { index: index + 1, caption: captions[lineIndex] || `Scene ${index + 1}` };
      scene.lineIndex = lineIndex;
      scene.caption = captions[lineIndex] || scene.caption;
      scene.imagePrompt = beat?.prompt || job.imagePrompts?.[index] || scene.imagePrompt;
      scene.status = scene.status || 'pending';
      if (!scene.image && !scene.video && Array.isArray(imagePool)) {
        await updateMediaJob(job, {
          step: `Scene ${index + 1}/${job.sceneCount}: ${job.style} image ban rahi hai…`,
          progress: 10 + Math.round(((index + 0.3) / job.sceneCount) * 60),
        });
        const bytes = imagePool[index];
        const file = `scene-${String(index + 1).padStart(2, '0')}.jpg`;
        await writeFile(path.join(directory, file), bytes);
        scene.image = `media-jobs/${job.id}/${file}`;
        scene.status = 'image-ready';
      } else if (!scene.status || scene.status === 'pending') {
        scene.status = job.studio && scene.video ? 'clip-ready' : 'image-ready';
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
          scene.status = 'ready';
        } catch (err) {
          scene.videoError = String(err.message || err).slice(0, 300);
          scene.status = scene.image ? 'image-ready' : 'pending';
        }
      } else if (!scene.videoError) {
        scene.status = 'ready';
      }

      job.scenes[index] = scene;
      await updateMediaJob(job, {
        progress: 10 + Math.round(((index + 1) / job.sceneCount) * 60),
        stage: 'assets',
        completedScenes: job.scenes.filter((item) => ['ready', 'clip-ready', 'image-ready'].includes(item.status)).length,
        step: `Scene ${index + 1}/${job.sceneCount} saved · ${job.scenes.filter((item) => ['ready', 'clip-ready', 'image-ready'].includes(item.status)).length} ready…`,
      });
    }

    if (cancelledJobs.has(job.id)) throw new Error('Video cancelled.');
    let narrationPath = job.narrationPath ? resolveJobAudioPath(job.narrationPath) : null;
    try { if (narrationPath) await access(narrationPath); else narrationPath = null; } catch { narrationPath = null; }
    let ambientPath = job.ambientPath ? resolveJobAudioPath(job.ambientPath) : null;
    try { if (ambientPath) await access(ambientPath); else ambientPath = null; } catch { ambientPath = null; }

    if (job.narration && (!audioPath || job.studio)) {
      if (narrationPath) {
        await updateMediaJob(job, { stage: 'voice', step: 'Saved voice track mil gayi — dobara nahi bana rahe…', progress: 72 });
      } else {
        await updateMediaJob(job, { stage: 'voice', step: 'Natural AI voice se har scene ki story line uske time par boli ja rahi hai…', progress: 72 });
        try {
          narrationPath = await buildTimedNarration(
            captions,
            job.storyboardStarts,
            job.storyboardEnds,
            job.durationSeconds,
            job.voice,
            creds,
            directory,
          );
          await updateMediaJob(job, {
            narrationPath: path.relative(WORKSPACE, narrationPath).replace(/\\/g, '/'),
            step: 'Pro natural voice ready — story scene ke saath sync hai…',
            progress: 73,
          });
        } catch (err) {
          await updateMediaJob(job, { step: `AI voice unavailable (${String(err.message || err).slice(0, 90)}) — local film voice se banana…`, progress: 72 });
          try {
            narrationPath = await synthesizeNarration(
              narrationText,
              localVoiceName(job.voice),
              path.join(directory, 'narration.wav'),
            );
            await updateMediaJob(job, {
              narrationPath: path.relative(WORKSPACE, narrationPath).replace(/\\/g, '/'),
            });
          } catch (voiceErr) {
            await updateMediaJob(job, { step: `Voice skip: ${String(voiceErr.message || voiceErr).slice(0, 120)}` });
          }
        }
      }
    }
    if (!audioPath && job.narration !== false && !ambientPath) {
      try {
        ambientPath = await generateAmbientBed(
          path.join(directory, 'ambient.wav'),
          job.durationSeconds,
          { boundaries: job.visualBeats?.length || captions.length || job.sceneCount || 1 },
        );
        await updateMediaJob(job, {
          ambientPath: path.relative(WORKSPACE, ambientPath).replace(/\\/g, '/'),
        });
      } catch (err) {
        await updateMediaJob(job, { step: `Ambient skip: ${String(err.message || err).slice(0, 100)}` });
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
      await assembleVideoWithFfmpeg(job, directory, { narration: narrationPath, ambient: ambientPath });
    }
  } catch (err) {
    await updateMediaJob(job, {
      status: 'error',
      error: String(err.message || err).slice(0, 600),
      step: 'Error',
    });
  } finally {
    mediaRunning.delete(job.id);
    mediaTtsCredentials.delete(job.id);
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
    } else if (job.status === 'error' && job.resumeOnStart && (job.resumeAttempts || 0) < 3 && !mediaRunning.has(job.id)) {
      await updateMediaJob(job, { resumeAttempts: (job.resumeAttempts || 0) + 1 });
      await updateMediaJob(job, {
        status: 'assets',
        error: null,
        step: 'App restart — saved images se wahin se resume…',
      });
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

const NODE_STATIC_SERVER = [
  "const http=require('http');const fs=require('fs');const path=require('path');",
  "const root=process.cwd();const port=Number(process.env.PORT||4173);",
  "const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};",
  "http.createServer((req,res)=>{let name=decodeURIComponent(req.url.split('?')[0]);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root)){res.writeHead(403).end('Forbidden');return;}fs.stat(file,(err,info)=>{const target=(!err&&info.isFile())?file:path.join(root,'index.html');fs.readFile(target,(e,data)=>{if(e){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});});}).listen(port,()=>console.log('Nova app running at http://localhost:'+port));",
].join('\n');

async function fileExists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function packageScripts(dir) {
  try {
    const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
    return pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  } catch {
    return {};
  }
}

async function resolveAppCommand(dir, args = {}, port = 4173) {
  const manual = String(args.command || '').trim();
  if (manual) {
    return {
      command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
      args: process.platform === 'win32' ? ['/d', '/s', '/c', manual] : ['-c', manual],
      label: manual,
    };
  }
  const scripts = await packageScripts(dir);
  for (const name of ['dev', 'start', 'serve']) {
    if (scripts[name]) {
      return {
        command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: ['run', name],
        label: `npm run ${name}`,
      };
    }
  }
  for (const entry of ['server.js', 'app.js', 'index.js', 'main.js']) {
    if (await fileExists(path.join(dir, entry))) {
      return { command: process.execPath, args: [entry], label: `node ${entry}` };
    }
  }
  if (await fileExists(path.join(dir, 'index.html'))) {
    return {
      command: process.execPath,
      args: ['-e', NODE_STATIC_SERVER],
      label: `static server on port ${port}`,
    };
  }
  throw new Error(`App run karne ka tarika nahi mila: ${dir}. package.json ya index.html banao, ya command bhejo.`);
}

async function probeLocalUrl(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function listScriptFiles(dir) {
  const found = [];
  async function walk(current, depth) {
    if (depth > 4 || found.length >= 60) return;
    let entries = [];
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.name.endsWith('.js') && found.length < 60) found.push(full);
    }
  }
  await walk(dir, 0);
  return found;
}

const DESTRUCTIVE_COMMAND = /(?:^|[;&|]\s*)(?:format\s|diskpart(?:\s|$)|shutdown\s|rd\s+\/s\s+\/q\s+[a-z]:\\?\s*$)/i;

/* ---------------------- built-in REA-style analysis tools ------------------ */

const ANALYSIS_TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.htm', '.css', '.scss', '.json',
  '.py', '.go', '.rs', '.java', '.php', '.rb', '.sh', '.ps1', '.sql', '.md', '.yml', '.yaml',
  '.vue', '.svelte', '.env', '.txt', '.config', '.xml',
]);
const ANALYSIS_SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'runtime', '.cache', 'coverage',
]);

async function walkAnalysisFiles(root, maxFiles = 400) {
  const files = [];
  async function walk(current, depth) {
    if (files.length >= maxFiles || depth > 7) return;
    let entries = [];
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ANALYSIS_SKIP_DIRS.has(entry.name.toLowerCase())) await walk(full, depth + 1);
        continue;
      }
      let size = 0;
      try { size = (await stat(full)).size; } catch { continue; }
      files.push({ full, rel: path.relative(root, full).replace(/\\/g, '/'), ext: path.extname(entry.name).toLowerCase(), size });
    }
  }
  await walk(root, 0);
  return files;
}

function uniqueLimited(values, limit = 40) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].slice(0, limit);
}

function detectStack(text, files, pkg) {
  const stack = new Set();
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  for (const [name, aliases] of Object.entries({
    React: ['react'], Next: ['next'], Vue: ['vue'], Nuxt: ['nuxt'], Angular: ['@angular/core'],
    Svelte: ['svelte'], Express: ['express'], Fastify: ['fastify'], Koa: ['koa'],
    Vite: ['vite'], Webpack: ['webpack'], Tailwind: ['tailwindcss'], TypeScript: ['typescript'],
    Electron: ['electron'], SQLite: ['sqlite3', 'better-sqlite3'], Postgres: ['pg', 'prisma'],
    MongoDB: ['mongoose', 'mongodb'], FFmpeg: ['fluent-ffmpeg'],
  })) {
    if (aliases.some((alias) => deps[alias])) stack.add(name);
  }
  if (/from\s+['"]react|require\(['"]react/.test(text)) stack.add('React');
  if (/from\s+['"]vue|new Vue\(/.test(text)) stack.add('Vue');
  if (/\bcreateServer\(|app\.listen\(/.test(text)) stack.add('Node HTTP');
  if (/<html[\s>]/i.test(text)) stack.add('HTML/CSS');
  if (files.some((file) => file.ext === '.py')) stack.add('Python');
  if (files.some((file) => file.ext === '.ps1')) stack.add('PowerShell');
  return [...stack];
}

async function analyzeAppFolder(dir, root, options = {}) {
  const files = await walkAnalysisFiles(dir, Math.min(800, Math.max(20, Number(options.maxFiles) || 400)));
  const texts = [];
  for (const file of files) {
    if (!ANALYSIS_TEXT_EXT.has(file.ext) || file.size > 300_000) continue;
    const value = await readFile(file.full, 'utf8').catch(() => '');
    if (value) texts.push({ rel: file.rel, text: value.slice(0, 120_000) });
  }
  const allText = texts.map((item) => item.text).join('\n').slice(0, 900_000);
  let pkg = {};
  const pkgFile = files.find((file) => file.rel === 'package.json');
  if (pkgFile) pkg = JSON.parse(await readFile(pkgFile.full, 'utf8').catch(() => '{}'));

  const routes = [];
  for (const pattern of [
    /(?:app|router|server)\.(?:get|post|put|delete|patch|use)\(\s*['"`]([^'"`]+)/g,
    /(?:fetch|axios\.(?:get|post))\(\s*['"`]([^'"`]+)/g,
    /path\s*:\s*['"`]([^'"`]+)/g,
    /href\s*=\s*['"`](\/[^'"`]*)/g,
  ]) {
    for (const match of allText.matchAll(pattern)) routes.push(match[1]);
  }

  const headings = [];
  const buttons = [];
  const inputs = [];
  const links = [];
  for (const match of allText.matchAll(/<(h1|h2|h3|button|a|input|label)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const textMatch = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]{0,160}?)<\\/${tag}>`, 'i').exec(allText.slice(match.index, match.index + 400));
    const label = textMatch ? textMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const id = /\bid\s*=\s*['"]([^'"]+)/.exec(attrs)?.[1] || '';
    const className = /\bclass\s*=\s*['"]([^'"]+)/.exec(attrs)?.[1] || '';
    const placeholder = /\bplaceholder\s*=\s*['"]([^'"]+)/.exec(attrs)?.[1] || '';
    const href = /\bhref\s*=\s*['"]([^'"]+)/.exec(attrs)?.[1] || '';
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') headings.push({ tag, text: label || id || className, className });
    if (tag === 'button' || /btn|button/.test(className)) buttons.push({ text: label || id || className, className });
    if (tag === 'input') inputs.push({ placeholder, id, className, type: /\btype\s*=\s*['"]([^'"]+)/.exec(attrs)?.[1] || 'text' });
    if (tag === 'a' && href) links.push({ text: label || href, href });
  }

  const componentNames = [];
  for (const pattern of [
    /function\s+([A-Z][A-Za-z0-9_]{2,})\s*\(/g,
    /const\s+([A-Z][A-Za-z0-9_]{2,})\s*=\s*(?:\([^)]*\)|\w)?\s*=>/g,
    /class\s+([A-Z][A-Za-z0-9_]{2,})/g,
  ]) {
    for (const match of allText.matchAll(pattern)) componentNames.push(match[1]);
  }

  const colors = uniqueLimited([...allText.matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi)].map((match) => match[0]), 30);
  const fonts = uniqueLimited([...allText.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((match) => match[1]), 12);
  const cssVars = uniqueLimited([...allText.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)].map((match) => `${match[1]}: ${match[2]}`), 24);
  const titleFromHtml = /<title>([\s\S]*?)<\/title>/i.exec(allText)?.[1]?.trim();
  const titleFromReadme = /^#\s+(.+)$/m.exec(allText)?.[1]?.trim();

  const report = {
    kind: 'app-folder',
    source: dir,
    generatedAt: new Date().toISOString(),
    title: titleFromHtml || titleFromReadme || pkg.name || path.basename(dir),
    stack: detectStack(allText, files, pkg),
    scripts: pkg?.scripts || {},
    dependencies: { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) },
    files: files.slice(0, 200).map(({ rel, ext, size }) => ({ path: rel, ext, size })),
    entryPoints: uniqueLimited(files
      .filter((file) => /^(index\.html|server\.(js|ts)|app\.(js|ts)|main\.(js|ts)|src\/index\.(js|ts|jsx|tsx)|package\.json)$/.test(file.rel))
      .map((file) => file.rel), 20),
    routes: uniqueLimited(routes, 80),
    components: uniqueLimited(componentNames, 60),
    ui: {
      headings: uniqueLimited(headings.map((item) => item.text), 24).slice(0, 24),
      buttons: uniqueLimited(buttons.map((item) => item.text), 24),
      inputs: inputs.slice(0, 20),
      links: links.slice(0, 30),
    },
    design: { colors, fonts, cssVars },
    assets: uniqueLimited(files.filter((file) => ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.woff', '.woff2', '.mp4'].includes(file.ext)).map((file) => file.rel), 50),
    hints: {
      hasDatabase: /mongoose|sqlite|postgres|prisma|mongodb|CREATE TABLE/i.test(allText),
      hasAuth: /jwt|oauth|login|session|bcrypt|passport/i.test(allText),
      hasApi: /\/api\/|fetch\(|axios/i.test(allText),
      hasRealtime: /websocket|socket\.io|EventSource/i.test(allText),
    },
  };

  let file = null;
  if (options.save !== false) {
    const slug = path.basename(dir).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'app';
    const analysisDir = safeWorkspacePath('analysis', root);
    await mkdir(analysisDir, { recursive: true });
    file = path.join(analysisDir, `${slug}-analysis.json`);
    await writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  }
  return { report, file };
}

async function analyzeWebPage(rawUrl, root) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Valid http(s) URL chahiye.');
  const target = await browserTarget(url);
  await sleep(1500);
  const expression = `(() => {
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 180);
    const bodyStyle = getComputedStyle(document.body);
    const nodes = [...document.querySelectorAll('body *')].slice(0, 500);
    const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 24).map((el) => ({ tag: el.tagName.toLowerCase(), text: clean(el.innerText), className: clean(el.className) }));
    const buttons = [...document.querySelectorAll('button,a.button,[role=button]')].slice(0, 30).map((el) => ({ text: clean(el.innerText), className: clean(el.className), bg: getComputedStyle(el).backgroundColor }));
    const inputs = [...document.querySelectorAll('input,textarea,select')].slice(0, 30).map((el) => ({ tag: el.tagName.toLowerCase(), type: el.type || '', placeholder: clean(el.placeholder), name: clean(el.name), id: clean(el.id) }));
    const links = [...document.querySelectorAll('a[href]')].slice(0, 40).map((el) => ({ text: clean(el.innerText), href: el.getAttribute('href') }));
    const structure = nodes.slice(0, 120).map((el) => ({ tag: el.tagName.toLowerCase(), id: clean(el.id), className: clean(el.className).slice(0, 90) })).filter((item) => item.id || item.className);
    const colors = [...new Set([bodyStyle.backgroundColor, bodyStyle.color, ...buttons.map((b) => b.bg)])].slice(0, 20);
    const resources = performance.getEntriesByType('resource').slice(0, 60).map((item) => item.name);
    return {
      url: location.href,
      title: document.title,
      description: clean(document.querySelector('meta[name=description]')?.content),
      headings, buttons, inputs, links, structure, colors,
      font: bodyStyle.fontFamily,
      bodyBackground: bodyStyle.backgroundColor,
      bodyColor: bodyStyle.color,
      textSample: clean(document.body.innerText).slice(0, 2000),
      resources,
      frameworks: {
        react: Boolean(window.React || document.querySelector('#root')),
        vue: Boolean(window.Vue || document.querySelector('#app')),
        next: Boolean(window.__NEXT_DATA__),
        jquery: Boolean(window.jQuery),
      },
    };
  })()`;
  const data = await pageEvaluate(expression) || {};
  let screenshot = null;
  try {
    const shot = await cdpCommand(target.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
    if (shot.data) screenshot = Buffer.from(shot.data, 'base64');
  } catch { /* screenshot optional */ }

  const slug = String(data.title || url).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'webpage';
  const analysisDir = safeWorkspacePath('analysis', root);
  await mkdir(analysisDir, { recursive: true });
  const file = path.join(analysisDir, `${slug}-webpage.json`);
  const report = {
    kind: 'webpage',
    source: data.url || url,
    generatedAt: new Date().toISOString(),
    title: data.title || slug,
    description: data.description || '',
    stack: Object.entries(data.frameworks || {}).filter(([, value]) => value).map(([name]) => name),
    ui: {
      headings: (data.headings || []).map((item) => item.text).filter(Boolean),
      buttons: (data.buttons || []).map((item) => item.text).filter(Boolean),
      inputs: data.inputs || [],
      links: data.links || [],
      structure: data.structure || [],
      text: data.textSample || '',
    },
    design: {
      colors: data.colors || [],
      background: data.bodyBackground || '',
      color: data.bodyColor || '',
      font: data.font || '',
    },
    routes: (data.links || []).map((item) => item.href).filter((href) => href && href.startsWith('/')),
    resources: data.resources || [],
  };
  await writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  if (screenshot) await writeFile(path.join(analysisDir, `${slug}-screenshot.png`), screenshot);
  return { report, file };
}

async function analyzeBinaryFile(rawPath, root) {
  const file = safeWorkspacePath(rawPath || '', root);
  const info = await stat(file);
  const size = Math.min(info.size, 4 * 1024 * 1024);
  const handle = await (await import('node:fs/promises')).open(file, 'r');
  const buffer = Buffer.alloc(size);
  try { await handle.read(buffer, 0, size, 0); } finally { await handle.close(); }
  const ascii = buffer.toString('latin1');
  const utf16 = buffer.toString('utf16le');
  const magic = buffer.length > 4 ? buffer.subarray(0, 4).toString('hex').toUpperCase() : '';
  const kind = magic.startsWith('4D5A') ? 'PE/EXE/DLL'
    : magic.startsWith('504B') ? 'ZIP/Office'
      : buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'PNG'
        : magic.startsWith('7F454C46') ? 'ELF' : 'unknown';
  const strings = uniqueLimited([
    ...(ascii.match(/[\x20-\x7E]{6,}/g) || []),
    ...(utf16.match(/[\x20-\x7E]{8,}/g) || []),
  ], 120);
  const report = {
    kind: 'binary',
    source: file,
    generatedAt: new Date().toISOString(),
    size: info.size,
    format: kind,
    magic,
    urls: uniqueLimited(strings.filter((value) => /^https?:\/\//.test(value)), 30),
    paths: uniqueLimited(strings.filter((value) => /^[A-Za-z]:\\|^\/[\w.-]+\//.test(value)), 30),
    dlls: uniqueLimited(strings.filter((value) => /^(?:kernel32|user32|gdi32|advapi32|shell32|winhttp|ws2_32)\.dll$/i.test(value)), 30),
    strings: strings.slice(0, 120),
  };
  const analysisDir = safeWorkspacePath('analysis', root);
  await mkdir(analysisDir, { recursive: true });
  const slug = path.basename(file).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'binary';
  const out = path.join(analysisDir, `${slug}-binary.json`);
  await writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  return { report, file: out };
}

function safeCssValue(value, fallback) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 180) return fallback;
  if (new RegExp("[^a-zA-Z0-9#.,()%\\-\\/\\s\"']").test(cleaned)) return fallback;
  return cleaned;
}

function replicateFromReport(report, prompt, root, target) {
  const title = String(report.title || prompt || 'Nova Replica App').slice(0, 120);
  const headings = (report.ui?.headings || []).filter(Boolean);
  const buttons = (report.ui?.buttons || []).filter(Boolean);
  const inputs = Array.isArray(report.ui?.inputs) ? report.ui.inputs.slice(0, 6) : [];
  const links = Array.isArray(report.ui?.links) ? report.ui.links.slice(0, 8) : [];
  const colors = report.design?.colors || [];
  const accent = safeCssValue(colors.find((color) => /^#/.test(color)) || colors[0], '#6c5ce7');
  const background = safeCssValue(report.design?.background, '#0d0e11');
  const foreground = safeCssValue(report.design?.color, '#f2f3f5');
  const font = safeCssValue(report.design?.font, 'system-ui, -apple-system, Segoe UI, sans-serif');
  const heroTitle = headings[0] || title;
  const subtitle = headings[1] || report.description || (report.ui?.text || '').slice(0, 160) || 'Nova ne is app ka structure analyse karke waisa hi interface banaya hai.';
  const features = headings.slice(1, 7);
  while (features.length < 6) features.push(`Feature ${features.length + 1}`);
  const esc = (value) => escapeHtmlText(String(value || '')).slice(0, 160);

  const navHtml = links.length
    ? links.map((link) => `<a href="${esc(link.href || '#')}">${esc(link.text || 'Link')}</a>`).join('\n        ')
    : '<a href="#features">Features</a>\n        <a href="#workspace">Workspace</a>';
  const actionsHtml = buttons.slice(0, 4).map((button, index) =>
    `<button class="${index === 0 ? 'primary' : 'ghost'}" data-action="${esc(button)}" type="button">${esc(button)}</button>`).join('\n          ')
    || '<button class="primary" data-action="Get started" type="button">Get started</button>';
  const cardsHtml = features.map((feature, index) =>
    `<article class="card"><span class="card-index">0${index + 1}</span><h3>${esc(feature)}</h3><p>${esc(`Smart workflow for ${feature}`.slice(0, 140))}</p></article>`).join('\n        ');
  const inputsHtml = inputs.length
    ? inputs.map((input) => `<label><span>${esc(input.placeholder || input.name || input.id || 'Field')}</span><input id="${esc(input.id || `field-${Math.random().toString(36).slice(2, 7)}`)}" type="${esc(input.type || 'text')}" placeholder="${esc(input.placeholder || 'Type here')}" /></label>`).join('\n          ')
    : '<label><span>New item</span><input id="itemInput" type="text" placeholder="Add something…" maxlength="140" /></label>';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="logo">N</span><strong>${esc(title)}</strong></div>
    <nav>${navHtml}</nav>
    <button id="themeBtn" class="ghost" type="button">Theme</button>
  </header>
  <main>
    <section class="hero">
      <p class="eyebrow">Nova replica · analysed build</p>
      <h1>${esc(heroTitle)}</h1>
      <p class="subtitle">${esc(subtitle)}</p>
      <div class="actions">${actionsHtml}</div>
    </section>
    <section class="grid" id="features">${cardsHtml}</section>
    <section class="panel" id="workspace">
      <div>
        <h2>Quick workspace</h2>
        <p>Original app ke inputs/actions ko yahin reproduce kiya gaya hai.</p>
      </div>
      <form id="itemForm">
        ${inputsHtml}
        <button class="primary" type="submit">Save</button>
      </form>
      <ul id="list" class="list"></ul>
    </section>
  </main>
  <footer>Built by Nova · source: ${esc(report.source || prompt || 'analysis')}</footer>
  <script src="app.js"></script>
</body>
</html>
`;

  const css = `:root {
  color-scheme: dark;
  --accent: ${accent};
  --bg: ${background};
  --text: ${foreground};
  --card: rgba(127, 127, 127, 0.10);
  --line: rgba(127, 127, 127, 0.22);
  --muted: ${foreground};
}
body.light {
  color-scheme: light;
  --bg: #f5f6f8;
  --text: #16171a;
  --card: #ffffff;
  --line: #e4e6eb;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: ${font};
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 12% -10%, var(--accent), transparent 42%);
  opacity: .16;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 14px clamp(18px, 5vw, 56px);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
}
.brand { display: flex; align-items: center; gap: 10px; margin-right: auto; }
.logo {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
}
nav { display: flex; gap: 16px; }
nav a { color: var(--text); text-decoration: none; opacity: .78; font-size: 14px; }
nav a:hover { opacity: 1; }
main { width: min(1080px, calc(100% - 36px)); margin: 0 auto; padding: 56px 0 40px; }
.hero { max-width: 760px; margin-bottom: 38px; }
.eyebrow { color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
h1 { margin: 10px 0; font-size: clamp(34px, 6vw, 62px); line-height: 1.05; }
.subtitle { max-width: 640px; opacity: .72; font-size: 17px; line-height: 1.6; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
button, input {
  font: inherit;
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 11px 15px;
  background: var(--card);
  color: var(--text);
}
button { cursor: pointer; font-weight: 700; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.card { padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
.card-index { color: var(--accent); font-size: 12px; font-weight: 800; }
.card h3 { margin: 10px 0 6px; font-size: 17px; }
.card p { margin: 0; opacity: .68; font-size: 14px; line-height: 1.5; }
.panel { margin-top: 26px; padding: 24px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); }
.panel h2 { margin: 0 0 6px; }
.panel p { margin: 0 0 18px; opacity: .7; }
#itemForm { display: grid; gap: 12px; max-width: 560px; }
#itemForm label { display: grid; gap: 6px; font-size: 13px; opacity: .85; }
.list { list-style: none; padding: 0; margin: 20px 0 0; display: grid; gap: 8px; }
.list li { display: flex; align-items: center; gap: 10px; padding: 10px 13px; border: 1px solid var(--line); border-radius: 10px; }
.list li.done span { text-decoration: line-through; opacity: .55; }
.list span { flex: 1; overflow-wrap: anywhere; }
.list button { padding: 5px 9px; font-size: 12px; }
footer { padding: 24px; text-align: center; opacity: .55; font-size: 12px; }
@media (max-width: 700px) { nav { display: none; } .topbar { padding: 12px 18px; } }
`;

  const js = `const STORE_KEY = 'nova-replica-items';
const items = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
const list = document.getElementById('list');
const form = document.getElementById('itemForm');
const input = document.getElementById('itemInput') || form?.querySelector('input');
const themeBtn = document.getElementById('themeBtn');

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
  render();
}
function render() {
  if (!list) return;
  list.replaceChildren();
  items.forEach((item, index) => {
    const li = document.createElement('li');
    if (item.done) li.className = 'done';
    const span = document.createElement('span');
    span.textContent = item.text;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = item.done ? 'Undo' : 'Done';
    toggle.onclick = () => { item.done = !item.done; save(); };
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.onclick = () => { items.splice(index, 1); save(); };
    li.append(span, toggle, del);
    list.append(li);
  });
}
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = (input?.value || '').trim();
  if (!value) return;
  items.push({ text: value, done: false, ts: Date.now() });
  if (input) input.value = '';
  save();
});
themeBtn?.addEventListener('click', () => {
  document.body.classList.toggle('light');
});
document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => {
    button.textContent = button.dataset.action + ' ✓';
  });
});
render();
`;

  const notes = [
    `# ${title} — replica notes`,
    '',
    `- Source: ${report.source || prompt || 'analysis report'}`,
    `- Detected stack: ${(report.stack || []).join(', ') || 'unknown'}`,
    `- Headings used: ${headings.slice(0, 8).join(' | ') || 'none'}`,
    `- Buttons used: ${buttons.slice(0, 6).join(' | ') || 'none'}`,
    `- Inputs detected: ${inputs.map((item) => item.placeholder || item.id || item.type).join(' | ') || 'none'}`,
    `- Theme: accent ${accent}, background ${background}, text ${foreground}, font ${font}`,
    '',
    'Generated files: index.html, styles.css, app.js, server.js, README.md.',
    'Run with: node server.js (or ask Nova: "run this app").',
  ].join('\n');

  return {
    'index.html': html,
    'styles.css': css,
    'app.js': js,
    'server.js': `'use strict';\n${NODE_STATIC_SERVER}\n`,
    'README.md': notes,
    'REPLICATION_NOTES.md': notes,
  };
}

async function replicateApp(args, root) {
  const target = safeWorkspacePath(args.targetPath || 'replica-app', root);
  await mkdir(target, { recursive: true });
  let report;
  if (args.reportPath) {
    const reportFile = safeWorkspacePath(args.reportPath, root);
    report = JSON.parse(await readFile(reportFile, 'utf8'));
  } else {
    const { report: analyzed } = await analyzeAppFolder(target, root, { save: false, maxFiles: 80 });
    report = analyzed;
    if (!args.prompt) report.title = path.basename(target);
  }
  if (args.prompt) report.title = String(args.prompt).slice(0, 120);
  const files = replicateFromReport(report, args.prompt, root, target);
  const written = [];
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(target, name);
    await writeFile(full, content, 'utf8');
    written.push(`${name} (${content.length} chars) FILE:${full}`);
  }
  return [
    `Replica app ready: ${target}`,
    `Source analysis: ${report.source || report.title}`,
    ...written,
  ].join('\n');
}

async function compareApps(args, root) {
  const reportFile = safeWorkspacePath(args.reportPath || '', root);
  const original = JSON.parse(await readFile(reportFile, 'utf8'));
  const candidateDir = safeWorkspacePath(args.candidatePath || '', root);
  const { report: candidate } = await analyzeAppFolder(candidateDir, root, { save: false, maxFiles: 200 });
  const originalRoutes = original.routes || [];
  const missingRoutes = originalRoutes.filter((route) => !(candidate.routes || []).includes(route));
  const originalHeadings = (original.ui?.headings || []).filter(Boolean);
  const missingHeadings = originalHeadings.filter((heading) => !(candidate.ui?.headings || []).includes(heading));
  const stackMissing = (original.stack || []).filter((name) => !(candidate.stack || []).includes(name));
  const score = Math.max(0, Math.round(100
    - missingRoutes.length * 4
    - missingHeadings.length * 3
    - stackMissing.length * 6));
  return [
    `Similarity score: ${score}/100`,
    `Original: ${original.title || reportFile}`,
    `Candidate: ${candidate.title || candidateDir}`,
    `Missing routes: ${missingRoutes.slice(0, 15).join(', ') || 'none'}`,
    `Missing headings: ${missingHeadings.slice(0, 15).join(', ') || 'none'}`,
    `Missing stack hints: ${stackMissing.join(', ') || 'none'}`,
    `Next action: ${score < 80 ? 'write_file se missing features add karein, phir compare_apps dobara chalayein.' : 'Ready — start_app aur test_app karke final answer dein.'}`,
  ].join('\n');
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
      name: 'update_memory',
      description: 'Overwrite workspace/memory.md with durable notes so the next chat or a different model resumes exactly where work stopped. Include current goal, decisions, resume point and next steps.',
      parameters: {
        type: 'object',
        properties: { content: { type: 'string' } },
        required: ['content'],
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
      description: 'Create a resumable video editing job. Use this whenever the user asks for a story video, cartoon video, cinematic clip, meme/funny video, or a video for an MP3 song. Always pass durationSeconds inferred from the request (1 minute=60, 3 minutes=180, 6 minutes=360) and keep it in the prompt too. Pick ratio 16:9 or 9:16, infer style/fx/transitions, and pass audioPath when a workspace MP3 is provided.',
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
          durationSeconds: { type: 'number' },
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
      name: 'run_command',
      description: 'Run a CMD/terminal command inside the allowed folder and return stdout, stderr and exit code. Use it for builds, npm, python, node, ffprobe, directory checks and any command the user asks to run. Runs in auto mode without asking permission.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeoutMs: { type: 'number' },
          path: { type: 'string' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_app',
      description: 'Run/test a generated app. Detects npm scripts (dev/start/serve), node entry files or a plain index.html static server. Returns the local URL and log file. Use after writing app files when the user asks to run or test it.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          command: { type: 'string' },
          port: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'test_app',
      description: 'Test a generated app: runs npm test when available, otherwise node --check on JS files, and optionally probes its local URL.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          command: { type: 'string' },
          port: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git',
      description: 'Run git inside the allowed folder. Actions: status, add, commit, push, pull, log, init, remote, sync (commit + push). Use sync after finishing code changes so every stage is pushed.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['status', 'add', 'commit', 'push', 'pull', 'log', 'init', 'remote', 'sync'] },
          path: { type: 'string' },
          message: { type: 'string' },
          branch: { type: 'string' },
          remote: { type: 'string' },
          files: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_login',
      description: 'Log in to GitHub for git push. Uses GitHub CLI web login when installed, or accepts a Personal Access Token and stores it in the Windows Git credential manager. Never echo the token in chat.',
      parameters: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          username: { type: 'string' },
          path: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_app',
      description: 'Built-in REA-style static analysis of any app folder. Detects stack, entry points, routes, APIs, UI headings/buttons/inputs, components, design colors/fonts, assets and project hints. Saves a JSON report. Use this before cloning or modifying an unknown app.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          maxFiles: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_webpage',
      description: 'Analyse a live webpage with the controlled browser: title, headings, buttons, inputs, links, DOM structure, colors, fonts, resources and framework hints. Saves a JSON report and screenshot. Use for website cloning requests.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_binary',
      description: 'Inspect an EXE/DLL/ZIP/binary inside the allowed folder: magic bytes, embedded strings, URLs, paths and DLL imports. Saves a JSON report. Use when the user asks what an app/binary contains.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replicate_app',
      description: 'Generate a working vanilla replica app from an analysis report into a target folder. Uses detected title, headings, buttons, inputs, colors and fonts. Writes index.html, styles.css, app.js, server.js and notes. Follow with start_app/test_app and iterate with write_file.',
      parameters: {
        type: 'object',
        properties: {
          reportPath: { type: 'string' },
          targetPath: { type: 'string' },
          prompt: { type: 'string' },
        },
        required: ['targetPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_apps',
      description: 'Compare an original analysis report with a generated candidate folder and return a similarity score plus missing routes, headings and stack hints. Use after replicating to improve the clone.',
      parameters: {
        type: 'object',
        properties: {
          reportPath: { type: 'string' },
          candidatePath: { type: 'string' },
        },
        required: ['reportPath', 'candidatePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_media',
      description: 'REA-style media probe for an uploaded image, video or audio inside the allowed folder. Returns duration, dimensions, fps and codecs so the agent can plan exact scene timing before editing.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_video_studio_project',
      description: 'One-shot Video Studio agent. Creates a CapCut-style project: writes the story/script, generates narration and images when no uploads are given, applies stacked FFmpeg FX, 58 available transitions, 10 beat visualizers, background music and audio FX, then renders the final MP4 with autosave/resume. Set durationSeconds exactly (180/300/360).',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          category: { type: 'string' },
          durationSeconds: { type: 'number' },
          ratio: { type: 'string' },
          sourceAssets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                kind: { type: 'string' },
                name: { type: 'string' },
                duration: { type: 'number' },
              },
              required: ['path'],
            },
          },
          audioPath: { type: 'string' },
          bgmPath: { type: 'string' },
          fx: { type: 'array', items: { type: 'string' } },
          transitions: { type: 'array', items: { type: 'string' } },
          visualizers: { type: 'array', items: { type: 'string' } },
          audioFx: { type: 'array', items: { type: 'string' } },
          bpm: { type: 'number' },
          narration: { type: 'boolean' },
          voice: { type: 'string' },
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
  create_video_studio_project: 'Video Studio agent — story, FX, timeline aur render…',
  analyze_media: 'Media probe kar ke timeline plan kar rahe hain…',
  run_command: 'Running CMD command…',
  start_app: 'Starting the built app…',
  test_app: 'Testing the built app…',
  git: 'Running git…',
  github_login: 'Opening GitHub login…',
  analyze_app: 'Analysing app structure…',
  analyze_webpage: 'Analysing live webpage…',
  analyze_binary: 'Inspecting binary/app file…',
  replicate_app: 'Generating replica app…',
  compare_apps: 'Comparing replica with original…',
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

function runCommand(command, args, timeoutMs = 20_000, cwd = WORKSPACE, input = null, env = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, env });
    if (input != null) child.stdin?.end(String(input));
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
      `--user-data-dir=${BROWSER_PROFILE}`,
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

    const first = await waitForPageValue(bingImageUrlsScript(previousSrcs, 1), 120_000, imagePageEvaluate);
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
          signal: AbortSignal.timeout(45_000),
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
      geminiTts: Boolean(geminiToken),
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
    if (!kind || kind === 'gemini') geminiToken = '';
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
  if (body.geminiToken) geminiToken = String(body.geminiToken).trim().slice(0, 300);
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

    if (name === 'update_memory') {
      const content = await writeWorkingMemory(args.content ?? '');
      return `Working memory updated (${content.length} characters): ${MEMORY_FILE}`;
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

    if (name === 'run_command') {
      const command = String(args.command || '').trim();
      if (!command) return 'Error: command required hai.';
      if (DESTRUCTIVE_COMMAND.test(command)) {
        return 'Error: ye system-level destructive command block hai. App folder ke andar kaam karein.';
      }
      const dir = args.path ? safeWorkspacePath(args.path, root) : root;
      const timeout = Math.min(180_000, Math.max(1000, Number(args.timeoutMs) || 30_000));
      const shell = process.platform === 'win32';
      const result = await runCommand(
        shell ? 'cmd.exe' : 'sh',
        shell ? ['/d', '/s', '/c', command] : ['-c', command],
        timeout,
        dir,
      );
      return [
        `CMD (${dir}): ${command}`,
        result.out ? `STDOUT:\n${result.out}` : '',
        result.err ? `STDERR:\n${result.err}` : '',
        `EXIT: ${result.code ?? 'killed'}`,
      ].filter(Boolean).join('\n');
    }

    if (name === 'start_app') {
      const dir = args.path ? safeWorkspacePath(args.path, root) : root;
      const info = await stat(dir);
      const cwd = info.isDirectory() ? dir : path.dirname(dir);
      const port = Math.min(65535, Math.max(1, Number(args.port) || 4173));
      const plan = await resolveAppCommand(cwd, args, port);
      const log = path.join(cwd, 'nova-app.log');
      const logFd = openSync(log, 'a');
      const child = spawn(plan.command, plan.args, {
        cwd,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env, PORT: String(port) },
      });
      closeSync(logFd);
      child.unref();
      agentAppProcesses.set(cwd, { pid: child.pid, port, log, command: plan.label, startedAt: Date.now() });
      await sleep(1800);
      const reachable = await probeLocalUrl(port);
      return [
        `App started: ${plan.label} (pid ${child.pid}).`,
        reachable ? `APP_URL:http://localhost:${port}` : `Server abhi response nahi de raha — log check karein.`,
        `FILE:${log}`,
      ].join('\n');
    }

    if (name === 'test_app') {
      const dir = args.path ? safeWorkspacePath(args.path, root) : root;
      const info = await stat(dir);
      const cwd = info.isDirectory() ? dir : path.dirname(dir);
      const lines = [`Test folder: ${cwd}`];
      const format = (result) => [
        result.out ? result.out : '',
        result.err ? `STDERR: ${result.err}` : '',
        `EXIT: ${result.code ?? 'killed'}`,
      ].filter(Boolean).join('\n');
      if (String(args.command || '').trim()) {
        const command = String(args.command).trim();
        const shell = process.platform === 'win32';
        lines.push(format(await runCommand(
          shell ? 'cmd.exe' : 'sh',
          shell ? ['/d', '/s', '/c', command] : ['-c', command],
          120_000,
          cwd,
        )));
      } else {
        const scripts = await packageScripts(cwd);
        if (scripts.test) {
          lines.push(`npm test:`, format(await runCommand(
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['test'],
            120_000,
            cwd,
          )));
        } else {
          const files = await listScriptFiles(cwd);
          if (!files.length) lines.push('Koi JS file nahi mili; index.html/static app check karein.');
          for (const file of files) {
            const result = await runCommand(process.execPath, ['--check', file], 20_000, cwd);
            lines.push(`${path.relative(cwd, file)}: ${result.code === 0 ? 'syntax OK' : `FAIL — ${result.err.slice(0, 300)}`}`);
          }
        }
      }
      if (args.port) {
        const port = Number(args.port);
        lines.push(await probeLocalUrl(port)
          ? `APP_URL:http://localhost:${port} — app response de raha hai.`
          : `Port ${port} par app nahi mila.`);
      }
      return lines.join('\n');
    }

    if (name === 'git') {
      const dir = args.path ? safeWorkspacePath(args.path, root) : root;
      const info = await stat(dir);
      const cwd = info.isDirectory() ? dir : path.dirname(dir);
      const action = String(args.action || 'status').toLowerCase();
      const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
      const run = (gitArgs, timeout = 60_000) => runCommand('git', gitArgs, timeout, cwd, null, env);
      const format = (result) => [
        result.out ? result.out : '',
        result.err ? `STDERR: ${result.err}` : '',
        `EXIT: ${result.code ?? 'killed'}`,
      ].filter(Boolean).join('\n');
      const addFiles = async () => {
        const files = String(args.files || '').trim();
        return format(await run(files ? ['add', ...files.split(/\s+/)] : ['add', '-A']));
      };
      const push = async () => {
        const remote = String(args.remote || 'origin').trim();
        const branch = String(args.branch || '').trim();
        return format(await run(['push', '-u', remote, branch || 'HEAD'], 180_000));
      };
      if (action === 'status') return format(await run(['status', '--short', '--branch']));
      if (action === 'add') return await addFiles();
      if (action === 'commit' || action === 'sync') {
        const message = String(args.message || '').trim();
        if (!message) return 'Error: commit message required hai.';
        const results = [await addFiles(), format(await run(['commit', '-m', message], 120_000))];
        if (action === 'sync') results.push(await push());
        return results.join('\n\n');
      }
      if (action === 'push') return await push();
      if (action === 'pull') return format(await run(['pull'], 120_000));
      if (action === 'log') return format(await run(['log', '--oneline', '-n', '12']));
      if (action === 'init') return format(await run(['init']));
      if (action === 'remote') {
        const url = String(args.url || '').trim();
        if (url) return format(await run(['remote', 'add', 'origin', url]));
        return format(await run(['remote', '-v']));
      }
      return `Unknown git action: ${action}`;
    }

    if (name === 'github_login') {
      const dir = args.path ? safeWorkspacePath(args.path, root) : root;
      const info = await stat(dir);
      const cwd = info.isDirectory() ? dir : path.dirname(dir);
      const token = String(args.token || '').trim();
      const username = String(args.username || 'x-access-token').trim();
      if (token) {
        const input = `protocol=https\nhost=github.com\nusername=${username}\npassword=${token}\n\n`;
        const approve = await runCommand('git', ['credential', 'approve'], 15_000, cwd, input);
        if (approve.code !== 0) return `GitHub login save nahi hua: ${approve.err || approve.out || 'git credential error'}`;
        await runCommand('git', ['config', '--global', 'credential.helper', 'manager'], 10_000, cwd);
        return 'GitHub PAT Windows credential manager me save ho gaya. Ab git push auto chalega — token chat me nahi dikhaya gaya.';
      }
      const ghVersion = await runCommand('gh', ['--version'], 8000, cwd);
      if (ghVersion.code === 0) {
        const log = path.join(WORKSPACE, 'github-login.log');
        const logFd = openSync(log, 'a');
        const child = spawn('gh', [
          'auth', 'login', '--web', '--git-protocol', 'https', '--hostname', 'github.com',
        ], { cwd, detached: true, windowsHide: true, stdio: ['ignore', logFd, logFd] });
        closeSync(logFd);
        child.unref();
        await sleep(6000);
        const text = await readFile(log, 'utf8').catch(() => '');
        const code = /([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(text)?.[1];
        return [
          'GitHub CLI se web login shuru ho gaya.',
          code ? `One-time code: ${code}` : 'Code terminal log me hai; browser me device login confirm karein.',
          'OPEN:https://github.com/login/device',
          `FILE:${log}`,
        ].join('\n');
      }
      return [
        'GitHub CLI installed nahi hai. Do tarike hain:',
        '1) Browser me GitHub login karke PAT banayein (repo permission), phir mujhe bolein: github login <token>',
        '2) GitHub CLI install karein — main automatic web login chala dunga.',
        'OPEN:https://github.com/settings/tokens',
      ].join('\n');
    }

    if (name === 'analyze_app') {
      const dir = safeWorkspacePath(args.path || '', root);
      const { report, file } = await analyzeAppFolder(dir, root, {
        maxFiles: Number(args.maxFiles) || 400,
      });
      return [
        `APP ANALYSIS — ${dir}`,
        `Title: ${report.title}`,
        `Stack: ${(report.stack || []).join(', ') || 'unknown'}`,
        `Entries: ${(report.entryPoints || []).join(', ') || 'none'}`,
        `Routes: ${(report.routes || []).slice(0, 40).join(', ') || 'none'}`,
        `Headings: ${(report.ui?.headings || []).slice(0, 20).join(' | ') || 'none'}`,
        `Buttons: ${(report.ui?.buttons || []).slice(0, 20).join(' | ') || 'none'}`,
        `Inputs: ${(report.ui?.inputs || []).map((item) => item.placeholder || item.id || item.type).slice(0, 12).join(' | ') || 'none'}`,
        `Colors: ${(report.design?.colors || []).slice(0, 12).join(', ') || 'none'}`,
        `Font: ${report.design?.fonts?.[0] || 'default'}`,
        `Hints: ${JSON.stringify(report.hints || {})}`,
        file ? `FILE:${file}` : '',
        `FULL_REPORT:${JSON.stringify(report).slice(0, 24_000)}`,
      ].filter(Boolean).join('\n');
    }

    if (name === 'analyze_webpage') {
      const { report, file } = await analyzeWebPage(args.url, root);
      return [
        `WEBPAGE ANALYSIS — ${report.source}`,
        `Title: ${report.title}`,
        `Description: ${report.description || 'none'}`,
        `Framework hints: ${(report.stack || []).join(', ') || 'vanilla'}`,
        `Headings: ${(report.ui?.headings || []).slice(0, 20).join(' | ') || 'none'}`,
        `Buttons: ${(report.ui?.buttons || []).slice(0, 20).join(' | ') || 'none'}`,
        `Inputs: ${(report.ui?.inputs || []).map((item) => item.placeholder || item.name || item.id || item.tag).slice(0, 12).join(' | ') || 'none'}`,
        `Links: ${(report.ui?.links || []).slice(0, 15).map((link) => link.href).join(', ') || 'none'}`,
        `Colors: ${(report.design?.colors || []).slice(0, 12).join(', ') || 'none'}`,
        `Font: ${report.design?.font || 'default'}`,
        `FILE:${file}`,
        `FULL_REPORT:${JSON.stringify(report).slice(0, 24_000)}`,
      ].join('\n');
    }

    if (name === 'analyze_binary') {
      const { report, file } = await analyzeBinaryFile(args.path, root);
      return [
        `BINARY ANALYSIS — ${report.source}`,
        `Format: ${report.format} · size ${report.size} bytes · magic ${report.magic}`,
        `URLs: ${(report.urls || []).slice(0, 15).join(', ') || 'none'}`,
        `Paths: ${(report.paths || []).slice(0, 15).join(', ') || 'none'}`,
        `DLL imports: ${(report.dlls || []).join(', ') || 'none'}`,
        `Strings: ${(report.strings || []).slice(0, 30).join(' | ')}`,
        `FILE:${file}`,
      ].join('\n');
    }

    if (name === 'replicate_app') {
      return await replicateApp(args, root);
    }

    if (name === 'compare_apps') {
      return await compareApps(args, root);
    }

    if (name === 'analyze_media') {
      const info = await analyzeStudioMedia(args.path || '');
      return [
        `MEDIA ANALYSIS — ${info.name}`,
        `Kind: ${info.kind || 'unknown'} · ${info.size} bytes`,
        `Duration: ${info.duration ? `${info.duration.toFixed(2)}s` : 'n/a'}`,
        info.width ? `Video: ${info.width}x${info.height} @ ${info.fps}` : '',
        info.videoCodec ? `Video codec: ${info.videoCodec}` : '',
        info.audioCodec ? `Audio codec: ${info.audioCodec} · ${info.sampleRate || 'n/a'} Hz` : '',
        `PATH:${info.path}`,
      ].filter(Boolean).join('\n');
    }

    if (name === 'create_video_studio_project') {
      const category = String(args.category || '').toLowerCase().trim();
      const promptText = String(args.prompt || '').trim();
      if (!promptText) return 'Error: video prompt required hai.';
      const duration = Math.min(900, Math.max(15, Number(args.durationSeconds) || 60));
      const preset = VIDEO_STUDIO_PRESETS.find((item) => category.includes(item.id))
        || VIDEO_STUDIO_PRESETS.find((item) => category === 'cartoon' && item.id === 'cartoon')
        || VIDEO_STUDIO_PRESETS[0];
      const type = /cartoon|anime|comic/.test(category) ? 'cartoon'
        : /comedy|meme|funny/.test(category) ? 'meme'
          : /music|song|gaana/.test(category) ? 'song' : 'story';
      const style = /cartoon|anime|comic/.test(category) ? 'cartoon'
        : /comedy|meme|funny/.test(category) ? 'meme' : 'cinematic';
      const job = await createMediaJob({
        prompt: `${duration} second ${category || 'cinematic'} pro video. ${promptText}`,
        chatId: args.chatId,
        type,
        category,
        style,
        studio: true,
        durationSeconds: duration,
        ratio: args.ratio === '9:16' ? '9:16' : '16:9',
        sourceAssets: args.sourceAssets || [],
        audioPath: args.audioPath || null,
        bgmPath: args.bgmPath || null,
        fx: Array.isArray(args.fx) && args.fx.length ? args.fx : preset.fx,
        transitions: Array.isArray(args.transitions) && args.transitions.length ? args.transitions : preset.transitions,
        visualizers: Array.isArray(args.visualizers) && args.visualizers.length ? args.visualizers : preset.visualizers,
        audioFx: args.audioFx || [],
        bpm: Number(args.bpm) || 0,
        narration: args.narration !== false,
        voice: args.voice || '',
        useAiVideo: false,
      });
      return `VIDEO STUDIO STARTED — job ${job.id}. ${job.durationSeconds}s · ${job.sceneCount} scenes · ${(job.fx || []).length} FX · ${(job.transitions || []).length} transitions · ${(job.visualizers || []).length} visualizers. Autosave ON — band karke dobara kholein to yahin se resume hoga. Sidebar me Done/Remaining live dikhega.`;
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

async function agentSystem(modes, customSystem = '', root = WORKSPACE, autoMode = true) {
  const toolNames = AGENT_TOOLS.map((tool) => tool.function.name).join(', ');
  return [
    BASE_PERSONA,
    await memoryContext(),
    customSystem ? `Additional user instructions: ${customSystem}` : '',
    `Allowed folder for all filesystem tools: ${root}. Never access paths outside it.`,
    `Current date: ${new Date().toISOString().slice(0, 10)}.`,
    'You are an AGENT. Complete the user\'s request end-to-end instead of only explaining how. Use tools whenever the task needs fresh information, files, code execution, or generated images, and keep using them until the task is actually done.',
    'CODE RULE: For any request to create/fix an app, website, code file, script or project, ALWAYS call write_file (and create_folder when needed). Write real complete files into the allowed folder. If the folder is empty, scaffold the whole project. Never only describe or paste code in chat without saving it.',
    'IMAGE RULE: For any image request call generate_image. Prefer provider auto (Bing first, then Cloudflare Flux, then Hugging Face Flux). Never use Pollinations — the user disabled it because of poor quality.',
    'VIDEO RULE: If the user asks for any video — story, cartoon, cinematic, meme/funny, or a video from an MP3 song — call create_media_job, never just describe it. Convert the requested length into durationSeconds (6 minutes = 360, 5 minutes = 300, 3 minutes = 180) and repeat the same length at the top of the prompt. Never leave durationSeconds unset for a timed request. Infer style (cinematic/cartoon/meme/anime/realistic), fx and transitions. Use ratio 9:16 for reels/stories/short-form and 16:9 for normal video. If the user attached an MP3, pass its workspace audioPath. If the user named main characters, include a CHARACTER LOCK line in the prompt with their exact unchanging appearance. Default video provider is ltx (free open-source); Pollinations is disabled.',
    'VIDEO STUDIO RULE: For any request that says "video studio", "pro editor", "CapCut-like", "edit this uploaded video/image/MP3", or asks for stacked FX/transitions/visualizers, call create_video_studio_project instead of plain create_media_job. One command must handle the whole job: first analyze_media for every uploaded path, then create_video_studio_project with exact durationSeconds, category, sourceAssets, audioPath/bgmPath, fx, transitions, 10-type beat visualizers and narration. Never ask the user to choose each effect. The job autosaves every scene; if it already has completed scenes, resuming must continue from the next unfinished scene, never restart from scene 1.',
    autoMode
      ? 'AUTO MODE (full permission): The user enabled OpenCode-style auto mode. When asked to run/test a built app, run CMD commands, check git, commit/push or log in to GitHub, call run_command/start_app/test_app/git/github_login directly. Do not ask for confirmation and do not merely print commands.'
      : 'Permission mode: ask before running shell commands, starting apps or pushing to git.',
    'REA RULE: For clone/replicate/rebuild/similar-app requests, NEVER guess. First call analyze_app for a folder, analyze_webpage for a URL, or analyze_binary for an EXE/DLL. Then call replicate_app with the saved report, use write_file to add missing features, and finish with start_app + test_app. Use compare_apps to measure similarity and iterate until the score is high.',
    'MEMORY RULE: The working memory above is the single source of truth for unfinished work. Before starting, read it and continue from the exact resume point instead of asking the user to repeat. When you make a durable decision, finish a stage, or leave work unfinished, call update_memory to rewrite workspace/memory.md with: current goal, decisions, exact resume point and next steps. Keep it short and factual.',
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
    { role: 'system', content: await agentSystem(modes, payload.system, root, payload.autoMode !== false) },
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
          const needsChatId = ['create_media_job', 'create_video_studio_project'].includes(call.name);
          const toolArgs = needsChatId && !call.args.chatId && payload.chatId
            ? { ...call.args, chatId: payload.chatId }
            : call.args;
          const result = await runTool(call.name, toolArgs, root);
          results.push(`${call.name}: ${result}`);
          for (const fileMatch of result.matchAll(/FILE:(.+)$/gm)) {
            const fullPath = fileMatch[1].trim();
            try {
              sse(res, {
                type: 'file',
                path: path.relative(root, fullPath).replace(/\\/g, '/'),
                url: `/api/file?path=${encodeURIComponent(fullPath)}`,
              });
            } catch { /* skip paths outside root */ }
          }
          const openUrl = result.startsWith('OPEN:')
            ? result.slice(5).trim()
            : result.match(/APP_URL:(\S+)/)?.[1];
          if (openUrl) {
            sse(res, { type: 'open_url', url: openUrl });
          }
          if (call.name === 'generate_image') {
            const match = /(\/api\/imagine\?[^\s]+)/.exec(result);
            if (match) sse(res, { type: 'image', url: match[1] });
          }
          if (call.name === 'create_media_job' || call.name === 'create_video_studio_project') {
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
      [...text.matchAll(/(?:^|\n)\s*[VASD.]{6}\s+([A-Za-z0-9_-]+)/g)].map((match) => match[1]),
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

async function probeAudioDuration(inputPath) {
  const bin = await ffmpegExecutable('ffprobe');
  if (!bin || !inputPath) return 0;
  const result = await runCommand(bin, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ], 30_000);
  const value = Number.parseFloat(String(result.out || '').trim().split(/\r?\n/)[0]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/* ---------------------------- video studio catalog --------------------------- */

const VIDEO_STUDIO_TRANSITIONS = [
  'fade', 'fadeblack', 'fadewhite', 'fadefast', 'fadeslow', 'fadegrays', 'dissolve',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'wipetl', 'wipetr', 'wipebl', 'wipebr',
  'slideleft', 'slideright', 'slideup', 'slidedown', 'smoothleft', 'smoothright',
  'smoothup', 'smoothdown', 'circleopen', 'circleclose', 'circlecrop', 'rectcrop',
  'horzopen', 'horzclose', 'vertopen', 'vertclose', 'diagtl', 'diagtr', 'diagbl', 'diagbr',
  'hlslice', 'hrslice', 'vuslice', 'vdslice', 'hlwind', 'hrwind', 'vuwind', 'vdwind',
  'hblur', 'pixelize', 'distance', 'radial', 'squeezeh', 'squeezev', 'zoomin',
  'coverleft', 'coverright', 'coverup', 'coverdown', 'revealleft', 'revealright',
  'revealup', 'revealdown',
];

const VIDEO_STUDIO_FX = [
  'cinematic', 'vibrant', 'noir', 'vintage', 'glow', 'dreamy', 'neon', 'glitch',
  'filmgrain', 'sharpen', 'softblur', 'mirror', 'chromatic', 'dramatic', 'matrix',
  'sunset', 'cool', 'vhs', 'pixelate', 'shake', 'vignette', 'fade', 'fastcut', 'slowmo',
];

const VIDEO_STUDIO_VISUALIZERS = [
  { id: 'bounce', label: 'Beat bounce' },
  { id: 'flicker', label: 'Beat flicker' },
  { id: 'pulse', label: 'Pulse frame' },
  { id: 'eqbars', label: 'Equalizer bars' },
  { id: 'orbit', label: 'Orbit dots' },
  { id: 'glitch', label: 'Glitch slices' },
  { id: 'sparkle', label: 'Sparkle rain' },
  { id: 'glowpulse', label: 'Glow pulse' },
  { id: 'chroma', label: 'Chromatic flash' },
  { id: 'wavelength', label: 'Wave lines' },
];

const VIDEO_STUDIO_PRESETS = [
  { id: 'hollywood', label: 'Hollywood magical', fx: ['cinematic', 'glow', 'sharpen'], transitions: ['zoomin', 'fadeblack', 'dissolve'], visualizers: ['bounce', 'glowpulse'] },
  { id: 'cartoon', label: 'Cartoon pop', fx: ['vibrant', 'sharpen'], transitions: ['slideleft', 'zoomin', 'circleopen'], visualizers: ['bounce', 'sparkle'] },
  { id: 'comedy', label: 'Comedy quick-cut', fx: ['vibrant', 'glitch'], transitions: ['fadefast', 'pixelize', 'wipeleft'], visualizers: ['flicker', 'glitch'] },
  { id: 'science', label: 'Science fiction', fx: ['neon', 'chromatic', 'glow'], transitions: ['radial', 'hblur', 'fadewhite'], visualizers: ['chroma', 'orbit'] },
  { id: 'emotional', label: 'Emotional story', fx: ['cinematic', 'softblur'], transitions: ['fadeslow', 'dissolve', 'fadeblack'], visualizers: ['pulse'] },
  { id: 'music', label: 'Music video', fx: ['neon', 'glow', 'chromatic'], transitions: ['wiperight', 'zoomin', 'hlwind'], visualizers: ['eqbars', 'wavelength'] },
];

function videoStudioCatalog() {
  return {
    fx: VIDEO_STUDIO_FX,
    transitions: VIDEO_STUDIO_TRANSITIONS,
    visualizers: VIDEO_STUDIO_VISUALIZERS,
    presets: VIDEO_STUDIO_PRESETS,
    categories: ['story', 'cartoon', 'comedy', 'science fiction', 'music', 'ad / promo', 'documentary'],
    ratios: ['16:9', '9:16'],
    note: 'Sab effects local FFmpeg se render hote hain — koi paid plugin nahi.',
  };
}

async function analyzeStudioMedia(filePath) {
  const abs = resolveJobAudioPath(filePath);
  if (!abs) throw new Error('File allowed folder ke bahar hai. Pehle Studio me upload karein.');
  await access(abs);
  const bin = await ffmpegExecutable('ffprobe');
  const info = { path: path.relative(WORKSPACE, abs).replace(/\\/g, '/'), name: path.basename(abs), size: (await stat(abs)).size };
  if (!bin) return { ...info, available: false, reason: 'FFprobe unavailable.' };
  const result = await runCommand(bin, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', abs], 30_000);
  let probe = {};
  try { probe = JSON.parse(String(result.out || '').trim() || '{}'); } catch { probe = {}; }
  const video = (probe.streams || []).find((stream) => stream.codec_type === 'video');
  const audio = (probe.streams || []).find((stream) => stream.codec_type === 'audio');
  return {
    ...info,
    available: true,
    kind: video ? 'video' : (audio ? 'audio' : 'image'),
    duration: Number(probe.format?.duration) || 0,
    width: Number(video?.width) || 0,
    height: Number(video?.height) || 0,
    fps: String(video?.avg_frame_rate || '0/1'),
    videoCodec: video?.codec_name || null,
    audioCodec: audio?.codec_name || null,
    sampleRate: Number(audio?.sample_rate) || 0,
  };
}

function normalizeStudioAssets(input = []) {
  const list = Array.isArray(input) ? input : [];
  return list.map((item) => {
    const raw = typeof item === 'string' ? item : item?.path;
    const abs = resolveJobAudioPath(raw);
    if (!abs) return null;
    const extension = path.extname(abs).toLowerCase();
    const requested = String(item?.kind || '').toLowerCase();
    let kind = requested;
    if (!['image', 'video', 'audio'].includes(kind)) {
      if (/\.(png|jpe?g|webp|gif|bmp)$/.test(extension)) kind = 'image';
      else if (/\.(mp4|mov|mkv|webm|avi|m4v)$/.test(extension)) kind = 'video';
      else kind = 'audio';
    }
    return {
      kind,
      path: path.relative(WORKSPACE, abs).replace(/\\/g, '/'),
      name: String(item?.name || path.basename(abs)).slice(0, 180),
      duration: Number(item?.duration) || 0,
    };
  }).filter(Boolean).slice(0, 60);
}

function sceneCountForDuration(durationSeconds, bpm = 0, manual = 0) {
  if (manual > 0) return Math.min(60, Math.max(6, Math.round(manual)));
  const secondsPerScene = bpm > 0
    ? Math.max(5, Math.min(9, (60 / bpm) * 4))
    : Math.max(5, Math.min(10, durationSeconds / 24));
  return Math.min(60, Math.max(12, Math.ceil(durationSeconds / secondsPerScene)));
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

const VOICE_PRESETS = {
  auto: { gemini: 'Kore', openai: 'alloy', sapi: 'Microsoft Hazel Desktop' },
  male: { gemini: 'Charon', openai: 'onyx', sapi: 'Microsoft David Desktop' },
  deep: { gemini: 'Charon', openai: 'onyx', sapi: 'Microsoft David Desktop' },
  female: { gemini: 'Kore', openai: 'nova', sapi: 'Microsoft Hazel Desktop' },
  warm: { gemini: 'Aoede', openai: 'shimmer', sapi: 'Microsoft Hazel Desktop' },
  child: { gemini: 'Puck', openai: 'alloy', sapi: 'Microsoft Zira Desktop' },
  bright: { gemini: 'Galaxy', openai: 'alloy', sapi: 'Microsoft Zira Desktop' },
};

function resolveVoicePreset(rawVoice) {
  const value = String(rawVoice || '').trim();
  const match = /^(gemini|openai|sapi):(.+)$/i.exec(value);
  if (match) {
    const provider = match[1].toLowerCase();
    const name = match[2].trim();
    return {
      provider,
      name,
      gemini: provider === 'gemini' ? name : VOICE_PRESETS.auto.gemini,
      openai: provider === 'openai' ? name : VOICE_PRESETS.auto.openai,
      sapi: provider === 'sapi' ? name : VOICE_PRESETS.auto.sapi,
    };
  }
  const key = value.toLowerCase();
  if (/child|kid|bacha|bachcha/.test(key)) return { provider: 'auto', ...VOICE_PRESETS.child };
  if (/deep|dark|heavy/.test(key)) return { provider: 'auto', ...VOICE_PRESETS.deep };
  if (/male|mard|husband/.test(key)) return { provider: 'auto', ...VOICE_PRESETS.male };
  if (/warm|soft|calm/.test(key)) return { provider: 'auto', ...VOICE_PRESETS.warm };
  if (/female|women|woman|girl/.test(key)) return { provider: 'auto', ...VOICE_PRESETS.female };
  if (VOICE_PRESETS[key]) return { provider: 'auto', ...VOICE_PRESETS[key] };
  return { provider: 'auto', ...VOICE_PRESETS.auto, sapi: value || VOICE_PRESETS.auto.sapi };
}

function localVoiceName(rawVoice) {
  return resolveVoicePreset(rawVoice).sapi;
}

/* Microsoft Edge neural TTS — free, no API key, natural male/female voices.
   Science: signed Sec-MS-GEC v2 token + raw TLS WebSocket read-aloud protocol. */
const EDGE_TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_TTS_HOST = 'speech.platform.bing.com';
const EDGE_TTS_PATH = '/consumer/speech/synthesize/readaloud/edge/v1';
const EDGE_CHROMIUM_VERSION = '143.0.3650.75';
const EDGE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const EDGE_TOKEN_PREFIX = 'Copyright (C) Microsoft Corporation. All rights reserved.';
const EDGE_WINDOWS_EPOCH_S = 11644473600n;

function edgeRol16(value) {
  return ((value << 16) | (value >>> 16)) >>> 0;
}

function edgeSwapTerm(word, key, [a, b, c]) {
  const sum = Math.imul(word, key) + Math.imul(edgeRol16(word), a);
  const product = Math.imul(edgeRol16(sum), b) >>> 0;
  return (Math.imul(edgeRol16(product), c) + product) >>> 0;
}

function edgeMixTerm(value, multipliers) {
  let result = value;
  for (const multiplier of multipliers) result = Math.imul(edgeRol16(result), multiplier) >>> 0;
  return result;
}

function edgeChecksum(message, digest) {
  const firstKey = (digest.readUInt32LE(0) | 1) >>> 0;
  const secondKey = (digest.readUInt32LE(4) | 1) >>> 0;
  const padded = Buffer.alloc(Math.ceil(message.length / 8) * 8);
  padded.set(message);
  let swapSum = 0;
  let lastSwap = 0;
  let mix = 0;
  let mixSum = 0;
  for (let offset = 0; offset < padded.length; offset += 8) {
    const word1 = padded.readUInt32LE(offset);
    const word2 = padded.readUInt32LE(offset + 4);
    const swap = edgeSwapTerm(word1, firstKey, [0xef0569fb, 0x76f50f34, 0xc3efea97]);
    lastSwap = edgeSwapTerm(word2, secondKey, [0xc31713db, 0x1881ce3c, 0x35bd1ec9]);
    swapSum = (swapSum + swap + lastSwap) >>> 0;
    mix = edgeMixTerm(Math.imul(mix + word1, firstKey), [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83]);
    mixSum = (mixSum + mix) >>> 0;
    mix = edgeMixTerm(Math.imul(mix + word2, secondKey), [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69]);
    mixSum = (mixSum + mix) >>> 0;
  }
  const out = Buffer.alloc(8);
  out.writeUInt32LE((lastSwap ^ mix) >>> 0, 0);
  out.writeUInt32LE((swapSum ^ mixSum) >>> 0, 4);
  return out;
}

function edgeSecMsGec(now = new Date()) {
  const seconds = BigInt(Math.floor(now.getTime() / 1000)) + EDGE_WINDOWS_EPOCH_S;
  const ticks = (seconds - (seconds % 300n)) * 10_000_000n;
  const message = Buffer.from(`${EDGE_TOKEN_PREFIX}${ticks}${EDGE_TTS_TOKEN}`, 'ascii');
  const digest = createHash('sha256').update(message).digest();
  return `${edgeChecksum(message, digest).toString('hex')}-${digest.toString('hex')}`.toUpperCase();
}

function edgeFrame(headers, body) {
  const lines = Object.entries({ 'X-Timestamp': new Date().toISOString(), ...headers })
    .map(([key, value]) => `${key}:${value}`);
  return `${lines.join('\r\n')}\r\n\r\n${body}`;
}

function edgeEscapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[char]);
}

function edgeClientFrame(opcode, payload) {
  const data = Buffer.from(payload);
  const mask = randomBytes(4);
  const length = data.length;
  let head;
  if (length < 126) {
    head = Buffer.alloc(2);
    head[1] = 0x80 | length;
  } else if (length < 65536) {
    head = Buffer.alloc(4);
    head[1] = 0x80 | 126;
    head.writeUInt16BE(length, 2);
  } else {
    head = Buffer.alloc(10);
    head[1] = 0x80 | 127;
    head.writeBigUInt64BE(BigInt(length), 2);
  }
  head[0] = 0x80 | opcode;
  const masked = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) masked[index] = data[index] ^ mask[index % 4];
  return Buffer.concat([head, mask, masked]);
}

function edgeParseFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    const fin = Boolean(buffer[offset] & 0x80);
    const masked = Boolean(buffer[offset + 1] & 0x80);
    let length = buffer[offset + 1] & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    let mask = null;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }
    if (cursor + length > buffer.length) break;
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
    if (mask) {
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    }
    frames.push({ opcode, fin, payload });
    offset = cursor + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}

function edgeVoiceFor(rawVoice, text) {
  const preset = resolveVoicePreset(rawVoice);
  const voiceName = String(preset.gemini || '').toLowerCase();
  const devanagari = (String(text).match(/[\u0900-\u097F]/g) || []).length;
  const hindi = devanagari >= 8;
  const child = /puck|galaxy|child|bright/.test(voiceName);
  const male = /charon|deep|male/.test(voiceName);
  if (hindi) {
    return {
      name: male ? 'hi-IN-MadhurNeural' : 'hi-IN-SwaraNeural',
      pitch: child ? '+28Hz' : '+0Hz',
      rate: child ? '+5%' : '+2%',
      volume: '+8%',
      language: 'hi-IN',
    };
  }
  return {
    name: male ? 'en-US-GuyNeural' : (child ? 'en-US-JennyNeural' : 'en-US-AriaNeural'),
    pitch: child ? '+24Hz' : '+0Hz',
    rate: child ? '+5%' : '+1%',
    volume: '+6%',
    language: 'en-US',
  };
}

function edgeTextChunks(text, maxLength = 1200) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?।])\s+/);
  const grouped = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && candidate.length > maxLength) {
      grouped.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) grouped.push(current);
  const chunks = [];
  for (const group of grouped) {
    if (group.length <= maxLength) {
      chunks.push(group);
      continue;
    }
    for (let index = 0; index < group.length; index += maxLength) {
      chunks.push(group.slice(index, index + maxLength));
    }
  }
  return chunks;
}

async function edgeSpeakChunk(text, style) {
  const connectionId = randomUUID().replace(/-/g, '');
  const query = new URLSearchParams({
    TrustedClientToken: EDGE_TTS_TOKEN,
    ConnectionId: connectionId,
    'Sec-MS-GEC': edgeSecMsGec(),
    'Sec-MS-GEC-Version': `2-${EDGE_CHROMIUM_VERSION}`,
  });
  const key = randomBytes(16).toString('base64');
  const major = EDGE_CHROMIUM_VERSION.split('.')[0];
  const requestHeaders = [
    `GET ${EDGE_TTS_PATH}?${query} HTTP/1.1`,
    `Host: ${EDGE_TTS_HOST}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    'Pragma: no-cache',
    'Cache-Control: no-cache',
    'Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 Edg/${major}.0.0.0`,
    'Accept-Encoding: gzip, deflate, br, zstd',
    'Accept-Language: en-US,en;q=0.9',
    '', '',
  ];
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${style.language}'>`
    + `<voice name='${style.name}'><prosody pitch='${style.pitch}' rate='${style.rate}' volume='${style.volume}'>`
    + `${edgeEscapeXml(text)}</prosody></voice></speak>`;

  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: EDGE_TTS_HOST, port: 443, servername: EDGE_TTS_HOST }, () => {
      socket.write(requestHeaders.join('\r\n'));
      socket.write(edgeClientFrame(1, edgeFrame(
        { 'Content-Type': 'application/json; charset=utf-8', Path: 'speech.config' },
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: EDGE_OUTPUT_FORMAT,
              },
            },
          },
        }),
      )));
      socket.write(edgeClientFrame(1, edgeFrame(
        { 'X-RequestId': connectionId, 'Content-Type': 'application/ssml+xml', Path: 'ssml' },
        ssml,
      )));
    });
    let headerDone = false;
    let buffer = Buffer.alloc(0);
    const chunks = [];
    let settled = false;
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else if (!chunks.length) reject(new Error('Edge neural voice ne audio nahi diya.'));
      else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => finish(new Error('Edge neural voice timeout.')), 120_000);
    socket.on('error', (error) => finish(error));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!headerDone) {
        const marker = buffer.indexOf('\r\n\r\n');
        if (marker === -1) return;
        const head = buffer.subarray(0, marker).toString();
        const status = Number(/HTTP\/1\.[01]\s+(\d+)/.exec(head)?.[1] || 0);
        if (status !== 101) {
          finish(new Error(`Edge neural voice handshake failed (${status}).`));
          return;
        }
        buffer = buffer.subarray(marker + 4);
        headerDone = true;
      }
      const parsed = edgeParseFrames(buffer);
      buffer = parsed.rest;
      for (const frame of parsed.frames) {
        if (frame.opcode === 1) {
          if (frame.payload.toString().includes('Path:turn.end')) finish(null, null);
        } else if (frame.opcode === 2 && frame.payload.length >= 4) {
          const headerLength = frame.payload.readUInt16BE(0);
          const headerText = frame.payload.subarray(2, 2 + headerLength).toString();
          if (headerText.includes('Path:audio')) chunks.push(frame.payload.subarray(2 + headerLength));
        }
      }
    });
  });
}

async function synthesizeEdgeNarration(text, rawVoice, outPath) {
  const chunks = edgeTextChunks(text);
  if (!chunks.length) throw new Error('Narration text khaali hai.');
  const style = edgeVoiceFor(rawVoice, text);
  const pieces = [];
  for (const chunk of chunks) pieces.push(await edgeSpeakChunk(chunk, style));
  const audio = Buffer.concat(pieces);
  if (audio.length < 2000) throw new Error('Edge neural voice audio khaali hai.');
  await writeFile(outPath, audio);
  return outPath;
}

function writePcmWav(outPath, pcm, sampleRate) {
  const rate = Math.min(96000, Math.max(8000, Number(sampleRate) || 24000));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return writeFile(outPath, Buffer.concat([header, pcm]));
}

async function synthesizeGeminiNarration(text, voice, outPath, key) {
  if (!key) throw new Error('Gemini TTS key unavailable.');
  const model = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: String(text).slice(0, 14_000) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } },
          },
        },
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini TTS failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const part = parts.find((item) => item?.inlineData?.data || item?.audio?.data);
  const base64 = part?.inlineData?.data || part?.audio?.data;
  if (!base64) throw new Error('Gemini TTS ne audio return nahi ki.');
  const pcm = Buffer.from(base64, 'base64');
  if (pcm.length < 1000) throw new Error('Gemini TTS audio khaali hai.');
  const mime = String(part?.inlineData?.mimeType || part?.audio?.mimeType || 'audio/pcm;rate=24000');
  const rate = Number(/rate=(\d+)/i.exec(mime)?.[1]) || 24000;
  await writePcmWav(outPath, pcm, rate);
  return outPath;
}

async function synthesizeAiNarration(text, voice, outPath, key, baseUrl) {
  if (!key || !baseUrl) throw new Error('AI voice key unavailable.');
  const base = String(baseUrl).replace(/\/+$/, '');
  const configured = String(process.env.TTS_MODEL || '').trim();
  const models = configured ? [configured] : ['gpt-4o-mini-tts', 'tts-1'];
  let lastError = null;
  for (const model of models) {
    try {
      const body = {
        model,
        voice: voice || 'alloy',
        input: String(text).slice(0, 4096),
        response_format: 'wav',
      };
      if (/gpt-4o|mini-tts/i.test(model)) {
        body.instructions = 'Speak naturally like a warm documentary narrator: clear pacing, gentle emotion, no robotic tone.';
      }
      const response = await fetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        lastError = new Error(`AI voice failed (${response.status}): ${detail.slice(0, 200)}`);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1000) {
        lastError = new Error('AI voice audio khaali hai.');
        continue;
      }
      await writeFile(outPath, bytes);
      return outPath;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('AI voice unavailable.');
}

async function synthesizeNaturalNarration(text, voice, outPath, creds) {
  const preset = resolveVoicePreset(voice);
  // 1) Google Gemini TTS (jab user ne free key di ho) — sabse natural.
  if (geminiToken) {
    try {
      return await synthesizeGeminiNarration(text, preset.gemini, outPath, geminiToken);
    } catch {
      // Key invalid ya model unavailable — niche wale free neural voice par chalein.
    }
  }
  // 2) Microsoft Edge neural voice — bina key ke, male/female/child, Hindi support.
  try {
    return await synthesizeEdgeNarration(text, voice, outPath);
  } catch {
    // Network block ho to OpenAI-compatible / SAPI fallback.
  }
  return synthesizeAiNarration(text, preset.openai, outPath, creds?.key, creds?.baseUrl);
}

// FFmpeg atempo 0.5–2.0 support karta hai; chhoti line ko poorre scene me slow karne ke liye chain.
function tempoChain(factor) {
  const target = Math.max(0.2, Math.min(4, Number(factor) || 1));
  const parts = [];
  let remaining = target;
  while (remaining < 0.5) {
    parts.push(0.5);
    remaining /= 0.5;
  }
  while (remaining > 2) {
    parts.push(2);
    remaining /= 2;
  }
  parts.push(remaining);
  return `${parts.map((value) => `atempo=${value.toFixed(4)}`).join(',')},`;
}

// Storyboard ke har scene ki line us scene ke time par boli jaye — prompt nahi, aur 5 min me poori story.
async function buildTimedNarration(lines, starts, ends, durationSeconds, voice, creds, directory) {
  const bin = await ffmpegExecutable('ffmpeg');
  if (!bin) throw new Error('FFmpeg unavailable.');
  const target = Math.min(900, Math.max(5, Math.round(durationSeconds || 30)));
  const inputs = [];
  const filters = [];
  const labels = [];
  const list = Array.isArray(lines) ? lines.map((line) => String(line || '').trim()).filter(Boolean) : [];
  if (!list.length) throw new Error('Narration ke liye story lines nahi mili.');
  for (let index = 0; index < list.length; index += 1) {
    const rawStart = Number(starts?.[index]);
    const start = Number.isFinite(rawStart) ? rawStart : (index * target) / list.length;
    const at = Math.max(0, Math.min(target - 1, start + 0.5));
    const rawEnd = Number(ends?.[index]);
    const fallbackEnd = ((index + 1) * target) / list.length;
    const end = Number.isFinite(rawEnd) && rawEnd > at ? rawEnd : fallbackEnd;
    const available = Math.max(3, Math.min(target - at, end - at - 0.8));
    const lineFile = path.join(directory, `voice-line-${String(index + 1).padStart(2, '0')}.mp3`);
    try {
      await synthesizeNaturalNarration(list[index], voice, lineFile, creds);
      // Speed kabhi badalna nahi — bas line ko natural length ka likha hai, yahan sirf chhoti correction.
      const spoken = await probeAudioDuration(lineFile);
      let tempo = '';
      if (spoken > 0 && available > 0) {
        const factor = Math.max(0.9, Math.min(1.1, spoken / available));
        if (Math.abs(factor - 1) > 0.01) tempo = `atempo=${factor.toFixed(3)},`;
      }
      const delay = Math.round(at * 1000);
      const label = `line${index}`;
      inputs.push('-i', lineFile);
      filters.push(`[${index}:a]${tempo}adelay=${delay},volume=1.05[${label}]`);
      labels.push(`[${label}]`);
    } catch {
      // Ek line fail ho to baaki story chalti rehe.
    }
  }
  if (!labels.length) throw new Error('Koi bhi story line voice me nahi bani.');
  const outPath = path.join(directory, 'narration.wav');
  const mix = labels.length === 1
    ? `[${labels[0].slice(1, -1)}]apad,atrim=0:${target.toFixed(3)}[aout]`
    : `${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=0:normalize=0,`
      + `apad,atrim=0:${target.toFixed(3)}[aout]`;
  await runCommand(bin, [
    '-y',
    ...inputs,
    '-filter_complex', `${filters.join(';')};${mix}`,
    '-map', '[aout]',
    '-c:a', 'pcm_s16le',
    '-ar', '24000',
    '-ac', '1',
    outPath,
  ], 300_000);
  return outPath;
}

async function generateAmbientBed(outPath, durationSeconds, options = {}) {
  // Simple sine drone nahi — soft chord pad + arpeggio + shaker + scene-change sparkle FX.
  const rate = 24000;
  const target = Math.min(900, Math.max(5, Math.round(durationSeconds || 30)));
  const boundaries = Math.max(2, Number(options.boundaries) || Math.max(2, Math.round(target / 30)));
  const boundarySeconds = target / boundaries;
  const samples = target * rate;
  const pcm = Buffer.alloc(samples * 2);
  const chords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 392.00], // G6
  ];
  const chordSeconds = 4;
  const arpSeconds = 0.5;
  let seed = 0x2f6e2b1;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < samples; index += 1) {
    const time = index / rate;
    const chordIndex = Math.floor(time / chordSeconds) % chords.length;
    const chord = chords[chordIndex];
    const chordPhase = time % chordSeconds;
    const padEnvelope = Math.min(1, chordPhase / 1.2) * Math.min(1, (chordSeconds - chordPhase) / 0.8);
    let pad = 0;
    for (const frequency of chord) {
      pad += Math.sin(2 * Math.PI * frequency * time) * 0.7;
      pad += Math.sin(2 * Math.PI * frequency * 2 * time) * 0.08;
    }
    pad *= padEnvelope * 0.16;

    const arpIndex = Math.floor(chordPhase / arpSeconds) % chord.length;
    const arpPhase = (chordPhase % arpSeconds) / arpSeconds;
    const arpEnvelope = Math.exp(-arpPhase * 5) * Math.min(1, arpPhase * 40);
    const arp = Math.sin(2 * Math.PI * chord[arpIndex] * 2 * time) * arpEnvelope * 0.09;

    const shakerPhase = time % arpSeconds;
    const shaker = shakerPhase < 0.07
      ? (random() * 2 - 1) * Math.exp(-shakerPhase * 45) * 0.028
      : 0;

    const scenePhase = time % boundarySeconds;
    let sparkle = 0;
    if (scenePhase < 1.1) {
      const envelope = Math.exp(-scenePhase * 3.2) * Math.min(1, scenePhase * 50);
      sparkle = (Math.sin(2 * Math.PI * 1046.5 * scenePhase)
        + 0.45 * Math.sin(2 * Math.PI * 1567.98 * scenePhase)) * envelope * 0.065;
    }

    const fade = Math.min(1, time / 2) * Math.min(1, (target - time) / 2);
    const value = (pad + arp + shaker + sparkle) * fade;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(value * 32767))), index * 2);
  }
  await writePcmWav(outPath, pcm, rate);
  const info = await stat(outPath);
  if (info.size < 1000) throw new Error('Ambient audio nahi bana.');
  return outPath;
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
    '$synth.Rate = -2',
    '$synth.Volume = 100',
    '$safe = [System.Security.SecurityElement]::Escape($Text)',
    '$ssml = "<speak version=""1.0"" xmlns=""http://www.w3.org/2001/10/Synthesis"" xml:lang=""en-US""><prosody rate=""-8%"">$safe</prosody></speak>"',
    '$synth.SetOutputToWaveFile($Out)',
    '$synth.SpeakSsml($ssml)',
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

function studioBeatSeconds(bpm) {
  return Math.max(0.25, 60 / (Number(bpm) > 0 ? Number(bpm) : 120));
}

function studioFxFilters(job, sceneIndex, startLabel) {
  const filters = [];
  let current = startLabel;
  let sequence = 0;
  const apply = (chain) => {
    const label = `s${sceneIndex}f${sequence += 1}`;
    filters.push(`[${current}]${chain}[${label}]`);
    current = label;
  };
  const fx = new Set(Array.isArray(job.fx) ? job.fx : []);
  if (fx.has('cinematic') || fx.has('dramatic')) apply('huesaturation=saturation=0.14,intensity=-0.05,vignette=PI/5');
  if (fx.has('vibrant') || fx.has('cartoon')) apply('huesaturation=saturation=0.3,unsharp=5:5:0.5');
  if (fx.has('noir') || fx.has('matrix')) apply('huesaturation=saturation=-1,colorlevels=romin=0.04:gomax=0.95');
  if (fx.has('vintage') || fx.has('sunset')) apply('colorbalance=rs=0.09:gs=0.03:bs=-0.09,vignette=PI/4');
  if (fx.has('cool')) apply('colorbalance=rs=-0.07:bs=0.1');
  if (fx.has('neon')) apply('huesaturation=saturation=0.34,chromashift=cbh=4:crh=-4');
  if (fx.has('chromatic')) apply('chromashift=cbh=6:crh=-6');
  if (fx.has('sharpen')) apply('unsharp=5:5:0.7');
  if (fx.has('softblur') || fx.has('dreamy')) apply('gblur=sigma=2.2');
  if (fx.has('filmgrain') || fx.has('vhs')) apply('noise=alls=5:allf=t+u');
  if (fx.has('pixelate')) apply('pixelize=pix=32');
  if (fx.has('vignette')) apply('vignette=PI/4.5');
  if (fx.has('fade')) apply('colorlevels=romin=0.06:bomin=0.06');
  if (fx.has('glitch')) {
    apply(`drawbox=x=0:y='h*0.24':w=w:h=7:color=cyan@0.35:t=fill:enable='gt(mod(t,2.4),2.1)'`);
    apply(`drawbox=x=0:y='h*0.62':w=w:h=5:color=magenta@0.3:t=fill:enable='gt(mod(t,3.1),2.8)'`);
  }
  if (fx.has('glow') || fx.has('dreamy')) {
    const left = `s${sceneIndex}glowA`;
    const blurred = `s${sceneIndex}glowB`;
    const out = `s${sceneIndex}glowOut`;
    filters.push(`[${current}]split=2[${left}][${blurred}]`);
    filters.push(`[${blurred}]gblur=sigma=9,huesaturation=saturation=0.25[${blurred}2]`);
    filters.push(`[${left}][${blurred}2]blend=all_mode=screen:all_opacity=0.24[${out}]`);
    current = out;
  }
  if (fx.has('mirror')) {
    const left = `s${sceneIndex}mirrorA`;
    const half = `s${sceneIndex}mirrorB`;
    const out = `s${sceneIndex}mirrorOut`;
    filters.push(`[${current}]split=2[${left}][${half}]`);
    filters.push(`[${half}]crop=iw/2:ih:0:0,hflip[${half}2]`);
    filters.push(`[${left}][${half}2]overlay=x=w/2:y=0[${out}]`);
    current = out;
  }
  if (fx.has('shake')) {
    apply(`crop=w='iw*0.94':h='ih*0.94':x='(iw-ow)/2+10*sin(2*PI*t/0.7)':y='(ih-oh)/2+8*cos(2*PI*t/0.55)'`);
  }
  if (fx.has('slowmo')) apply('tblend=all_mode=average');
  if (fx.has('fastcut')) apply('select=not(mod(n\\,2)),setpts=N/FRAME_RATE/TB');
  return { filters, current, count: sequence };
}

function studioVisualizerFilters(job, sceneIndex, startLabel, bpm) {
  const filters = [];
  const ids = new Set(Array.isArray(job.visualizers) ? job.visualizers : []);
  if (!ids.size) return { filters, current: startLabel };
  let current = startLabel;
  let sequence = 0;
  const beat = studioBeatSeconds(bpm);
  const wave = `2*PI*t/${beat.toFixed(3)}`;
  const apply = (chain) => {
    const label = `s${sceneIndex}v${sequence += 1}`;
    filters.push(`[${current}]${chain}[${label}]`);
    current = label;
  };
  if (ids.has('bounce')) {
    apply(`drawbox=x='w/2-46+46*sin(${wave})':y='h-26':w=92:h=5:color=cyan@0.5:t=fill`);
  }
  if (ids.has('flicker')) {
    apply(`drawbox=x=0:y=0:w=w:h=h:color=white@0.11:t=fill:enable='gt(sin(${wave}),0.72)'`);
  }
  if (ids.has('pulse')) {
    apply(`drawbox=x='w*0.025':y='h*0.045':w='w*0.95':h='h*0.91':color='0x7cf7ff@0.38':t=7:enable='gt(sin(${wave}),0.12)'`);
  }
  if (ids.has('eqbars')) {
    for (let bar = 0; bar < 6; bar += 1) {
      const phase = `sin(${wave}+${bar * 0.8})`;
      apply(`drawbox=x='w*${((bar + 1) / 7).toFixed(3)}-7':y='h*0.7':w=14:h='h*(0.04+0.24*abs(${phase}))':color='0xff4fd8@0.42':t=fill`);
    }
  }
  if (ids.has('orbit')) {
    apply(`drawbox=x='w/2+(w*0.31)*cos(${wave})':y='h/2+(h*0.27)*sin(${wave})':w=16:h=16:color='0xffd166@0.6':t=fill`);
  }
  if (ids.has('glitch')) {
    apply(`drawbox=x=0:y='h*0.2':w=w:h=8:color=cyan@0.38:t=fill:enable='gt(sin(${wave}),0.8)'`);
    apply(`drawbox=x=0:y='h*0.51':w=w:h=5:color=magenta@0.34:t=fill:enable='gt(sin(${wave}+1.2),0.82)'`);
  }
  if (ids.has('sparkle')) {
    for (let dot = 0; dot < 4; dot += 1) {
      const phase = `${wave}+${dot * 1.4}`;
      apply(`drawbox=x='w*(${((dot + 1) / 5).toFixed(2)}+0.08*sin(${phase}))':y='h*(0.2+0.12*cos(${phase}))':w=9:h=9:color=white@0.7:t=fill:enable='gt(sin(${phase}),0.4)'`);
    }
  }
  if (ids.has('glowpulse')) {
    apply(`drawbox=x='w*0.018':y='h*0.03':w='w*0.964':h='h*0.94':color='0x9ef01a@0.28':t=10:enable='gt(sin(${wave}),0.35)'`);
  }
  if (ids.has('chroma')) {
    apply('chromashift=cbh=5:crh=-5');
    apply(`drawbox=x=0:y=0:w=w:h=h:color='0x4361ee@0.08':t=fill:enable='gt(sin(${wave}),0.65)'`);
  }
  if (ids.has('wavelength')) {
    for (let line = 0; line < 3; line += 1) {
      const phase = `${wave}+${line * 2.1}`;
      apply(`drawbox=x='w/2+(w*0.34)*sin(${phase})':y='h*0.16':w=5:h='h*0.68':color='0x48cae4@0.4':t=fill`);
    }
  }
  return { filters, current, count: sequence };
}

function studioAudioFx(fxList = []) {
  const fx = new Set(fxList);
  const chains = [];
  if (fx.has('denoise')) chains.push('afftdn');
  if (fx.has('echo') || fx.has('reverb')) chains.push('aecho=0.8:0.88:60:0.3');
  if (fx.has('crusher')) chains.push('acrusher=0.5:8:0.6');
  if (fx.has('crystalizer')) chains.push('crystalizer=2');
  if (fx.has('compress') || fx.has('punch')) chains.push('acompressor=threshold=-18dB:ratio=3:attack=10:release=120');
  return chains.length ? `${chains.join(',')},` : '';
}

async function assembleVideoWithFfmpeg(job, directory, options = {}) {
  const bin = await ffmpegExecutable('ffmpeg');
  if (!bin) throw new Error('FFmpeg available nahi hai — installer reinstall karein.');
  const scenes = (job.scenes || []).filter((scene) => scene.image || scene.video);
  if (!scenes.length) throw new Error('Video ke liye koi scene media nahi mila.');

  const portrait = job.ratio === '9:16';
  const width = portrait ? 720 : 1280;
  const height = portrait ? 1280 : 720;
  const fps = 24;
  const count = scenes.length;
  const target = Math.min(900, Math.max(5, Number(job.durationSeconds) || count * 5));
  // Har visual beat apni narration line ke time par — scene durations equal nahi.
  const rawDurations = scenes.map((scene, index) => {
    const beat = Array.isArray(job.visualBeats) ? job.visualBeats[index] : null;
    const start = Number(beat?.start);
    const end = Number(beat?.end);
    return end > start ? end - start : target / count;
  });
  const rawTotal = rawDurations.reduce((sum, value) => sum + value, 0) || target;
  const durations = rawDurations.map((value) => (value * target) / rawTotal);
  const minDuration = Math.min(...durations);
  const transition = Math.min(0.8, Math.max(0.2, minDuration / 5));
  const legacyTransitions = new Set([
    'fade', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleclose', 'circleopen',
  ]);
  const allowedTransitions = new Set(job.studio ? VIDEO_STUDIO_TRANSITIONS : [...legacyTransitions]);
  const requestedList = Array.isArray(job.transitions) && job.transitions.length ? job.transitions : ['fade'];
  const transitionNames = requestedList.map((name) => (
    allowedTransitions.has(String(name).toLowerCase()) ? String(name).toLowerCase() : 'fade'
  ));
  const bpm = Number(job.bpm) || Number(job.analysis?.bpm) || 120;
  const beatSeconds = studioBeatSeconds(bpm);
  const bounceFrames = Math.max(4, Math.round(fps * beatSeconds));
  const output = path.join(directory, 'final.mp4');

  const args = [];
  for (let index = 0; index < count; index += 1) {
    const scene = scenes[index];
    const source = scene.video || scene.image;
    const absolute = path.resolve(WORKSPACE, String(source).replace(/\\/g, '/'));
    if (!pathInAllowedFolders(absolute)) throw new Error('Scene media allowed folder ke bahar hai.');
    const inputDuration = index < count - 1 ? durations[index] + transition : durations[index];
    if (scene.video) {
      args.push('-stream_loop', '-1', '-t', inputDuration.toFixed(3), '-i', absolute);
    } else {
      args.push('-loop', '1', '-framerate', String(fps), '-t', inputDuration.toFixed(3), '-i', absolute);
    }
  }

  let audioIndex = count;
  const audioPath = resolveJobAudioPath(job.audioPath);
  const songIndex = audioPath ? audioIndex++ : null;
  if (audioPath) args.push('-i', audioPath);
  const narrationPath = options.narration || null;
  const voiceIndex = narrationPath ? audioIndex++ : null;
  if (narrationPath) args.push('-i', narrationPath);
  const ambientPath = options.ambient || null;
  const ambientIndex = ambientPath ? audioIndex++ : null;
  if (ambientPath) args.push('-i', ambientPath);
  const bgmPath = job.bgmPath ? resolveJobAudioPath(job.bgmPath) : null;
  const bgmIndex = bgmPath ? audioIndex++ : null;
  if (bgmPath) args.push('-stream_loop', '-1', '-i', bgmPath);
  const silenceIndex = songIndex === null && voiceIndex === null && ambientIndex === null && bgmIndex === null
    ? audioIndex++ : null;
  if (silenceIndex !== null) args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');

  const filters = [];
  for (let index = 0; index < count; index += 1) {
    const frames = Math.max(2, Math.round(durations[index] * fps));
    const motion = index % 4;
    const zoomIn = `1+0.15*on/${frames}`;
    const zoomOut = `max(1.0,1.15-0.15*on/${frames})`;
    const baseZoom = motion === 1 || motion === 3 ? zoomOut : zoomIn;
    const bounceZoom = `1.02+0.045*abs(sin(2*PI*on/${bounceFrames}))`;
    const z = job.studio && (job.visualizers || []).includes('bounce') ? bounceZoom : baseZoom;
    const centerX = 'iw/2-(iw/zoom/2)';
    const centerY = 'ih/2-(ih/zoom/2)';
    const x = motion === 2
      ? `(iw-iw/zoom)*on/${frames}`
      : (motion === 3 ? `(iw-iw/zoom)*(1-on/${frames})` : centerX);
    const y = motion >= 2 ? '(ih-ih/zoom)/2' : centerY;
    const label = `s${index}base`;
    if (scenes[index].video) {
      filters.push(
        `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,`
        + `crop=${width}:${height},setsar=1,fps=${fps},trim=duration=${durations[index].toFixed(3)},`
        + `setpts=PTS-STARTPTS[${label}]`,
      );
    } else {
      filters.push(
        `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,`
        + `crop=${width}:${height},setsar=1,hue=s=1.07,`
        + `zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=${fps},`
        + `trim=duration=${durations[index].toFixed(3)},setpts=PTS-STARTPTS[${label}]`,
      );
    }
    let tail = label;
    if (job.studio) {
      const fx = studioFxFilters(job, index, tail);
      filters.push(...fx.filters);
      tail = fx.current;
      const visual = studioVisualizerFilters(job, index, tail, bpm);
      filters.push(...visual.filters);
      tail = visual.current;
    }
    scenes[index].renderLabel = tail;
  }

  let current = scenes[0].renderLabel;
  let xfadeOffset = 0;
  for (let index = 1; index < count; index += 1) {
    const label = `x${index}`;
    const name = transitionNames[(index - 1) % transitionNames.length];
    xfadeOffset += durations[index - 1];
    filters.push(
      `[${current}][${scenes[index].renderLabel}]xfade=transition=${name}:duration=${transition.toFixed(3)}`
      + `:offset=${xfadeOffset.toFixed(3)}[${label}]`,
    );
    current = label;
  }
  filters.push(`[${current}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(target - 0.6).toFixed(3)}:d=0.6[vout]`);

  const audioStreams = [];
  const audioFx = studioAudioFx(job.audioFx || []);
  if (songIndex !== null) {
    audioStreams.push(`[${songIndex}:a]${audioFx}volume=${bgmIndex !== null ? 0.5 : 0.62},apad=pad_dur=${target.toFixed(3)}[song]`);
  }
  if (voiceIndex !== null) {
    audioStreams.push(
      `[${voiceIndex}:a]${audioFx}highpass=f=90,acompressor=threshold=-18dB:ratio=3:attack=10:release=120,`
      + `volume=1.18,apad=pad_dur=${target.toFixed(3)}[voice]`,
    );
  }
  if (ambientIndex !== null) {
    audioStreams.push(
      `[${ambientIndex}:a]lowpass=f=5000,volume=0.18,apad=pad_dur=${target.toFixed(3)}[ambient]`,
    );
  }
  if (bgmIndex !== null) {
    audioStreams.push(
      `[${bgmIndex}:a]lowpass=f=7000,volume=0.2,apad=pad_dur=${target.toFixed(3)}[bgm]`,
    );
  }
  if (silenceIndex !== null) {
    audioStreams.push(`[${silenceIndex}:a]atrim=0:${target.toFixed(3)}[silence]`);
  }
  const audioLabels = [];
  if (songIndex !== null) audioLabels.push('[song]');
  if (voiceIndex !== null) audioLabels.push('[voice]');
  if (ambientIndex !== null) audioLabels.push('[ambient]');
  if (bgmIndex !== null) audioLabels.push('[bgm]');
  if (silenceIndex !== null) audioLabels.push('[silence]');
  if (audioStreams.length) filters.push(audioStreams.join(';'));
  if (audioLabels.length > 1) {
    filters.push(
      `${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=first:`
      + `dropout_transition=1:normalize=0,acompressor=threshold=-14dB:ratio=2:attack=20:release=250,`
      + `atrim=0:${target.toFixed(3)}[aout]`,
    );
  } else if (audioLabels.length === 1) {
    filters.push(`${audioLabels[0]}atrim=0:${target.toFixed(3)}[aout]`);
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
    stage: 'render',
    progress: 75,
    completedScenes: count,
    step: `Final render — ${count} scenes · ${Math.round(target)}s · ${transitionNames.join('/')}`
      + (job.studio ? ` · ${(job.fx || []).length} FX · ${(job.visualizers || []).length} visualizers` : ''),
  });
  await runFfmpegCommand(
    bin,
    args,
    target,
    (progress) => updateMediaJob(job, {
      progress: 75 + Math.round(progress * 0.24),
      step: `Render ${progress}% — timeline autosave ho rahi hai…`,
    }),
    job.id,
  );
  const info = await stat(output);
  if (!info.size) throw new Error('Final video ban nahi paya.');
  for (const scene of job.scenes || []) scene.status = 'done';
  await updateMediaJob(job, {
    status: 'done',
    stage: 'done',
    progress: 100,
    step: 'Ready · autosaved',
    output: path.relative(WORKSPACE, output).replace(/\\/g, '/'),
    outputUrl: `/api/file?path=${encodeURIComponent(output)}`,
    error: null,
    resumeOnStart: false,
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
    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || (ext === '.md' ? 'text/markdown; charset=utf-8' : 'application/octet-stream');
    return await sendFileBytes(req, res, target, type);
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

    if (req.method === 'GET' && url.pathname === '/api/memory') {
      return sendJson(res, 200, { ok: true, content: await readWorkingMemory() });
    }

    if (req.method === 'POST' && url.pathname === '/api/memory') {
      try {
        const body = JSON.parse((await readBody(req)) || '{}');
        const content = await writeWorkingMemory(body.content ?? '');
        return sendJson(res, 200, { ok: true, content });
      } catch (err) {
        return sendJson(res, 400, { error: `Memory update failed: ${err.message}` });
      }
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/workspace/')) {
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

    if (req.method === 'GET' && url.pathname === '/api/video-studio/catalog') {
      return sendJson(res, 200, videoStudioCatalog());
    }

    if (req.method === 'POST' && url.pathname === '/api/video-studio/analyze') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      try {
        return sendJson(res, 200, await analyzeStudioMedia(payload.path || ''));
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Media analyze nahi hua.' });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/video-studio/render') {
      let payload;
      try {
        payload = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body.' });
      }
      try {
        const job = await createMediaJob({ ...payload, studio: true });
        mediaTtsCredentials.set(job.id, {
          key: apiKeyFrom(req),
          baseUrl: baseUrlFrom(req),
        });
        return sendJson(res, 201, job);
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Studio render shuru nahi hua.' });
      }
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
        mediaTtsCredentials.set(job.id, {
          key: apiKeyFrom(req),
          baseUrl: baseUrlFrom(req),
        });
        return sendJson(res, 201, job);
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Could not create media job.' });
      }
    }

    const mediaJobMatch = /^\/api\/media-jobs\/([^/]+)(?:\/(render|error|status|retry))?$/.exec(url.pathname);
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

      if (req.method === 'POST' && mediaJobMatch[2] === 'retry') {
        // Naya job nahi — same job ko uski saved images/visual beats ke saath aage chalao.
        if (!['error', 'awaiting-render', 'assets'].includes(job.status)) {
          return sendJson(res, 400, { error: 'Job abhi chal raha hai ya pehle se ready hai.' });
        }
        if (mediaRunning.has(job.id)) return sendJson(res, 409, { error: 'Job already running.' });
        let payload = {};
        try { payload = JSON.parse((await readBody(req)) || '{}'); } catch { payload = {}; }
        const provider = String(payload.imageProvider || '').trim();
        const allowedProviders = ['bing', 'stock', 'cloudflare', 'huggingface', 'worker', 'auto'];
        cancelledJobs.delete(job.id);
        await updateMediaJob(job, {
          status: 'assets',
          error: null,
          step: provider && provider !== job.imageProvider
            ? `${provider} se saved scenes wahin se resume…`
            : 'Resume — saved scenes se wahin se aage badh rahe hain…',
          progress: Math.max(0, Math.min(90, Number(job.progress) || 0)),
          ...(allowedProviders.includes(provider) ? { imageProvider: provider } : {}),
        });
        runMediaJob(job).catch(() => {});
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
        mediaTtsCredentials.delete(job.id);
        await saveMediaJobs();
        try {
          await rm(path.join(WORKSPACE, 'media-jobs', job.id), { recursive: true, force: true });
        } catch { /* ignore cleanup errors */ }
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

    if (url.pathname === '/api/file' && (req.method === 'GET' || req.method === 'HEAD')) {
      const raw = String(url.searchParams.get('path') || '');
      const target = path.resolve(raw);
      if (!raw || !pathInAllowedFolders(target)) {
        return sendJson(res, 403, { error: 'File is outside the allowed folders.' });
      }
      try {
        const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
        return await sendFileBytes(req, res, target, type);
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
