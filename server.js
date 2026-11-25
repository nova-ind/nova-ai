import http from 'node:http';
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
await mkdir(WORKSPACE, { recursive: true });

let jobs = [];
let allowedFolders = [];
let mediaJobs = [];
const runningJobs = new Set();
const mediaRunning = new Set();

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
];
const VIDEO_PROVIDERS = [
  { id: 'ltx', label: 'LTX-Video · GitHub/HF', note: 'Free open-source model · no card' },
];
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const BROWSER_PROFILE = path.join(WORKSPACE, '.browser-profile');
let browserTargetId = null;

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

function apiKeyFrom(req) {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
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

  try {
    const { bytes } = await generateImageSmart(finalPrompt, { provider, model, ratio });
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

async function fetchMediaBytes(kind, prompt, model, duration = 5, provider = 'auto', ratio = '16:9') {
  if (kind === 'image') {
    if (provider === 'bing') return generateBingImage(prompt);
    if (provider === 'cloudflare') return generateCloudflareImage(prompt, model);
    if (provider === 'huggingface') return generateHuggingFaceImage(prompt, model, ratio);
    if (provider === 'pollinations') {
      throw new Error('Pollinations band hai — app Bing/Cloudflare/Hugging Face free providers use karti hai.');
    }
    throw new Error(`Unknown image provider: ${provider}. Available: bing, cloudflare, huggingface.`);
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
    ...(BING_SUPPORTED ? ['bing'] : []),
    ...(cloudflareAccount && cloudflareToken ? ['cloudflare'] : []),
    ...(hfToken ? ['huggingface'] : []),
  ];
}

async function generateImageSmart(prompt, options = {}) {
  const requested = options.provider || DEFAULT_IMAGE_PROVIDER;
  const useAuto = requested === 'auto' || (requested === 'bing' && !BING_SUPPORTED);
  const order = useAuto ? configuredImageProviders() : [requested];
  if (!order.length) {
    throw new Error(
      'Koi free image provider configured nahi hai. Local PC par Bing automatically chalega; online site par Settings me Cloudflare token ya Hugging Face token daalo (dono free).',
    );
  }
  let lastError = null;
  for (const provider of order) {
    try {
      const bytes = await fetchMediaBytes(
        'image',
        prompt,
        options.model || DEFAULT_IMAGE_MODEL,
        5,
        provider,
        options.ratio || '16:9',
      );
      return { bytes, provider };
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
    try {
      const absolute = safeWorkspacePath(String(payload.audioPath), WORKSPACE);
      audioPath = path.relative(WORKSPACE, absolute).replace(/\\/g, '/');
    } catch {
      audioPath = null;
    }
  }

  const job = {
    id,
    type,
    prompt,
    ratio,
    style,
    fx: fx.length ? fx : inferMediaFx(prompt),
    transitions: transitions.length ? transitions : inferTransitions(prompt),
    sceneCount: Math.min(12, Math.max(3, Number(payload.sceneCount) || 5)),
    clipSeconds: Math.min(8, Math.max(2, Number(payload.clipSeconds) || 4)),
    audioPath,
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
    await updateMediaJob(job, { status: 'assets', step: 'Scene assets prepare ho rahe hain…', progress: 5 });
    const directory = path.join(WORKSPACE, 'media-jobs', job.id);
    await mkdir(directory, { recursive: true });
    const captions = splitCaptions(job.prompt, job.sceneCount);

    for (let index = 0; index < job.sceneCount; index += 1) {
      const scene = job.scenes[index] || { index: index + 1, caption: captions[index] || `Scene ${index + 1}` };
      if (!scene.image) {
        await updateMediaJob(job, {
          step: `Scene ${index + 1}/${job.sceneCount}: ${job.style} image ban rahi hai…`,
          progress: 10 + Math.round(((index + 0.3) / job.sceneCount) * 60),
        });
        const scenePrompt = `${job.prompt}. Scene ${index + 1}: ${scene.caption}. ${job.style} style, high detail, cinematic composition.`;
        const bytes = await fetchMediaBytesWithRetry(job, 'image', scenePrompt, job.imageModel, 5, job.imageProvider);
        const file = `scene-${String(index + 1).padStart(2, '0')}.jpg`;
        await writeFile(path.join(directory, file), bytes);
        scene.image = `media-jobs/${job.id}/${file}`;
      }

      if (job.useAiVideo && !scene.video && !scene.videoError) {
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

    await updateMediaJob(job, {
      status: 'awaiting-render',
      progress: 75,
      step: 'Final video browser me render hona baaki hai…',
    });
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
    if (job.status === 'queued' || job.status === 'assets') {
      runMediaJob(job).catch(() => {});
    } else if (job.status === 'rendering') {
      await updateMediaJob(job, { status: 'awaiting-render', step: 'Restart ke baad render resume…', progress: 75 });
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

async function waitForPageValue(expression, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await pageEvaluate(expression);
    } catch {
      last = null; // page navigation ke dauran evaluate fail ho sakta hai
    }
    if (last) return last;
    await sleep(700);
  }
  return last || false;
}

async function generateBingImage(prompt) {
  return withBingLock(async () => {
    const target = await bingImageTarget();
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
    );
    await sleep(1800); // Bing React UI ko hydrate hone do

    const previous = await pageEvaluate(
      `(() => {
        const img = document.querySelector('img.aigc-display__img') || document.querySelector('img.aigc-batch__thumb');
        return img ? img.src : '';
      })()`,
    );

    const started = await pageEvaluate(
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

    const result = await waitForPageValue(
      `(() => {
        const img = document.querySelector('img.aigc-display__img') || document.querySelector('img.aigc-batch__thumb[src*="OIG4"]');
        if (img && img.src && img.src !== ${JSON.stringify(previous || '')} && img.naturalWidth > 0) return img.src;
        const text = document.body.innerText || '';
        if (/guest creation limit|sign in to use your own prompts|out of creations|you.?ve reached|creation limit|captcha|unusual traffic/i.test(text)) {
          return 'ERROR: Bing free limit reached. Chrome profile me Microsoft account se sign in karein.';
        }
        return false;
      })()`,
      240_000,
    );

    if (typeof result === 'string' && result.startsWith('ERROR:')) throw new Error(result.slice(6));
    if (!result || !/^https?:\/\//.test(result)) throw new Error('Bing ne image return nahi ki. Free limit ya sign-in check karein.');

    const response = await fetch(result, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`Bing image download failed (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  });
}

async function generateCloudflareImage(prompt, model) {
  if (!cloudflareAccount || !cloudflareToken) {
    throw new Error('Cloudflare image ke liye Settings → Cloudflare Account ID + API token chahiye.');
  }
  const useModel = CF_IMAGE_MODELS.includes(model) ? model : CF_IMAGE_MODELS[0];
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
    throw new Error(detail || `Cloudflare image failed (${response.status}).`);
  }
  const raw = String(data.result?.image || '');
  if (!raw) throw new Error('Cloudflare ne image return nahi ki.');
  return Buffer.from(raw.replace(/^data:image\/[^;]+;base64,/i, ''), 'base64');
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
          ? BING_SUPPORTED
          : item.id === 'cloudflare'
            ? Boolean(cloudflareAccount && cloudflareToken)
            : Boolean(hfToken),
    })),
    video: VIDEO_PROVIDERS.map((item) => ({ ...item, configured: true })),
    credentials: {
      cloudflare: Boolean(cloudflareAccount && cloudflareToken),
      huggingface: Boolean(hfToken),
    },
  };
}

async function handleMediaProviders(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
  return sendJson(res, 200, mediaProviderState());
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

function agentSystem(modes, customSystem = '', root = WORKSPACE) {
  const toolNames = AGENT_TOOLS.map((tool) => tool.function.name).join(', ');
  return [
    BASE_PERSONA,
    customSystem ? `Additional user instructions: ${customSystem}` : '',
    `Allowed folder for all filesystem tools: ${root}. Never access paths outside it.`,
    `Current date: ${new Date().toISOString().slice(0, 10)}.`,
    'You are an AGENT. Complete the user\'s request end-to-end instead of only explaining how. Use tools whenever the task needs fresh information, files, code execution, or generated images, and keep using them until the task is actually done.',
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
        const message = providerErrorMessage(detail, response.status);
        sse(res, { type: 'error', error: message || `Provider responded with ${response.status}` });
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
    sse(res, { type: 'error', error: err.message || 'Agent failed' });
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
        hasServerKey: Boolean((process.env.NVIDIA_API_KEY || '').trim()),
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
        mediaJobs = mediaJobs.filter((item) => item.id !== job.id);
        await saveMediaJobs();
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
