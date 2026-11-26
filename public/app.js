const CHATS_KEY = 'nova.chats.v2';
const SETTINGS_KEY = 'nova.settings.v2';
const DELETED_JOBS_KEY = 'nova.deletedJobs.v1';
const DELETED_CHATS_KEY = 'nova.deletedChats.v1';
const deletedChatIds = new Set(readJson(DELETED_CHATS_KEY, []).map(String));

const studioState = {
  assets: [],
  catalog: null,
  preset: 'hollywood',
  fx: new Set(['cinematic', 'glow']),
  transitions: new Set(['zoomin', 'fadeblack']),
  visualizers: new Set(['bounce', 'glowpulse']),
  audioFx: new Set(),
  jobId: null,
  timer: null,
  layout: null,
  timelineReady: false,
};

const $ = (id) => document.getElementById(id);

const els = {
  app: $('app'),
  scrim: $('scrim'),
  chatList: $('chatList'),
  chatSearch: $('chatSearch'),
  topSearchBtn: $('topSearchBtn'),
  chat: $('chat'),
  stream: $('stream'),
  welcome: $('welcome'),
  suggestions: $('suggestions'),
  messages: $('messages'),
  composer: $('composer'),
  input: $('input'),
  sendBtn: $('sendBtn'),
  stopBtn: $('stopBtn'),
  modes: $('modes'),
  tierSelect: $('tierSelect'),
  attachBtn: $('attachBtn'),
  attachments: $('attachments'),
  micBtn: $('micBtn'),
  scheduleBtn: $('scheduleBtn'),
  botsBtn: $('botsBtn'),
  scheduleModal: $('scheduleModal'),
  closeSchedule: $('closeSchedule'),
  cancelSchedule: $('cancelSchedule'),
  scheduleWorkflow: $('scheduleWorkflow'),
  scheduleName: $('scheduleName'),
  scheduleDate: $('scheduleDate'),
  scheduleTime: $('scheduleTime'),
  scheduleDateLabel: $('scheduleDateLabel'),
  youtubeFields: $('youtubeFields'),
  videoFile: $('videoFile'),
  videoTopic: $('videoTopic'),
  leadMinutes: $('leadMinutes'),
  schedulePrompt: $('schedulePrompt'),
  scheduleRepeat: $('scheduleRepeat'),
  saveSchedule: $('saveSchedule'),
  scheduledList: $('scheduledList'),
  botsModal: $('botsModal'),
  closeBots: $('closeBots'),
  botFolderPath: $('botFolderPath'),
  chooseFolderBtn: $('chooseFolderBtn'),
  allowFolderBtn: $('allowFolderBtn'),
  folderList: $('folderList'),
  folderBtn: $('folderBtn'),
  folderBtnText: $('folderBtnText'),
  studioBtn: $('studioBtn'),
  topStudioBtn: $('topStudioBtn'),
  studio: $('studio'),
  studioClose: $('studioClose'),
  studioSteps: $('studioSteps'),
  studioUpload: $('studioUpload'),
  studioDrop: $('studioDrop'),
  studioFiles: $('studioFiles'),
  studioMediaList: $('studioMediaList'),
  studioPrompt: $('studioPrompt'),
  studioCategory: $('studioCategory'),
  studioDuration: $('studioDuration'),
  studioRatio: $('studioRatio'),
  studioVoice: $('studioVoice'),
  studioNarration: $('studioNarration'),
  studioAgentBtn: $('studioAgentBtn'),
  studioPreview: $('studioPreview'),
  studioPreviewWrap: $('studioPreviewWrap'),
  studioPreviewEmpty: $('studioPreviewEmpty'),
  studioSave: $('studioSave'),
  studioStage: $('studioStage'),
  studioStepText: $('studioStepText'),
  studioProgress: $('studioProgress'),
  studioCounts: $('studioCounts'),
  studioEta: $('studioEta'),
  studioTimeline: $('studioTimeline'),
  studioImageTimeline: $('studioImageTimeline'),
  studioRuler: $('studioRuler'),
  studioPlayhead: $('studioPlayhead'),
  studioTimecode: $('studioTimecode'),
  studioTimelinePlay: $('studioTimelinePlay'),
  studioTimelineHome: $('studioTimelineHome'),
  studioPrevFrame: $('studioPrevFrame'),
  studioNextFrame: $('studioNextFrame'),
  studioSplit: $('studioSplit'),
  studioSnap: $('studioSnap'),
  studioZoomOut: $('studioZoomOut'),
  studioZoomFit: $('studioZoomFit'),
  studioZoomIn: $('studioZoomIn'),
  studioUndo: $('studioUndo'),
  studioRedo: $('studioRedo'),
  studioMuteVideo: $('studioMuteVideo'),
  studioMuteImage: $('studioMuteImage'),
  studioMuteAudio: $('studioMuteAudio'),
  studioLayoutBtn: $('studioLayoutBtn'),
  studioLayoutMenu: $('studioLayoutMenu'),
  studioTogglePanel: $('studioTogglePanel'),
  studioResetLayout: $('studioResetLayout'),
  studioLockBtn: $('studioLockBtn'),
  studioExitBtn: $('studioExitBtn'),
  studioPanelResizer: $('studioPanelResizer'),
  studioTimelineResizer: $('studioTimelineResizer'),
  studioSceneCount: $('studioSceneCount'),
  studioResumeBtn: $('studioResumeBtn'),
  studioDone: $('studioDone'),
  studioRemaining: $('studioRemaining'),
  studioPreset: $('studioPreset'),
  studioPresetGrid: $('studioPresetGrid'),
  studioPresetName: $('studioPresetName'),
  studioTransition: $('studioTransition'),
  studioBpm: $('studioBpm'),
  studioFx: $('studioFx'),
  studioFxCount: $('studioFxCount'),
  studioTransitions: $('studioTransitions'),
  studioTransitionCount: $('studioTransitionCount'),
  studioVisualizers: $('studioVisualizers'),
  studioAudioFx: $('studioAudioFx'),
  studioRender: $('studioRender'),
  studioRenderNote: $('studioRenderNote'),
  ffmpegBtn: $('ffmpegBtn'),
  ffmpegModal: $('ffmpegModal'),
  closeFfmpeg: $('closeFfmpeg'),
  ffmpegStatusText: $('ffmpegStatusText'),
  ffmpegOperation: $('ffmpegOperation'),
  ffmpegOutputName: $('ffmpegOutputName'),
  ffmpegInput: $('ffmpegInput'),
  ffmpegMergeFields: $('ffmpegMergeFields'),
  ffmpegMergeInputs: $('ffmpegMergeInputs'),
  ffmpegAudioFields: $('ffmpegAudioFields'),
  ffmpegAudioInput: $('ffmpegAudioInput'),
  ffmpegStart: $('ffmpegStart'),
  ffmpegDuration: $('ffmpegDuration'),
  ffmpegWidth: $('ffmpegWidth'),
  ffmpegHeight: $('ffmpegHeight'),
  ffmpegOutputFolder: $('ffmpegOutputFolder'),
  ffmpegJobs: $('ffmpegJobs'),
  chooseVideoBtn: $('chooseVideoBtn'),
  chooseClipsBtn: $('chooseClipsBtn'),
  chooseAudioBtn: $('chooseAudioBtn'),
  chooseOutputFolderBtn: $('chooseOutputFolderBtn'),
  runFfmpeg: $('runFfmpeg'),
  botName: $('botName'),
  botRoot: $('botRoot'),
  botPrompt: $('botPrompt'),
  botDate: $('botDate'),
  botTime: $('botTime'),
  botRepeat: $('botRepeat'),
  addBot: $('addBot'),
  runAllBots: $('runAllBots'),
  botList: $('botList'),
  newChatBtn: $('newChatBtn'),
  brand: $('brand'),
  menuBtn: $('menuBtn'),
  collapseBtn: $('collapseBtn'),
  settingsBtn: $('settingsBtn'),
  topSettingsBtn: $('topSettingsBtn'),
  bannerBtn: $('bannerBtn'),
  keyBanner: $('keyBanner'),
  statusDot: $('statusDot'),
  keyLabel: $('keyLabel'),
  topbarTitle: $('topbarTitle'),
  exportBtn: $('exportBtn'),
  modal: $('settingsModal'),
  closeSettings: $('closeSettings'),
  apiKeyInput: $('apiKeyInput'),
  apiKeyProvider: $('apiKeyProvider'),
  imageProviderSelect: $('imageProviderSelect'),
  imageRatioSelect: $('imageRatioSelect'),
  videoProviderSelect: $('videoProviderSelect'),
  cfAccountInput: $('cfAccountInput'),
  cfTokenInput: $('cfTokenInput'),
  testCloudflareBtn: $('testCloudflareBtn'),
  cloudflareTestResult: $('cloudflareTestResult'),
  hfTokenInput: $('hfTokenInput'),
  geminiTokenInput: $('geminiTokenInput'),
  imageModelSelect: $('imageModelSelect'),
  videoModelSelect: $('videoModelSelect'),
  videoRatioSelect: $('videoRatioSelect'),
  videoDurationSelect: $('videoDurationSelect'),
  videoLengthSelect: $('videoLengthSelect'),
  sceneCountSelect: $('sceneCountSelect'),
  songPath: $('songPath'),
  chooseSongBtn: $('chooseSongBtn'),
  lyricsInput: $('lyricsInput'),
  voiceInput: $('voiceInput'),
  voicePreset: $('voicePreset'),
  narrationToggle: $('narrationToggle'),
  autoModeToggle: $('autoModeToggle'),
  soundToggle: $('soundToggle'),
  modelInput: $('modelInput'),
  modelOptions: $('modelOptions'),
  modelFilter: $('modelFilter'),
  modelList: $('modelList'),
  modelCount: $('modelCount'),
  providerSelect: $('providerSelect'),
  baseUrlInput: $('baseUrlInput'),
  tempInput: $('tempInput'),
  tempValue: $('tempValue'),
  systemInput: $('systemInput'),
  saveSettings: $('saveSettings'),
  clearAllBtn: $('clearAllBtn'),
  browserLoginBtn: $('browserLoginBtn'),
  bingSyncBtn: $('bingSyncBtn'),
  bingSyncField: $('bingSyncField'),
  puterLoginBtn: $('puterLoginBtn'),
  toast: $('toast'),
};

const TOP_MODELS = [
  'minimaxai/minimax-m3.1-flash',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'google/gemma-4-31b-it',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'z-ai/glm-5.3-flash',
  'stepfun-ai/step-5-preview',
  'moonshotai/kimi-k3.1-pro',
  'mistralai/mistral-large-4-1t-a52b',
  'google/gemma-3-12b-it',
];

const TIER_FALLBACK = [
  { id: 'auto', label: 'Auto', hint: 'Picks the best model' },
  { id: 'fast', label: 'Fast', hint: 'Quick everyday answers' },
  { id: 'expert', label: 'Expert', hint: 'Deeper reasoning' },
  { id: 'heavy', label: 'Heavy', hint: 'Hardest problems' },
];

const PROVIDERS = {
  nvidia: { base: 'https://integrate.api.nvidia.com/v1', model: 'minimaxai/minimax-m3.1-flash' },
  minimax: { base: 'https://api.minimax.io/v1', model: 'MiniMax-M2.1' },
  openrouter: { base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
  groq: { base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' },
  pollinations: { base: 'https://gen.pollinations.ai/v1', model: 'openai/gpt-oss-20b' },
  custom: { base: 'http://localhost:11434/v1', model: '' },
};

const MEDIA_FALLBACK = {
  image: [
    { id: 'flux', title: 'FLUX (classic · keyless)' },
    { id: 'black-forest-labs/flux.1-schnell', title: 'FLUX 1.1 Schnell' },
    { id: 'tongyi-mai/z-image-turbo', title: 'Z-Image Turbo' },
    { id: 'microsoft/mai-image-2.7-flash', title: 'MAI Image 2.7 Flash' },
  ],
  video: [
    { id: 'kwaivgi/kling-v4.0-flash', title: 'Kling 4.0 Flash' },
    { id: 'bytedance/seedance-2.5-flash', title: 'Seedance 2.5 Flash' },
    { id: 'lightricks/ltx-2.5-pro', title: 'LTX 2.5 Pro' },
    { id: 'google/veo-3.1-fast', title: 'Veo 3.1 Fast' },
  ],
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiKeys: {},
  providerModels: {},
  mediaModels: { image: 'flux', video: 'kwaivgi/kling-v4.0-flash' },
  mediaCredentials: { cloudflareAccount: '', cloudflareToken: '', hfToken: '', geminiToken: '' },
  imageProvider: 'auto',
  imageRatio: '16:9',
  videoProvider: 'auto',
  provider: 'nvidia',
  baseUrl: PROVIDERS.nvidia.base,
  customModel: '',
  temperature: 0.7,
  system: '',
  tier: 'auto',
  videoRatio: '16:9',
  videoDuration: 5,
  videoLengthSeconds: 360,
  videoSceneCount: 'auto',
  songPath: '',
  lyrics: '',
  voice: 'auto',
  narration: true,
  autoMode: true,
  soundEnabled: true,
  codingFolder: '',
  modes: { agent: true, think: false, search: false, imagine: false, video: false, fun: false },
};

let chats = readJson(CHATS_KEY, []).filter((chat) => !deletedChatIds.has(String(chat?.id)));
const storedSettings = readJson(SETTINGS_KEY, {});
let settings = { ...DEFAULT_SETTINGS, ...storedSettings };
settings.modes = { ...DEFAULT_SETTINGS.modes, ...(storedSettings.modes || {}) };
// Purana "6 scenes" wala saved option ab 3/5 min videos ke liye auto ho jata hai.
const legacySceneCount = Number(settings.videoSceneCount) || 0;
if (legacySceneCount > 0 && legacySceneCount < 20) settings.videoSceneCount = 'auto';
settings.apiKeys = { ...DEFAULT_SETTINGS.apiKeys, ...(storedSettings.apiKeys || {}) };
settings.providerModels = { ...DEFAULT_SETTINGS.providerModels, ...(storedSettings.providerModels || {}) };
settings.mediaModels = { ...DEFAULT_SETTINGS.mediaModels, ...(storedSettings.mediaModels || {}) };
settings.mediaCredentials = { ...DEFAULT_SETTINGS.mediaCredentials, ...(storedSettings.mediaCredentials || {}) };
// Purana default SAPI voice tha — naya default natural AI narration hai.
if (!settings.voice || settings.voice === 'Microsoft Hazel Desktop') settings.voice = 'auto';

// Migrate older/incorrect model IDs and stale toggles from previous versions.
let needsSettingsSave = false;
// Purana 1-minute default ab kabhi 6-min story ko chhota nahi karega.
if (!storedSettings.videoLengthSeconds || Number(settings.videoLengthSeconds) === 60) {
  settings.videoLengthSeconds = 360;
  needsSettingsSave = true;
}
if (!settings.apiKeys[settings.provider] && settings.apiKey) {
  settings.apiKeys[settings.provider] = settings.apiKey;
  needsSettingsSave = true;
}
if (storedSettings.mediaKey && !settings.apiKeys.pollinations) {
  settings.apiKeys.pollinations = storedSettings.mediaKey;
  delete settings.mediaKey;
  needsSettingsSave = true;
}
if (!settings.providerModels[settings.provider] && settings.customModel) {
  settings.providerModels[settings.provider] = settings.customModel;
  needsSettingsSave = true;
}
if (settings.customModel === 'MiniMax-M3.1-Flash') {
  settings.customModel = PROVIDERS.nvidia.model;
  settings.modes.imagine = false;
  needsSettingsSave = true;
}
if (storedSettings.modes?.imagine && storedSettings.modes?.agent === undefined) {
  settings.modes.imagine = false;
  settings.modes.agent = true;
  needsSettingsSave = true;
}
if (!settings.baseUrl) {
  settings.baseUrl = PROVIDERS[settings.provider]?.base || PROVIDERS.nvidia.base;
  needsSettingsSave = true;
}
syncActiveKey();
if (needsSettingsSave) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

let activeId = null;
let availableModels = [];
let modelLoadError = '';
let allowedFolders = [];
let serverConfig = { tiers: TIER_FALLBACK, hasServerKey: false, features: {} };
let mediaCatalog = { image: MEDIA_FALLBACK.image, video: MEDIA_FALLBACK.video };
let mediaJobs = [];
let ffmpegJobs = [];
let ffmpegAvailable = false;
const nativeRequests = new Map();
let nativeRequestSeq = 0;
const mediaRendering = new Set();
const notifiedJobs = new Set();
const cancelledJobs = new Set();
const renderQueue = [];
let renderingQueue = false;
let stream = null;
let audioContext = null;
let notifiedFfmpegJobs = new Set();
let ffmpegNotifyReady = false;
let attachments = [];
let paintQueued = false;
let modelLoadTimer = null;
let mediaCredentialsTimer = null;
let recognition = null;

/* --------------------------------- utils --------------------------------- */

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    toast('Storage is full — oldest attachments were not saved');
  }
}

for (const id of readJson(DELETED_JOBS_KEY, [])) cancelledJobs.add(String(id));

function rememberDeletedJob(jobId) {
  if (!jobId) return;
  cancelledJobs.add(String(jobId));
  writeJson(DELETED_JOBS_KEY, [...cancelledJobs].slice(-500));
}

function rememberDeletedChat(chatId) {
  if (!chatId) return;
  deletedChatIds.add(String(chatId));
  writeJson(DELETED_CHATS_KEY, [...deletedChatIds].slice(-500));
}

const saveChats = () => writeJson(CHATS_KEY, chats);
const saveSettings = () => writeJson(SETTINGS_KEY, settings);
function syncActiveKey() {
  settings.apiKey = settings.apiKeys?.[settings.provider] || '';
}
function syncActiveModel() {
  if (settings.customModel) settings.providerModels[settings.provider] = settings.customModel;
}
const uid = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const appIsLocal = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
const activeChat = () => chats.find((c) => c.id === activeId) || null;
const busy = () => Boolean(stream);

function unlockAudio() {
  if (settings.soundEnabled === false) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch {
    /* audio optional */
  }
}

function playCompletionSound(kind = 'done') {
  if (settings.soundEnabled === false) return;
  try {
    unlockAudio();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const notes = kind === 'error' ? [392, 311] : [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + index * 0.13;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'error' ? 0.12 : 0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
  } catch {
    /* notifications are optional */
  }
}

function shortModel(id = '') {
  const name = id.split('/').pop() || id;
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
}

/* -------------------------------- markdown -------------------------------- */

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

function inlineMd(escaped) {
  return escaped
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function codeBlock(code, lang) {
  return (
    '<div class="code-block">' +
    `<div class="code-head"><span>${escapeHtml(lang || 'code')}</span>` +
    '<button class="copy-code" type="button">Copy</button></div>' +
    `<pre><code>${escapeHtml(code)}</code></pre></div>`
  );
}

const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let paragraph = [];
  let listTag = null;
  let i = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${inlineMd(escapeHtml(paragraph.join(' ')))}</p>`;
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listTag) {
      html += `</${listTag}>`;
      listTag = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flushParagraph();
      closeList();
      const lang = line.replace(/^\s*```/, '').trim();
      let code = '';
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code += `${lines[i]}\n`;
        i += 1;
      }
      i += 1;
      html += codeBlock(code.replace(/\n$/, ''), lang);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flushParagraph();
      closeList();
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      html += '<table><thead><tr>';
      html += head.map((cell) => `<th>${inlineMd(escapeHtml(cell))}</th>`).join('');
      html += '</tr></thead><tbody>';
      for (const row of rows) {
        html += `<tr>${head.map((_, index) => `<td>${inlineMd(escapeHtml(row[index] || ''))}</td>`).join('')}</tr>`;
      }
      html += '</tbody></table>';
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      i += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineMd(escapeHtml(heading[2]))}</h${level}>`;
      i += 1;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      closeList();
      html += '<hr>';
      i += 1;
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const tag = bullet ? 'ul' : 'ol';
      if (listTag !== tag) {
        closeList();
        html += `<${tag}>`;
        listTag = tag;
      }
      html += `<li>${inlineMd(escapeHtml((bullet || ordered)[1]))}</li>`;
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      closeList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      html += `<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`;
      continue;
    }

    paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  closeList();
  return html;
}

/* -------------------------------- sidebar -------------------------------- */

function groupLabel(ts) {
  const day = 86_400_000;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return 'Today';
  if (ts >= startOfToday - day) return 'Yesterday';
  if (ts >= startOfToday - 7 * day) return 'Previous 7 days';
  return 'Older';
}

function matchesSearch(chat, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  if ((chat.title || '').toLowerCase().includes(needle)) return true;
  return chat.messages.some((m) =>
    [m.content, m.prompt, m.job?.prompt, m.job?.step, m.error].some((value) =>
      String(value || '').toLowerCase().includes(needle),
    ),
  );
}

function renderSidebar() {
  const query = els.chatSearch.value.trim();
  els.chatList.replaceChildren();

  const visible = chats.filter((chat) => matchesSearch(chat, query));
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = query ? 'No matching chats.' : 'No chats yet.';
    els.chatList.append(empty);
    return;
  }

  let currentGroup = '';
  for (const chat of visible) {
    const group = groupLabel(chat.updatedAt || chat.createdAt || 0);
    if (group !== currentGroup) {
      currentGroup = group;
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = group;
      els.chatList.append(label);
    }

    const item = document.createElement('div');
    item.className = `chat-item${chat.id === activeId ? ' active' : ''}`;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = chat.title || 'New chat';
    item.append(title);

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.title = 'Delete chat';
    del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    del.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteChat(chat.id);
    });
    item.append(del);

    const open = () => selectChat(chat.id);
    item.addEventListener('click', open);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    els.chatList.append(item);
  }
}

/* -------------------------------- messages -------------------------------- */

function metaRow(message, isLast) {
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML =
    '<span class="nova-mark" aria-label="Nova" title="Nova">' +
    '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<rect width="32" height="32" rx="9" fill="currentColor" />' +
    '<path d="M10 23V9l12 14V9" stroke="#0b0b0c" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />' +
    '</svg></span><strong class="brand-name">Nova</strong>';

  if (message.model) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = shortModel(message.model);
    meta.append(badge);
  }
  if (message.modes?.agent) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Agent';
    meta.append(badge);
  }
  if (message.modes?.search) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Web';
    meta.append(badge);
  }
  if (message.modes?.think) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Think';
    meta.append(badge);
  }
  if (message.modes?.fun) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Fun';
    meta.append(badge);
  }
  return meta;
}

function sourcesEl(sources) {
  const details = document.createElement('details');
  details.className = 'sources';
  const summary = document.createElement('summary');
  summary.textContent = `Sources · ${sources.length}`;
  details.append(summary);

  const list = document.createElement('ol');
  for (const source of sources) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.title || source.url;
    link.title = source.url;
    li.append(link);
    const snippet = document.createElement('span');
    snippet.className = 'src-url';
    snippet.textContent = source.snippet
      ? `${source.snippet.slice(0, 140)}${source.snippet.length > 140 ? '…' : ''}`
      : source.url;
    li.append(snippet);
    list.append(li);
  }
  details.append(list);
  return details;
}

function reasoningEl(text, open) {
  const details = document.createElement('details');
  details.className = 'reasoning';
  if (open) details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Thinking';
  const body = document.createElement('div');
  body.className = 'reasoning-body';
  body.textContent = text;
  details.append(summary, body);
  return details;
}

function agentTraceEl(message, open = Boolean(message.streaming)) {
  const steps = message.steps || [];
  const tools = message.tools || [];
  const files = message.agentFiles || [];
  const images = message.agentImages || [];
  if (!steps.length && !tools.length && !files.length && !images.length) return null;

  const details = document.createElement('details');
  details.className = 'agent-trace';
  details.open = open;

  const summary = document.createElement('summary');
  summary.textContent = `Agent · ${tools.length} ${tools.length === 1 ? 'action' : 'actions'}`;
  details.append(summary);

  const list = document.createElement('div');
  list.className = 'agent-trace-list';

  for (const step of steps) {
    const row = document.createElement('div');
    row.className = 'agent-step';
    row.textContent = step;
    list.append(row);
  }

  for (const tool of tools) {
    const row = document.createElement('div');
    row.className = `agent-tool${tool.status === 'running' ? ' running' : ''}`;

    const label = document.createElement('span');
    label.className = 'tool-label';
    label.textContent = `${tool.status === 'running' ? '◌' : '✓'} ${tool.label || tool.name}`;
    row.append(label);

    const detail = document.createElement('span');
    detail.className = 'tool-detail';
    detail.textContent = tool.result
      ? tool.result.slice(0, 220)
      : JSON.stringify(tool.args || {}).slice(0, 180);
    row.append(detail);
    list.append(row);
  }

  for (const file of files) {
    const link = document.createElement('a');
    link.className = 'agent-artifact';
    link.href = file.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `📄 ${file.path}`;
    list.append(link);
  }

  for (const url of images) {
    const link = document.createElement('a');
    link.className = 'agent-artifact';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '🖼 View generated image';
    list.append(link);
  }

  details.append(list);
  return details;
}

function playerControls(video, jobId = '') {
  const row = document.createElement('div');
  row.className = 'video-controls';
  const icons = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M11 7V3L4 9l7 6v-4a6 6 0 1 1-6 6" /></svg>',
    forward: '<svg viewBox="0 0 24 24"><path d="M13 7V3l7 6-7 6v-4a6 6 0 1 0 6 6" /></svg>',
    volume: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6" /></svg>',
    muted: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zM17 10l4 4M21 10l-4 4" /></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>',
  };
  const iconButton = (key, title, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'video-control-btn';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = icons[key];
    button.addEventListener('click', handler);
    return button;
  };

  const play = iconButton('play', 'Play / Pause', async () => {
    if (video.paused || video.ended) {
      try { await video.play(); } catch (err) { toast(err?.message || 'Video play nahi hua.'); }
    } else {
      video.pause();
    }
  });
  const back = iconButton('back', 'Reverse 5 seconds', () => {
    try { video.currentTime = Math.max(0, (video.currentTime || 0) - 5); } catch { /* ignore */ }
  });
  const forward = iconButton('forward', 'Forward 5 seconds', () => {
    try { video.currentTime = Math.min(video.duration || Infinity, (video.currentTime || 0) + 5); } catch { /* ignore */ }
  });
  const mute = iconButton('volume', 'Mute / Unmute', () => {
    video.muted = !video.muted;
    mute.innerHTML = video.muted ? icons.muted : icons.volume;
  });
  const full = iconButton('full', 'Full screen', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (video.requestFullscreen) await video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else window.open(video.currentSrc || video.src, '_blank');
    } catch (err) {
      toast(err?.message || 'Full screen unavailable — Open button se dekhein.');
    }
  });
  const open = iconButton('open', 'Open in system player', () => window.open(video.currentSrc || video.src, '_blank'));

  const ratio = document.createElement('select');
  ratio.className = 'video-ratio';
  ratio.title = 'Video ratio';
  ratio.setAttribute('aria-label', 'Video ratio');
  ratio.innerHTML = '<option value="fit">Fit</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="fill">Fill</option>';
  ratio.addEventListener('change', () => {
    const value = ratio.value;
    video.style.objectFit = value === 'fill' ? 'fill' : 'contain';
    if (value === '16:9') {
      video.style.aspectRatio = '16 / 9';
      video.style.width = '100%';
      video.style.height = 'auto';
      video.style.maxHeight = '100%';
      video.style.maxWidth = '100%';
    } else if (value === '9:16') {
      video.style.aspectRatio = '9 / 16';
      video.style.width = 'auto';
      video.style.height = '100%';
      video.style.maxWidth = '100%';
    } else {
      video.style.aspectRatio = 'auto';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.maxHeight = '';
      video.style.maxWidth = '';
    }
  });

  video.addEventListener('play', () => { play.innerHTML = icons.pause; });
  video.addEventListener('pause', () => { play.innerHTML = icons.play; });
  video.addEventListener('ended', () => { play.innerHTML = icons.play; });
  video.addEventListener('error', () => {
    const fallback = document.createElement('div');
    fallback.className = 'video-error';
    fallback.textContent = 'Is browser me video decode nahi hua — Open button se system player me chalayein.';
    if (!row.parentElement?.querySelector('.video-error')) row.before(fallback);
  });

  row.append(back, play, forward, ratio, mute, full, open);
  if (jobId) row.dataset.jobId = jobId;
  return row;
}

function jobCard(message) {
  const job = message.job || {};
  const card = document.createElement('div');
  card.className = 'job-card';

  const head = document.createElement('div');
  head.className = 'job-head';
  const title = document.createElement('strong');
  const typeLabel = { story: 'Story video', song: 'Song video', meme: 'Meme video', cartoon: 'Cartoon video' }[job.type] || 'Video';
  title.textContent = `${typeLabel} · ${job.ratio || '16:9'}`;
  const badge = document.createElement('span');
  badge.className = `job-badge ${job.status || 'queued'}`;
  badge.textContent = {
    queued: 'Queued',
    assets: 'Working',
    'awaiting-render': 'Render pending',
    rendering: 'Rendering',
    done: 'Ready',
    error: 'Error',
  }[job.status] || job.status || 'Queued';
  head.append(title, badge);
  card.append(head);

  const prompt = document.createElement('div');
  prompt.className = 'job-prompt';
  prompt.textContent = job.prompt || '';
  card.append(prompt);

  const bar = document.createElement('div');
  bar.className = 'job-progress';
  const fill = document.createElement('i');
  fill.style.width = `${Math.max(0, Math.min(100, Number(job.progress) || 0))}%`;
  bar.append(fill);
  card.append(bar);

  const status = document.createElement('div');
  status.className = 'job-status';
  status.textContent = job.error || job.step || 'Waiting…';
  card.append(status);

  if (['queued', 'assets', 'awaiting-render', 'rendering'].includes(job.status)) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'ghost-btn';
    cancel.textContent = 'Cancel video';
    cancel.addEventListener('click', () => cancelMediaJob(job.id));
    card.append(cancel);
  }

  if (job.status === 'done' && job.output) {
    const url = `/workspace/${String(job.output).replace(/\\/g, '/')}`;
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;
    card.append(video, playerControls(video, job.id));

    const actions = document.createElement('div');
    actions.className = 'image-caption';
    const open = document.createElement('a');
    open.href = url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open';
    const download = document.createElement('a');
    download.href = url;
    download.download = `nova-${job.id || Date.now()}.webm`;
    download.textContent = 'Download';
    actions.append(open, download);
    card.append(actions);
  }

  if (job.status === 'error' || job.status === 'awaiting-render') {
    const resume = async (imageProvider) => {
      try {
        const response = await fetch(`/api/media-jobs/${encodeURIComponent(job.id)}/retry`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(imageProvider ? { imageProvider } : {}),
        });
        const updated = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(updated.error || 'Resume nahi hua');
        applyJobUpdate(updated);
        toast('Video wahin se resume ho raha hai — purani images dobara nahi bani gi.');
      } catch (err) {
        toast(err.message || 'Resume nahi hua');
      }
    };
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'ghost-btn';
    retry.textContent = job.status === 'awaiting-render' ? 'Resume video' : 'Resume from saved images';
    retry.addEventListener('click', () => resume());
    card.append(retry);

    const stock = document.createElement('button');
    stock.type = 'button';
    stock.className = 'ghost-btn';
    stock.textContent = 'Resume with free stock';
    stock.addEventListener('click', () => resume('stock'));
    card.append(stock);
  }

  return card;
}

function videoCard(message) {
  const card = document.createElement('div');
  card.className = 'image-card video-card';

  if (message.status === 'error') {
    const fallback = document.createElement('div');
    fallback.className = 'image-fallback';
    fallback.textContent = message.error || 'Video generation failed. Check the Media key in Settings.';
    card.append(fallback);
  } else {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = message.url;
    video.addEventListener('error', () => {
      const fallback = document.createElement('div');
      fallback.className = 'video-error';
      fallback.textContent = 'Video load nahi hua — Open button se system player me chalayein.';
      if (!card.querySelector('.video-error')) card.append(fallback);
    });
    card.append(video, playerControls(video));
  }

  const caption = document.createElement('div');
  caption.className = 'image-caption';
  const text = document.createElement('span');
  text.textContent = message.prompt || 'Generated video';
  caption.append(text);
  if (message.status !== 'error') {
    const open = document.createElement('a');
    open.href = message.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open';
    const download = document.createElement('a');
    download.href = message.url;
    download.download = `nova-video-${Date.now()}.mp4`;
    download.textContent = 'Download';
    caption.append(open, download);
  }
  card.append(caption);
  return card;
}

function imageCard(message, isLast) {
  const urls = Array.isArray(message.images) && message.images.length
    ? message.images
    : message.url
      ? [message.url]
      : [];
  const card = document.createElement('div');
  card.className = `image-card${urls.length > 1 ? ' multi' : ''}`;

  if (message.status === 'error') {
    const fallback = document.createElement('div');
    fallback.className = 'image-fallback';
    fallback.textContent = message.error || 'Image generation failed. Try again.';
    card.append(fallback);
  } else if (!urls.length) {
    const loading = document.createElement('div');
    loading.className = 'image-loading';
    loading.innerHTML =
      '<span class="image-spinner"></span>' +
      '<span class="image-loading-text">Processing your images…</span>' +
      '<span class="image-progress"><i></i></span>';
    card.append(loading);
  } else {
    const grid = document.createElement('div');
    grid.className = 'image-grid';
    urls.forEach((url, index) => {
      const item = document.createElement('div');
      item.className = 'image-item';

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const img = document.createElement('img');
      img.alt = `${message.prompt || 'Generated image'} · ${index + 1}`;
      img.loading = 'lazy';
      img.src = url;
      if (message.status === 'loading') img.style.opacity = '0.35';
      img.addEventListener('load', () => {
        img.style.opacity = '1';
        if (message.status === 'loading') {
          message.status = 'done';
          saveChats();
        }
      });
      img.addEventListener('error', () => {
        img.style.opacity = '1';
        img.classList.add('image-broken');
        img.alt = 'Image load nahi hui';
      });
      link.append(img);
      item.append(link);

      const itemCaption = document.createElement('div');
      itemCaption.className = 'image-item-caption';
      if (urls.length > 1) {
        const num = document.createElement('span');
        num.textContent = `#${index + 1}`;
        itemCaption.append(num);
      }
      const open = document.createElement('a');
      open.href = url;
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = 'Open';
      itemCaption.append(open);
      const download = document.createElement('a');
      download.href = url;
      download.download = `nova-${message.seed || Date.now()}-${index + 1}.jpg`;
      download.textContent = 'Download';
      itemCaption.append(download);
      item.append(itemCaption);
      grid.append(item);
    });
    card.append(grid);
  }

  const caption = document.createElement('div');
  caption.className = 'image-caption';
  const text = document.createElement('span');
  text.textContent = message.prompt || 'Generated image';
  caption.append(text);

  if (message.status !== 'error' && urls.length) {
    const open = document.createElement('a');
    open.href = urls[0];
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open';
    caption.append(open);

    const download = document.createElement('a');
    download.href = urls[0];
    download.download = `nova-${message.seed || Date.now()}-1.jpg`;
    download.textContent = 'Download';
    caption.append(download);
  }

  card.append(caption);
  return card;
}

function messageCopyText(message) {
  const parts = [];
  if (message.content) parts.push(message.content);
  if (message.files?.length) parts.push(message.files.map((f) => `📎 ${f.name}`).join('  ·  '));
  const images = Array.isArray(message.images) && message.images.length
    ? message.images
    : message.url
      ? [message.url]
      : [];
  if (images.length) parts.push(images.join('\n'));
  return parts.join('\n').trim();
}

function messageActions(message, index, isLast, isUser = false) {
  const foot = document.createElement('div');
  foot.className = 'msg-foot';

  const text = messageCopyText(message);
  if (text) {
    const copy = document.createElement('button');
    copy.className = 'tool-btn';
    copy.type = 'button';
    copy.title = 'Copy full message';
    copy.innerHTML =
      '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>Copy';
    copy.addEventListener('click', async () => {
      await copyText(text);
      toast('Copied');
    });
    foot.append(copy);
  }

  if (!isUser && isLast && !busy() && !['image', 'video', 'job'].includes(message.kind)) {
    const regen = document.createElement('button');
    regen.className = 'tool-btn';
    regen.type = 'button';
    regen.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>Regenerate';
    regen.addEventListener('click', regenerate);
    foot.append(regen);
  }

  if (!isUser && !['image', 'video', 'job'].includes(message.kind)) {
    for (const [value, label, icon] of [
      ['up', 'Good response', '<path d="M7 21V9l4-6 2 1v6h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7z"/><path d="M7 9H4v12h3"/>'],
      ['down', 'Bad response', '<path d="M17 3v12l-4 6-2-1v-6H5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 6.4 3H17z"/><path d="M17 15h3V3h-3"/>'],
    ]) {
      const btn = document.createElement('button');
      btn.className = `tool-btn${message.rating === value ? ' on' : ''}`;
      btn.type = 'button';
      btn.title = label;
      btn.innerHTML = `<svg viewBox="0 0 24 24">${icon}</svg>`;
      btn.addEventListener('click', () => {
        message.rating = message.rating === value ? undefined : value;
        saveChats();
        renderMessages();
        if (message.rating) toast(value === 'up' ? 'Glad it helped' : 'Thanks for the feedback');
      });
      foot.append(btn);
    }
  }

  const del = document.createElement('button');
  del.className = 'tool-btn danger';
  del.type = 'button';
  del.title = 'Delete this message';
  del.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>Delete';
  del.addEventListener('click', () => {
    deleteMessageAt(index);
    toast('Message deleted');
  });
  foot.append(del);

  return foot;
}

function buildMessage(message, index, isLast) {
  const wrap = document.createElement('div');
  wrap.dataset.index = String(index);
  wrap.className = `msg ${message.role === 'user' ? 'user' : 'ai'}`;

  // Har message ek hi card me — copy/delete dono isi box me milte hain.
  const card = document.createElement('div');
  card.className = 'msg-card';
  if (['image', 'video', 'job'].includes(message.kind)) card.classList.add('flat');
  wrap.append(card);

  if (message.role === 'user') {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message.content || '';
    if (message.queued) {
      const badge = document.createElement('span');
      badge.className = 'queued-badge';
      badge.textContent = 'Queued';
      bubble.append(badge);
    }
    for (const src of message.images || []) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Attachment';
      bubble.append(img);
    }
    if (message.files?.length) {
      const names = document.createElement('div');
      names.className = 'msg-meta';
      names.style.marginTop = '6px';
      names.textContent = message.files.map((f) => `📎 ${f.name}`).join('  ·  ');
      bubble.append(names);
    }
    card.append(bubble);
    if (!message.pending) card.append(messageActions(message, index, isLast, true));
    return wrap;
  }

  card.append(metaRow(message, isLast));

  if (message.sources?.length) card.append(sourcesEl(message.sources));
  if (message.reasoning) card.append(reasoningEl(message.reasoning, Boolean(message.streaming)));
  const trace = agentTraceEl(message);
  if (trace) card.append(trace);

  if (message.kind === 'job') {
    card.append(jobCard(message));
  } else if (message.kind === 'video') {
    card.append(videoCard(message));
  } else if (message.kind === 'image') {
    card.append(imageCard(message, isLast));
  } else {
    const body = document.createElement('div');
    body.className = 'body';
    if (message.error) {
      body.classList.add('msg-error');
      body.textContent = message.error;
    } else if (message.pending) {
      body.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>';
    } else if (message.streaming) {
      body.classList.add('streaming');
      body.innerHTML = `${escapeHtml(message.content)}<span class="cursor"></span>`;
    } else {
      body.innerHTML = renderMarkdown(message.content || '');
    }
    card.append(body);
  }

  if (!message.pending && !message.streaming) card.append(messageActions(message, index, isLast));
  return wrap;
}

function renderMessages() {
  const stick = els.chat.scrollHeight - els.chat.scrollTop - els.chat.clientHeight < 200;
  const chat = activeChat();
  const messages = chat ? chat.messages : [];
  els.welcome.hidden = messages.length > 0;
  els.messages.replaceChildren();
  messages.forEach((message, index) => {
    els.messages.append(buildMessage(message, index, index === messages.length - 1));
  });
  if (stick) els.chat.scrollTop = els.chat.scrollHeight;
}

/* ------------------------------- composer ui ------------------------------- */

function composerTopModels() {
  if (settings.provider === 'nvidia') return TOP_MODELS;
  return availableModels
    .filter((id) => !/embed|rerank|clip|guard|safety|detector|calibration/i.test(id))
    .slice(0, 8);
}

function renderTiers() {
  const tiers = serverConfig.tiers?.length ? serverConfig.tiers : TIER_FALLBACK;
  const topModels = composerTopModels();
  els.tierSelect.replaceChildren();

  for (const tier of tiers) {
    const option = document.createElement('option');
    option.value = tier.id;
    option.textContent = tier.label;
    option.title = tier.hint || '';
    els.tierSelect.append(option);
  }

  if (topModels.length) {
    const separator = document.createElement('option');
    separator.disabled = true;
    separator.textContent = '── Top free models ──';
    els.tierSelect.append(separator);

    for (const id of topModels) {
      const option = document.createElement('option');
      option.value = `model:${id}`;
      option.textContent = `✦ ${shortModel(id)}`;
      option.title = id;
      els.tierSelect.append(option);
    }
  }

  if (settings.customModel && !topModels.includes(settings.customModel)) {
    const option = document.createElement('option');
    option.value = '__custom';
    option.textContent = `Custom · ${shortModel(settings.customModel)}`;
    els.tierSelect.append(option);
  }

  if (settings.tier === 'custom' && settings.customModel) {
    els.tierSelect.value = topModels.includes(settings.customModel)
      ? `model:${settings.customModel}`
      : '__custom';
  } else {
    els.tierSelect.value = settings.tier;
  }
  if (!els.tierSelect.value) els.tierSelect.value = 'auto';
}

function renderModes() {
  for (const button of els.modes.querySelectorAll('.mode')) {
    button.classList.toggle('on', Boolean(settings.modes[button.dataset.mode]));
  }
  els.input.placeholder = settings.modes.video
    ? 'Describe the video — story, cartoon, meme, cinematic, ratio 9:16 ya 16:9'
    : settings.modes.imagine
      ? 'Describe the image you want to create'
      : settings.modes.search
        ? 'Ask anything — web search on'
        : 'Ask anything';
}

function renderAttachments() {
  els.attachments.replaceChildren();
  els.attachments.hidden = attachments.length === 0;

  for (const item of attachments) {
    const chip = document.createElement('div');
    chip.className = 'attach-chip';

    if (item.kind === 'image') {
      const img = document.createElement('img');
      img.src = item.dataUrl;
      img.alt = item.name;
      chip.append(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/></svg>';
      chip.append(icon);
    }

    const name = document.createElement('span');
    name.textContent = item.name;
    chip.append(name);

    const remove = document.createElement('button');
    remove.className = 'x';
    remove.type = 'button';
    remove.title = 'Remove';
    remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    remove.addEventListener('click', () => {
      attachments = attachments.filter((a) => a.id !== item.id);
      renderAttachments();
      syncComposer();
    });
    chip.append(remove);
    els.attachments.append(chip);
  }
}

function syncComposer() {
  const isBusy = busy();
  els.stopBtn.hidden = !isBusy;
  els.sendBtn.hidden = isBusy;
  els.sendBtn.disabled = isBusy || (!els.input.value.trim() && attachments.length === 0);
  els.input.disabled = false;
  els.topbarTitle.textContent = activeChat()?.title || 'Nova';
  els.micBtn.classList.toggle('listening', Boolean(recognition?.listening));
}

function renderAll() {
  renderSidebar();
  renderMessages();
  renderTiers();
  renderModes();
  renderAttachments();
  syncComposer();
}

/* -------------------------------- chat flow -------------------------------- */

function ensureChat() {
  let chat = activeChat();
  if (chat) return chat;
  chat = { id: uid(), title: '', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  chats.unshift(chat);
  activeId = chat.id;
  saveChats();
  renderSidebar();
  return chat;
}

function touch(chat) {
  chat.updatedAt = Date.now();
  saveChats();
}

function selectChat(id) {
  if (busy()) stopStream();
  activeId = id;
  renderAll();
  scrollToBottom(true);
  closeMobileSidebar();
}

async function removeMediaJobsForChat(chat) {
  if (!chat) return;
  const ids = new Set();
  for (const message of chat.messages || []) {
    const id = message.job?.id || message.jobId;
    if (id) ids.add(id);
  }
  for (const job of mediaJobs) {
    if (job.chatId === chat.id) ids.add(job.id);
  }
  // Server me maujud lekin chat se hataaye gaye jobs bhi pakdein — warna poll se wapas aa jate hain.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/media-jobs', { signal: controller.signal });
      const data = await response.json();
      for (const job of data.jobs || []) {
        if (job.chatId === chat.id) ids.add(job.id);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    /* local cleanup still continues */
  }
  for (const id of ids) {
    rememberDeletedJob(id);
    mediaJobs = mediaJobs.filter((job) => job.id !== id);
    mediaRendering.delete(id);
    notifiedJobs.delete(id);
    for (let queueIndex = renderQueue.length - 1; queueIndex >= 0; queueIndex -= 1) {
      if (renderQueue[queueIndex].id === id) renderQueue.splice(queueIndex, 1);
    }
    fetch(`/api/media-jobs/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }
  chats = chats.filter((item) => !deletedChatIds.has(String(item.id)));
  saveChats();
  renderAll();
}

function deleteChat(id) {
  const index = chats.findIndex((c) => c.id === id);
  if (index === -1) return;
  const chat = chats[index];
  if (stream?.chatId === id) stopStream();
  rememberDeletedChat(id);
  void removeMediaJobsForChat(chat);
  chats.splice(index, 1);
  if (activeId === id) activeId = null;
  saveChats();
  renderAll();
}

function deleteMessageAt(index) {
  const chat = activeChat();
  if (!chat || !Number.isInteger(index) || !chat.messages[index]) return;
  // Stream chal raha ho to pehle rokein, warna aborted likhna dobara aa jata hai.
  if (busy() && index >= chat.messages.length - 2) stopStream();
  const targetId = chat.messages[index].job?.id || chat.messages[index].jobId || '';
  const doomed = chat.messages.filter((message, messageIndex) =>
    messageIndex === index || (targetId && (message.job?.id || message.jobId) === targetId));
  for (const message of doomed) {
    const jobId = message.job?.id || message.jobId;
    if (!jobId) continue;
    mediaJobs = mediaJobs.filter((job) => job.id !== jobId);
    mediaRendering.delete(jobId);
    notifiedJobs.delete(jobId);
    rememberDeletedJob(jobId);
    for (let queueIndex = renderQueue.length - 1; queueIndex >= 0; queueIndex -= 1) {
      if (renderQueue[queueIndex].id === jobId) renderQueue.splice(queueIndex, 1);
    }
    fetch(`/api/media-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
  }
  chat.messages = chat.messages.filter((message) => !doomed.includes(message));
  touch(chat);
  saveChats();
  renderAll();
}

function newChat() {
  if (busy()) stopStream();
  cancelActiveMediaJobs();
  if (settings.modes.video) {
    settings.modes.video = false;
    saveSettings();
    renderModes();
  }
  activeId = null;
  renderAll();
  els.input.focus();
  closeMobileSidebar();
}

function apiMessages(chat) {
  const output = [];
  for (const message of chat.messages.slice(-40)) {
    if (message.kind === 'image' || message.error) continue;
    if (message.role === 'user') {
      let text = message.content || '';
      if (message.files?.length) {
        text += `\n\n${message.files
          .map((file) => `Attached file: ${file.name}\n\`\`\`\n${file.text}\n\`\`\``)
          .join('\n\n')}`;
      }
      if (message.images?.length) {
        output.push({
          role: 'user',
          content: [
            { type: 'text', text: text || 'What is in this image?' },
            ...message.images.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        });
      } else if (text.trim()) {
        output.push({ role: 'user', content: text });
      }
    } else if (message.content?.trim()) {
      output.push({ role: 'assistant', content: message.content });
    }
  }
  return output;
}

const queuedTurns = [];

async function send(rawText) {
  const text = String(rawText || '').trim();
  if (!text && !attachments.length) return;
  unlockAudio();

  const chat = ensureChat();
  const images = attachments.filter((a) => a.kind === 'image').map((a) => a.dataUrl);
  const files = attachments
    .filter((a) => a.kind === 'text')
    .map(({ name, text: body }) => ({ name, text: body }));
  const audio = attachments.find((a) => a.kind === 'audio');
  const userMessage = {
    role: 'user',
    content: text || (files.length ? 'Please review the attached file.' : ''),
    images,
    files,
    ts: Date.now(),
  };

  // OpenCode-style: agent chal raha ho tab bhi naya message likh sakte hain — queue me chalega.
  if (busy()) {
    chat.messages.push({ ...userMessage, queued: true });
    queuedTurns.push({ chatId: chat.id, text, audio, ts: userMessage.ts });
  } else {
    chat.messages.push(userMessage);
  }

  if (!chat.title) {
    chat.title = (text || audio?.name || files[0]?.name || 'New request').replace(/\s+/g, ' ').slice(0, 46);
  }
  attachments = [];
  renderAttachments();

  els.input.value = '';
  autoGrow();
  touch(chat);
  renderSidebar();
  renderMessages();
  syncComposer();
  scrollToBottom(true);

  if (busy()) {
    toast('Message queue me hai — current task khatam hone par chalega');
    return;
  }
  await handleUserTurn(chat, text, audio);
}

async function handleUserTurn(chat, text, audio) {
  // Studio layout voice commands — local me apply hote hain, API call nahi.
  if (await handleStudioVoiceCommand(chat, text)) return;

  // User prompt/idea/caption maang raha hai to media mode ignore karo — video mat banao.
  const asksForText = /\b(prompt|prompts|idea|ideas|caption|captions|script|likh|likho)\b/i.test(text || '');
  const wantsVideo = wantsVideoRequest(text);
  const wantsCoding = wantsCodingRequest(text) || wantsAgentOpsRequest(text);
  const wantsAgent = wantsCoding && !wantsVideo;
  if (asksForText && (settings.modes.video || settings.modes.imagine)) {
    settings.modes.video = false;
    settings.modes.imagine = false;
    saveSettings();
    renderModes();
  }

  // "Is song ki video bno" / "story video banao" — seedha pehle images, phir FFmpeg assembly.
  if (wantsVideo) {
    await startVideoJob(chat, text || 'A cinematic video', audio);
    return;
  }

  // "App banao", "cmd chalao", "test/run karo", "git push" — agent auto mode me chalao.
  if (wantsAgent) {
    settings.modes.agent = true;
    settings.modes.imagine = false;
    settings.modes.video = false;
    saveSettings();
    renderModes();
    await runAgent(chat);
    return;
  }

  if (settings.modes.video) {
    await startVideoJob(chat, text || 'A cinematic music video from the uploaded song', audio);
    // Video mode one-shot hai — agla prompt chat maange to dobara video na ban jaye.
    settings.modes.video = false;
    saveSettings();
    renderModes();
  } else if (settings.modes.imagine) {
    await generateImage(chat, text || 'A creative interpretation of the attached image');
  } else if (settings.modes.agent) {
    await runAgent(chat);
  } else {
    await runChat(chat);
  }
}

async function drainQueuedTurns() {
  if (busy() || !queuedTurns.length) return;
  const next = queuedTurns.shift();
  const chat = chats.find((item) => item.id === next.chatId);
  if (!chat) return;
  const queued = [...chat.messages].reverse().find((item) => item.role === 'user' && item.ts === next.ts);
  if (queued) delete queued.queued;
  touch(chat);
  renderMessages();
  await handleUserTurn(chat, next.text, next.audio);
}

function wantsVideoRequest(text) {
  const value = String(text || '');
  if (/\b(prompt|prompts|idea|ideas|caption|captions|script|likh|likho)\b/i.test(value)) return false;
  const noun = /\b(video|reel|reels|shorts|clip|music\s*video|song|aong|gaana|geet)\b/i;
  const verb = /\b(ban|bana|bna|bno|bnao|banayein|banaye|banao|create|make|generate|chahiye|do|de)\b/i;
  const reverseVerb = /\b(ban|bana|bna|bno|bnao|banayein|banaye|banao|create|make|generate)\b/i;
  return (noun.test(value) && verb.test(value)) || (reverseVerb.test(value) && noun.test(value));
}

function wantsCodingRequest(text) {
  const value = String(text || '');
  const noun = /\b(code|coding|app|application|website|web\s*site|site|project|software|script|file|folder|bug|fix|debug|api|backend|frontend|component|function|database|db|html|css|javascript|python|node|react|flutter|server|page|ui|cmd|command|terminal|shell|git|github|test|run|build|npm|exe)\b/i;
  const verb = /\b(ban|bana|bna|bno|bnao|banayein|banaye|banao|likh|likho|create|build|develop|implement|fix|write|do|de|chal|chala|chalao|chalayein|run|test|push|pull|commit|login|start|check|debug|install)\b/i;
  return noun.test(value) && verb.test(value);
}

function wantsAgentOpsRequest(text) {
  const value = String(text || '').toLowerCase();
  if (wantsVideoRequest(value)) return false;
  return /\b(cmd|command|terminal|shell|git|github|push|commit|pull|login|gh-cli|npm|node|python|test|run|chalao|chalayein|chala|check|start|deploy|localhost|build karo|test karo|run karo)\b/i.test(value);
}

async function runChat(chat) {
  const history = apiMessages(chat);
  if (!history.length) return;

  const modes = { think: settings.modes.think, search: settings.modes.search, fun: settings.modes.fun };
  const assistant = { role: 'assistant', content: '', reasoning: '', sources: [], modes, pending: true, ts: Date.now() };
  chat.messages.push(assistant);
  renderMessages();
  scrollToBottom();

  const controller = new AbortController();
  stream = { controller, chatId: chat.id, assistant };
  syncComposer();

  const token = settings.apiKey || '';
  const body = {
    messages: history,
    tier: settings.tier === 'custom' ? 'auto' : settings.tier,
    temperature: settings.temperature,
    system: settings.system,
    modes,
    rootDir: settings.codingFolder || '',
  };
  if (settings.customModel) body.model = settings.customModel;
  else if (settings.provider !== 'nvidia' && PROVIDERS[settings.provider]?.model) {
    body.model = PROVIDERS[settings.provider].model;
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': token,
        'x-provider': settings.provider || 'nvidia',
        'x-upstream-base': settings.baseUrl || PROVIDERS.nvidia.base,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    assistant.pending = false;
    assistant.streaming = true;
    patchAssistant(chat, assistant);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;

    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      let split;
      while ((split = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const line = raw.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;

        let event;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }

        if (event.type === 'meta') {
          assistant.model = event.model;
          if (event.sources?.length) {
            assistant.sources = event.sources;
            schedulePaint(chat, assistant);
          }
        } else if (event.type === 'delta') {
          if (event.reasoning) assistant.reasoning += event.reasoning;
          if (event.content) assistant.content += event.content;
          schedulePaint(chat, assistant);
        } else if (event.type === 'error') {
          assistant.error = event.error || 'The model stopped unexpectedly.';
        } else if (event.type === 'done') {
          done = true;
        }
      }
    }

    if (!assistant.content && !assistant.error) {
      assistant.error = 'The model returned an empty response. Try again or switch the model tier.';
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      if (!assistant.content && !assistant.reasoning) assistant.error = 'Stopped before any output.';
    } else {
      assistant.error = err.message || 'Something went wrong.';
      if (/api key|401|unauthor/i.test(assistant.error)) refreshKeyStatus();
    }
  } finally {
    assistant.pending = false;
    assistant.streaming = false;
    stream = null;
    touch(chat);
    renderMessages();
    syncComposer();
    scrollToBottom(true);
    els.input.focus();
    queueMicrotask(() => drainQueuedTurns());
  }
}

async function runAgent(chat) {
  const history = apiMessages(chat);
  if (!history.length) return;

  const modes = {
    agent: true,
    think: settings.modes.think,
    search: settings.modes.search,
    fun: settings.modes.fun,
  };
  const assistant = {
    role: 'assistant',
    content: '',
    reasoning: '',
    sources: [],
    steps: [],
    tools: [],
    agentFiles: [],
    agentImages: [],
    modes,
    pending: true,
    ts: Date.now(),
  };
  chat.messages.push(assistant);
  renderMessages();
  scrollToBottom();

  const controller = new AbortController();
  stream = { controller, chatId: chat.id, assistant };
  syncComposer();

  const body = {
    messages: history,
    tier: settings.tier === 'custom' ? 'auto' : settings.tier,
    temperature: settings.temperature,
    system: settings.system,
    modes,
    chatId: chat.id,
    rootDir: settings.codingFolder || '',
    autoMode: settings.autoMode !== false,
  };
  if (settings.customModel) body.model = settings.customModel;
  else if (settings.provider !== 'nvidia' && PROVIDERS[settings.provider]?.model) {
    body.model = PROVIDERS[settings.provider].model;
  }

  let aborted = false;
  try {
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey || '',
        'x-provider': settings.provider || 'nvidia',
        'x-upstream-base': settings.baseUrl || PROVIDERS.nvidia.base,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    assistant.pending = false;
    assistant.streaming = true;
    patchAssistant(chat, assistant);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;

    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      let split;
      while ((split = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const line = raw.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;

        let event;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }

        switch (event.type) {
          case 'meta':
            assistant.model = event.model;
            break;
          case 'step':
            assistant.steps.push(event.label || 'Working…');
            schedulePaint(chat, assistant);
            break;
          case 'tool':
            assistant.tools.push({
              name: event.name,
              label: event.label || event.name,
              args: event.args || {},
              status: 'running',
            });
            schedulePaint(chat, assistant);
            break;
          case 'tool_result': {
            const tool = [...assistant.tools]
              .reverse()
              .find((item) => item.name === event.name && item.status === 'running');
            if (tool) {
              tool.status = 'done';
              tool.result = event.result || '';
            } else {
              assistant.tools.push({
                name: event.name,
                label: event.name,
                status: 'done',
                result: event.result || '',
              });
            }
            schedulePaint(chat, assistant);
            break;
          }
          case 'file':
            assistant.agentFiles.push({ path: event.path, url: event.url });
            schedulePaint(chat, assistant);
            break;
          case 'image':
            assistant.agentImages.push(event.url);
            schedulePaint(chat, assistant);
            break;
          case 'media_job':
            applyJobUpdate(event.job);
            break;
          case 'open_url':
            assistant.content += `\n\n🌐 [Open ${event.url}](${event.url})\n`;
            schedulePaint(chat, assistant);
            try {
              window.open(event.url, '_blank', 'noopener,noreferrer');
            } catch {
              /* link is still shown in the reply */
            }
            break;
          case 'delta':
            if (event.reasoning) assistant.reasoning += event.reasoning;
            if (event.content) assistant.content += event.content;
            schedulePaint(chat, assistant);
            break;
          case 'error':
            assistant.error = event.error || 'The agent stopped unexpectedly.';
            break;
          case 'done':
            done = true;
            break;
          default:
            break;
        }
      }
    }

    if (!assistant.content && !assistant.error && !assistant.agentFiles.length && !assistant.agentImages.length) {
      assistant.error = 'The agent finished without a reply. Try again or switch models.';
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      aborted = true;
      if (!assistant.content && !assistant.reasoning && !assistant.tools.length) {
        assistant.error = 'Stopped before any output.';
      }
    } else {
      assistant.error = err.message || 'Something went wrong.';
      if (/api key|401|unauthor/i.test(assistant.error)) refreshKeyStatus();
    }
  } finally {
    if (!aborted) playCompletionSound(assistant.error ? 'error' : 'done');
    assistant.pending = false;
    assistant.streaming = false;
    stream = null;
    touch(chat);
    renderMessages();
    syncComposer();
    scrollToBottom(true);
    els.input.focus();
    queueMicrotask(() => drainQueuedTurns());
  }
}

let puterLoadPromise = null;
function loadPuter() {
  if (window.puter?.ai?.txt2img) return Promise.resolve(window.puter);
  if (!puterLoadPromise) {
    puterLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      script.onload = () =>
        window.puter ? resolve(window.puter) : reject(new Error('Puter script load nahi hua.'));
      script.onerror = () => reject(new Error('Puter script load nahi hua.'));
      document.head.appendChild(script);
    });
  }
  return puterLoadPromise;
}

function puterIsSignedIn() {
  try {
    return Boolean(window.puter?.auth?.isSignedIn?.());
  } catch {
    return false;
  }
}

async function generatePuterBrowserImage(prompt, ratio = '16:9') {
  const puter = await loadPuter();
  if (!puterIsSignedIn()) {
    throw new Error('Puter AI ke liye pehle Settings → “Enable free images” dabayein (one-click free account).');
  }
  const result = await puter.ai.txt2img(String(prompt || '').slice(0, 2048), {
    model: 'openai/gpt-image-2.6-flare',
    quality: 'low',
    aspect_ratio: ratio === '1:1' || ratio === '9:16' ? ratio : '16:9',
  });
  const src = String(result?.src || result || '');
  if (!/^(blob:|data:|https?:\/\/)/i.test(src)) throw new Error('Puter ne image URL nahi diya.');
  return src;
}

const HF_BROWSER_SPACES = [
  'https://black-forest-labs-flux-1-schnell.hf.space',
  'https://evalstate-flux1-schnell.hf.space',
];

async function fetchHfBrowserFile(ref, space, token) {
  let target = '';
  if (typeof ref === 'string') {
    target = /^https?:\/\//i.test(ref) ? ref : ref.startsWith('/') ? `${space}${ref}` : `${space}/gradio_api/file=${ref}`;
  } else if (ref?.url) {
    target = String(ref.url);
  } else if (ref?.path) {
    target = String(ref.path).startsWith('/') ? `${space}${ref.path}` : `${space}/gradio_api/file=${ref.path}`;
  } else {
    throw new Error('HF Flux ne image return nahi ki.');
  }
  const useToken = token && /(^|\.)huggingface\.co$|(^|\.)hf\.space$/i.test(new URL(target).hostname);
  const headers = useToken ? { authorization: `Bearer ${token}` } : {};
  let response = await fetch(target, { headers });
  if (!response.ok && useToken) response = await fetch(target);
  if (!response.ok) throw new Error(`HF image download failed (${response.status}).`);
  return URL.createObjectURL(await response.blob());
}

async function callHfBrowserSpace(space, prompt, width, height, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const submitted = await fetch(`${space}/gradio_api/call/infer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: [String(prompt || '').slice(0, 2048), 0, true, width, height, 4] }),
  });
  const submittedText = await submitted.text().catch(() => '');
  if (!submitted.ok) throw new Error(`HF Flux Space unavailable (${submitted.status}).`);
  let eventId = '';
  try {
    eventId = JSON.parse(submittedText).event_id || '';
  } catch {
    /* ignore */
  }
  if (!eventId) throw new Error('HF Flux ne job id nahi diya.');
  const stream = await fetch(`${space}/gradio_api/call/infer/${eventId}`, { headers });
  const raw = await stream.text();
  let imageRef = null;
  let errorDetail = '';
  for (const block of raw.split('\n\n')) {
    const event = /^event:\s*(\S+)/m.exec(block);
    const payload = /^data:\s*(.+)$/m.exec(block);
    if (!event || !payload) continue;
    if (event[1] === 'complete') {
      try {
        const parsed = JSON.parse(payload[1]);
        if (parsed && parsed[0]) imageRef = parsed[0];
      } catch {
        /* ignore */
      }
    }
    if (event[1] === 'error') errorDetail = payload[1] === 'null' ? '' : payload[1].slice(0, 120);
  }
  if (imageRef) return fetchHfBrowserFile(imageRef, space, token);
  throw new Error(`HF Flux queue busy${errorDetail ? ` (${errorDetail})` : ' (null)'}.`);
}

function hfQuotaError(data) {
  const runs = data?.runs || {};
  const remaining = Number(runs.remaining);
  const seconds = Number(data?.current);
  if (remaining !== 0 && !(seconds < 60)) return null;
  const reset = remaining === 0 ? runs.resetsAt : data?.resetsAt;
  const when = reset ? new Date(reset).toLocaleString() : 'thodi der baad';
  return new Error(
    `HF free GPU quota khatam hai (${runs.used || 0}/${runs.limit || 0} runs, ${Math.max(0, Math.floor(seconds))}s left). Reset: ${when}. Tab ${when === 'thodi der baad' ? 'thodi der baad' : 'uske baad'} try karein.`,
  );
}

async function checkHfBrowserQuota(token) {
  if (!token) return;
  let data = null;
  try {
    const response = await fetch('https://huggingface.co/api/spaces/zero-gpu/quota', {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.ok) data = await response.json().catch(() => null);
  } catch {
    return;
  }
  const error = hfQuotaError(data);
  if (error) {
    error.isHfQuota = true;
    throw error;
  }
}

async function generateHuggingFaceImageBrowser(prompt, ratio = '16:9') {
  const size = ratio === '9:16' ? [768, 1344] : ratio === '1:1' ? [1024, 1024] : [1344, 768];
  const [width, height] = size;
  const token = String(settings.mediaCredentials?.hfToken || '').trim();
  await checkHfBrowserQuota(token);
  let lastError = null;
  for (const space of HF_BROWSER_SPACES) {
    try {
      return await callHfBrowserSpace(space, prompt, width, height, token);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Hugging Face Flux abhi image nahi bana pa raha. ${lastError?.message || ''}`.trim());
}

async function loadServerImages(chat, assistant, provider, imagineUrl) {
  const response = await fetch(`${imagineUrl(provider)}&multi=1`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.images?.length) {
    throw new Error(data?.error || `Image generation failed (${response.status}).`);
  }
  assistant.images = data.images;
  assistant.url = data.images[0];
  assistant.provider = data.provider || provider;
  assistant.status = 'done';
  touch(chat);
  renderMessages();
}

async function generateImage(chat, prompt) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const provider = settings.imageProvider || DEFAULT_SETTINGS.imageProvider;
  const assistant = {
    role: 'assistant',
    kind: 'image',
    prompt,
    url: '',
    images: [],
    seed,
    status: 'loading',
    ts: Date.now(),
  };
  chat.messages.push(assistant);
  touch(chat);
  renderMessages();
  scrollToBottom();
  syncComposer();

  const isLocal = appIsLocal;
  const imagineUrl = (p) =>
    `/api/imagine?prompt=${encodeURIComponent(prompt)}&seed=${seed}` +
    `&ratio=${encodeURIComponent(settings.imageRatio || '16:9')}` +
    `&model=${encodeURIComponent(settings.mediaModels.image || 'flux')}` +
    `&provider=${encodeURIComponent(p)}`;

  if (provider === 'puter') {
    try {
      assistant.url = await generatePuterBrowserImage(prompt, settings.imageRatio || '16:9');
      assistant.images = [assistant.url];
      assistant.provider = 'puter';
      assistant.status = 'done';
      touch(chat);
      renderMessages();
      return;
    } catch (err) {
      assistant.status = 'error';
      assistant.error = err.message;
      touch(chat);
      renderMessages();
      return;
    }
  }

  // Live site par Puter signed-in ho to pehle wahi chalao — HF quota/Bing captcha se bachat.
  if (provider === 'auto' && !isLocal) {
    try {
      await loadPuter();
      if (puterIsSignedIn()) {
        assistant.url = await generatePuterBrowserImage(prompt, settings.imageRatio || '16:9');
        assistant.images = [assistant.url];
        assistant.provider = 'puter';
        assistant.status = 'done';
        touch(chat);
        renderMessages();
        return;
      }
    } catch {
      /* signed-out ya load fail — HF fallback */
    }
  }

  // Local PC image worker connected ho to seedha server par bhejo — wahan Bing UI se banega.
  const workerReady = Boolean(
    serverConfig.imageWorkerConnected || serverConfig.mediaProviders?.imageWorker,
  );
  if (provider === 'auto' && !isLocal && workerReady) {
    try {
      await loadServerImages(chat, assistant, 'auto', imagineUrl);
      return;
    } catch (err) {
      // Worker offline ho to neeche HF / direct fallback chalao.
      assistant.error = err.message;
    }
  }

  const tryBrowserHf = provider === 'huggingface' || (provider === 'auto' && !isLocal);
  if (tryBrowserHf) {
    try {
      assistant.url = await generateHuggingFaceImageBrowser(prompt, settings.imageRatio || '16:9');
      assistant.images = [assistant.url];
      assistant.provider = 'huggingface';
      assistant.status = 'done';
      touch(chat);
      renderMessages();
      return;
    } catch (err) {
      if (provider === 'huggingface') {
        assistant.status = 'error';
        assistant.error = err.message;
        touch(chat);
        renderMessages();
        return;
      }
    }
  }

  try {
    await loadServerImages(chat, assistant, provider, imagineUrl);
  } catch (err) {
    assistant.status = 'error';
    assistant.error = err.message || assistant.error || 'Image generation failed.';
    touch(chat);
    renderMessages();
  }
}

/* ------------------------------ video studio ------------------------------- */

function inferVideoType(prompt, hasAudio) {
  const text = String(prompt || '').toLowerCase();
  if (hasAudio || /\b(song|gaana|music\s*video|mp3|audio)\b/i.test(text)) return 'song';
  if (/meme|funny|comedy|joke|hassi|comedy/.test(text)) return 'meme';
  if (/cartoon|anime|comic|chibi/.test(text)) return 'cartoon';
  return 'story';
}

function inferVideoStyle(prompt, type) {
  const text = String(prompt || '').toLowerCase();
  if (/cartoon|anime|comic/.test(text)) return 'cartoon';
  if (/meme|funny|comedy/.test(text) || type === 'meme') return 'meme';
  if (/cinematic|movie|film|dramatic/.test(text) || type === 'song') return 'cinematic';
  return 'cinematic';
}

function inferVideoFx(prompt) {
  const text = String(prompt || '').toLowerCase();
  const fx = [];
  if (/glitch/.test(text)) fx.push('glitch');
  if (/shake|action/.test(text)) fx.push('shake');
  if (/sparkle|glow|magic/.test(text)) fx.push('sparkle');
  if (/zoom/.test(text)) fx.push('zoom');
  if (/pan|slide|travel/.test(text)) fx.push('pan');
  return fx.length ? fx : ['zoom', 'pan'];
}

function inferVideoTransitions(prompt) {
  const text = String(prompt || '').toLowerCase();
  const list = [];
  if (/wipe/.test(text)) list.push('wipe');
  if (/slide/.test(text)) list.push('slide');
  if (/fade|soft|emotional/.test(text)) list.push('fade');
  return list.length ? list : ['fade', 'zoom'];
}

/* ------------------------- CapCut-style video studio ----------------------- */

const STUDIO_LAYOUT_PRESETS = {
  focus: { panelWidth: 260, timelineRatio: 0.24, panelHidden: false },
  balanced: { panelWidth: 300, timelineRatio: 0.32, panelHidden: false },
  timeline: { panelWidth: 300, timelineRatio: 0.45, panelHidden: false },
};
const studioLayoutHistory = { past: [], future: [] };

function studioClamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function defaultStudioLayout() {
  const preset = STUDIO_LAYOUT_PRESETS.balanced;
  return {
    panelWidth: preset.panelWidth,
    timelineHeight: Math.round(window.innerHeight * preset.timelineRatio),
    panelHidden: false,
    locked: false,
    clipScale: 1,
    snap: true,
    splitMarks: [],
    muted: { video: false, image: false, audio: false },
  };
}

function loadStudioLayout() {
  const fallback = defaultStudioLayout();
  try {
    const saved = JSON.parse(localStorage.getItem('nova-studio-layout-v2') || '{}');
    const merged = {
      ...fallback,
      ...saved,
      muted: { ...fallback.muted, ...(saved.muted || {}) },
    };
    if (!Array.isArray(merged.splitMarks)) merged.splitMarks = [];
    return merged;
  } catch {
    return fallback;
  }
}

function saveStudioLayout() {
  try {
    localStorage.setItem('nova-studio-layout-v2', JSON.stringify(studioState.layout));
  } catch {
    /* storage unavailable — layout current session me rehta hai */
  }
}

function applyStudioLayout() {
  const layout = studioState.layout || defaultStudioLayout();
  studioState.layout = layout;
  els.studio.style.setProperty('--studio-panel-w', `${studioClamp(layout.panelWidth, 220, 520)}px`);
  els.studio.style.setProperty('--studio-timeline-h', `${studioClamp(layout.timelineHeight, 220, Math.round(window.innerHeight * 0.6))}px`);
  els.studio.style.setProperty('--studio-clip-scale', String(studioClamp(layout.clipScale ?? 1, 0.5, 2)));
  els.studio.classList.toggle('panel-hidden', Boolean(layout.panelHidden));
  els.studio.classList.toggle('layout-locked', Boolean(layout.locked));
  if (els.studioLockBtn) els.studioLockBtn.textContent = layout.locked ? 'Unlock UI' : 'Lock UI';
  if (els.studioTogglePanel) els.studioTogglePanel.textContent = layout.panelHidden ? 'Show panel' : 'Hide panel';
  if (els.studioLayoutBtn) els.studioLayoutBtn.hidden = Boolean(layout.locked);
  els.studioSnap?.classList.toggle('on', layout.snap !== false);
  if (els.studioUndo) els.studioUndo.disabled = studioLayoutHistory.past.length === 0;
  if (els.studioRedo) els.studioRedo.disabled = studioLayoutHistory.future.length === 0;
  renderStudioSplitMarks();
  applyStudioMute();
}

function snapshotStudioLayout() {
  return JSON.parse(JSON.stringify(studioState.layout || defaultStudioLayout()));
}

function setStudioLayout(patch, persist = true) {
  const before = snapshotStudioLayout();
  studioState.layout = { ...before, ...patch };
  applyStudioLayout();
  if (persist) {
    studioLayoutHistory.past.push(before);
    if (studioLayoutHistory.past.length > 30) studioLayoutHistory.past.shift();
    studioLayoutHistory.future.length = 0;
    saveStudioLayout();
    if (els.studioUndo) els.studioUndo.disabled = false;
    if (els.studioRedo) els.studioRedo.disabled = true;
  }
}

function undoStudioLayout() {
  if (!studioLayoutHistory.past.length) return;
  const current = snapshotStudioLayout();
  const previous = studioLayoutHistory.past.pop();
  studioLayoutHistory.future.push(current);
  studioState.layout = previous;
  applyStudioLayout();
  saveStudioLayout();
}

function redoStudioLayout() {
  if (!studioLayoutHistory.future.length) return;
  const current = snapshotStudioLayout();
  const next = studioLayoutHistory.future.pop();
  studioLayoutHistory.past.push(current);
  studioState.layout = next;
  applyStudioLayout();
  saveStudioLayout();
}

function applyStudioMute() {
  const muted = studioState.layout?.muted || {};
  els.studioMuteVideo?.classList.toggle('off', Boolean(muted.video));
  els.studioMuteImage?.classList.toggle('off', Boolean(muted.image));
  els.studioMuteAudio?.classList.toggle('off', Boolean(muted.audio));
  els.studioTimeline?.closest('.timeline-track')?.classList.toggle('track-muted', Boolean(muted.video));
  els.studioImageTimeline?.closest('.timeline-track')?.classList.toggle('track-muted', Boolean(muted.image));
  document.querySelector('.timeline-track--audio')?.classList.toggle('track-muted', Boolean(muted.audio));
  if (els.studioPreview) els.studioPreview.muted = Boolean(muted.video || muted.audio);
}

function toggleStudioTrack(track) {
  if (!studioState.layout) studioState.layout = loadStudioLayout();
  const muted = { ...(studioState.layout.muted || {}) };
  muted[track] = !muted[track];
  setStudioLayout({ muted });
  const label = { video: 'Video', image: 'Images', audio: 'Audio' }[track] || track;
  toast(`${label} track ${muted[track] ? 'muted' : 'unmuted'}`);
}

function renderStudioSplitMarks() {
  document.querySelectorAll('.studio-split-mark').forEach((node) => node.remove());
  const dock = document.querySelector('.timeline-dock');
  if (!dock) return;
  const marks = Array.isArray(studioState.layout?.splitMarks) ? studioState.layout.splitMarks : [];
  const duration = studioVideoDuration();
  for (const seconds of marks) {
    const mark = document.createElement('span');
    mark.className = 'studio-split-mark';
    mark.style.left = `calc(92px + (100% - 92px) * ${duration ? Math.min(1, seconds / duration) : 0})`;
    mark.title = `Split ${formatStudioClock(seconds)}`;
    dock.append(mark);
  }
}

function splitStudioAtPlayhead() {
  if (!els.studioPreview?.src) {
    toast('Pehle video render karein, phir split karein');
    return;
  }
  const seconds = Number(els.studioPreview.currentTime) || 0;
  const marks = Array.isArray(studioState.layout?.splitMarks) ? [...studioState.layout.splitMarks] : [];
  marks.push(seconds);
  setStudioLayout({ splitMarks: marks.slice(-24) });
  toast(`Split mark ${formatStudioClock(seconds)} par lag gaya`);
}

function toggleStudioSnap() {
  const snap = studioState.layout?.snap === false;
  setStudioLayout({ snap });
  toast(snap ? 'Snap on — clips se jud jayenge' : 'Snap off');
}

function zoomStudioClips(direction) {
  const current = Number(studioState.layout?.clipScale) || 1;
  const next = direction === 0 ? 1 : studioClamp(current + direction * 0.15, 0.5, 2);
  setStudioLayout({ clipScale: Number(next.toFixed(2)) });
  toast(`Timeline zoom ${Math.round(next * 100)}%`);
}

function startStudioResize(event, type) {
  if (studioState.layout?.locked) return;
  event.preventDefault();
  const handle = event.currentTarget;
  const startX = event.clientX;
  const startY = event.clientY;
  const startPanel = Number(studioState.layout?.panelWidth) || 300;
  const startTimeline = Number(studioState.layout?.timelineHeight) || 250;
  handle.classList.add('dragging');
  try { handle.setPointerCapture(event.pointerId); } catch { /* no capture */ }

  const move = (pointer) => {
    if (type === 'panel') {
      setStudioLayout({
        panelWidth: studioClamp(startPanel + pointer.clientX - startX, 220, Math.min(520, window.innerWidth - 420)),
      }, false);
    } else {
      setStudioLayout({
        timelineHeight: studioClamp(startTimeline + startY - pointer.clientY, 220, Math.round(window.innerHeight * 0.6)),
      }, false);
    }
  };
  const stop = () => {
    handle.classList.remove('dragging');
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', stop);
    handle.removeEventListener('pointercancel', stop);
    saveStudioLayout();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

function setupStudioLayoutControls() {
  studioState.layout = loadStudioLayout();
  applyStudioLayout();
  els.studioPanelResizer?.addEventListener('pointerdown', (event) => startStudioResize(event, 'panel'));
  els.studioTimelineResizer?.addEventListener('pointerdown', (event) => startStudioResize(event, 'timeline'));
  els.studioLayoutBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    els.studioLayoutMenu.hidden = !els.studioLayoutMenu.hidden;
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.timeline-tools') && els.studioLayoutMenu) els.studioLayoutMenu.hidden = true;
  });
  els.studioLayoutMenu?.addEventListener('click', (event) => {
    const preset = event.target.closest('[data-layout]')?.dataset.layout;
    if (preset && STUDIO_LAYOUT_PRESETS[preset]) {
      const chosen = STUDIO_LAYOUT_PRESETS[preset];
      setStudioLayout({
        panelWidth: chosen.panelWidth,
        timelineHeight: Math.round(window.innerHeight * chosen.timelineRatio),
        panelHidden: chosen.panelHidden,
      });
      els.studioLayoutMenu.hidden = true;
      toast(`Layout: ${preset === 'focus' ? 'Focus player' : preset === 'timeline' ? 'Long timeline' : 'Balanced'}`);
    }
  });
  els.studioTogglePanel?.addEventListener('click', () => {
    const hidden = !studioState.layout.panelHidden;
    setStudioLayout({ panelHidden: hidden });
    els.studioLayoutMenu.hidden = true;
    toast(hidden ? 'Left panel hidden' : 'Left panel shown');
  });
  els.studioResetLayout?.addEventListener('click', () => {
    setStudioLayout(defaultStudioLayout());
    els.studioLayoutMenu.hidden = true;
    toast('Layout reset');
  });
  els.studioLockBtn?.addEventListener('click', () => {
    const locked = !studioState.layout.locked;
    setStudioLayout({ locked });
    if (locked) els.studioLayoutMenu.hidden = true;
    toast(locked ? 'UI locked — ab layout fix hai' : 'UI unlocked — resize again');
  });
  els.studioUndo?.addEventListener('click', undoStudioLayout);
  els.studioRedo?.addEventListener('click', redoStudioLayout);
  els.studioExitBtn?.addEventListener('click', closeStudio);
}

function formatStudioClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function studioVideoDuration() {
  const live = Number(els.studioPreview?.duration);
  if (Number.isFinite(live) && live > 0) return live;
  const job = mediaJobs.find((item) => item.id === studioState.jobId) || mediaJobs.find((item) => item.studio);
  return Number(job?.durationSeconds) || 60;
}

function renderStudioRuler(durationSeconds) {
  if (!els.studioRuler) return;
  const total = Math.max(1, Number(durationSeconds) || 60);
  els.studioRuler.replaceChildren();
  for (let index = 0; index <= 5; index += 1) {
    const tick = document.createElement('span');
    tick.textContent = formatStudioClock((total * index) / 5);
    els.studioRuler.append(tick);
  }
}

function updateStudioPlayhead() {
  const duration = studioVideoDuration();
  const current = Number(els.studioPreview?.currentTime) || 0;
  const ratio = duration ? Math.min(1, current / duration) : 0;
  if (els.studioPlayhead) els.studioPlayhead.style.left = `calc(92px + (100% - 92px) * ${ratio})`;
  if (els.studioTimecode) els.studioTimecode.textContent = `${formatStudioClock(current)} / ${formatStudioClock(duration)}`;
}

function syncStudioPlayButton() {
  if (!els.studioTimelinePlay) return;
  const paused = !els.studioPreview || els.studioPreview.paused;
  els.studioTimelinePlay.innerHTML = paused
    ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>';
  els.studioTimelinePlay.title = paused ? 'Play' : 'Pause';
}

function studioSeekTo(seconds) {
  const duration = studioVideoDuration();
  if (!els.studioPreview || !els.studioPreview.src) return;
  try { els.studioPreview.currentTime = studioClamp(seconds, 0, duration); } catch { /* not seekable yet */ }
  updateStudioPlayhead();
}

async function toggleStudioPlayback() {
  if (!els.studioPreview?.src) {
    toast('Pehle final video render karein');
    return;
  }
  try {
    if (els.studioPreview.paused) await els.studioPreview.play();
    else els.studioPreview.pause();
  } catch (error) {
    toast(error?.message || 'Playback start nahi hua');
  }
  syncStudioPlayButton();
}

function setupStudioTimeline() {
  if (studioState.timelineReady) return;
  studioState.timelineReady = true;
  els.studioPreview?.addEventListener('timeupdate', updateStudioPlayhead);
  els.studioPreview?.addEventListener('loadedmetadata', () => {
    renderStudioRuler(studioVideoDuration());
    updateStudioPlayhead();
  });
  els.studioPreview?.addEventListener('play', syncStudioPlayButton);
  els.studioPreview?.addEventListener('pause', syncStudioPlayButton);
  els.studioTimelinePlay?.addEventListener('click', toggleStudioPlayback);
  els.studioTimelineHome?.addEventListener('click', () => studioSeekTo(0));
  els.studioPrevFrame?.addEventListener('click', () => studioSeekTo((Number(els.studioPreview?.currentTime) || 0) - 1 / 30));
  els.studioNextFrame?.addEventListener('click', () => studioSeekTo((Number(els.studioPreview?.currentTime) || 0) + 1 / 30));
  els.studioSplit?.addEventListener('click', splitStudioAtPlayhead);
  els.studioSnap?.addEventListener('click', toggleStudioSnap);
  els.studioZoomOut?.addEventListener('click', () => zoomStudioClips(-1));
  els.studioZoomFit?.addEventListener('click', () => zoomStudioClips(0));
  els.studioZoomIn?.addEventListener('click', () => zoomStudioClips(1));
  els.studioRuler?.addEventListener('click', (event) => {
    const duration = studioVideoDuration();
    const rect = els.studioRuler.getBoundingClientRect();
    const usable = Math.max(1, rect.width - 92);
    const ratio = studioClamp((event.clientX - rect.left - 92) / usable, 0, 1);
    studioSeekTo(ratio * duration);
  });
  for (const track of [els.studioTimeline, els.studioImageTimeline]) {
    track?.addEventListener('click', (event) => {
      const clip = event.target.closest('[data-start]');
      if (clip) studioSeekTo(Number(clip.dataset.start) || 0);
    });
  }
  els.studioMuteVideo?.addEventListener('click', () => toggleStudioTrack('video'));
  els.studioMuteImage?.addEventListener('click', () => toggleStudioTrack('image'));
  els.studioMuteAudio?.addEventListener('click', () => toggleStudioTrack('audio'));
  syncStudioPlayButton();
}

async function handleStudioVoiceCommand(chat, text) {
  const value = String(text || '').toLowerCase().trim();
  if (!value) return false;
  if (!/(studio|layout|panel|timeline|timlin|player|ui)\b/.test(value)) return false;

  const unlock = /\bunlock\b|(?:ui|layout|panel|studio|timeline)\s*(?:ko\s*)?unlock/.test(value);
  const lock = /\block\b|(?:ui|layout|panel|studio|timeline)\s*(?:ko\s*)?lock/.test(value);
  let reply = '';

  if (unlock) {
    setStudioLayout({ locked: false });
    reply = 'UI unlock ho gaya — ab panel aur timeline resize kar sakte ho.';
  } else if (lock) {
    setStudioLayout({ locked: true });
    reply = 'UI lock ho gaya — ab layout fixed rahega. Jab bolein "unlock UI" tabhi badlega.';
  } else if (/(?:hide|chhupa|chhupa do|band)\s*(?:the\s*)?(?:left\s*)?panel|\bpanel\s*(?:hide|chhupa)/.test(value)) {
    setStudioLayout({ panelHidden: true });
    reply = 'Left panel hide kar diya — player ko zyada jagah mil gayi.';
  } else if (/(?:show|dikha|open)\s*(?:the\s*)?(?:left\s*)?panel|\bpanel\s*(?:show|dikha)/.test(value)) {
    setStudioLayout({ panelHidden: false });
    reply = 'Left panel wapas dikha diya.';
  } else if (/(timeline|timlin).*(chota|chhota|compact|small|kam)|(player|video).*(bada|bara|large)/.test(value)) {
    const preset = STUDIO_LAYOUT_PRESETS.focus;
    setStudioLayout({
      panelWidth: preset.panelWidth,
      timelineHeight: Math.round(window.innerHeight * preset.timelineRatio),
      panelHidden: false,
    });
    reply = 'Timeline compact aur player bada kar diya.';
  } else if (/(timeline|timlin).*(bada|bara|long|large)/.test(value)) {
    const preset = STUDIO_LAYOUT_PRESETS.timeline;
    setStudioLayout({
      panelWidth: preset.panelWidth,
      timelineHeight: Math.round(window.innerHeight * preset.timelineRatio),
      panelHidden: false,
    });
    reply = 'Long timeline layout lag gaya.';
  } else if (/\bpanel\b.*(chota|chhota|small)|(player|video).*(bada|bara)/.test(value)) {
    setStudioLayout({ panelWidth: 240 });
    reply = 'Left panel chhota kar diya.';
  } else {
    return false;
  }

  chat.messages.push({ role: 'assistant', content: reply, ts: Date.now() });
  touch(chat);
  renderSidebar();
  renderMessages();
  scrollToBottom();
  return true;
}

function openStudio() {
  els.studio.hidden = false;
  els.studio.classList.add('is-editing');
  setupStudioLayoutControls();
  setupStudioTimeline();
  studioState.jobId = studioState.jobId || (mediaJobs.find((job) => job.studio)?.id || null);
  loadStudioCatalog();
  renderStudioAssets();
  renderStudioDashboard();
  clearInterval(studioState.timer);
  studioState.timer = setInterval(() => {
    loadMediaJobs();
    renderStudioDashboard();
  }, 1500);
}

function closeStudio() {
  els.studio.hidden = true;
  clearInterval(studioState.timer);
  studioState.timer = null;
}

async function loadStudioCatalog() {
  if (studioState.catalog) {
    renderStudioControls();
    return;
  }
  try {
    const response = await fetch('/api/video-studio/catalog');
    if (!response.ok) return;
    studioState.catalog = await response.json();
    renderStudioControls();
  } catch {
    /* offline — built-in fallback below */
  }
}

function studioFallbackCatalog() {
  return {
    fx: ['cinematic', 'vibrant', 'noir', 'vintage', 'glow', 'dreamy', 'neon', 'glitch', 'filmgrain', 'sharpen', 'mirror', 'chromatic', 'pixelate', 'shake', 'vignette'],
    transitions: ['fade', 'fadeblack', 'dissolve', 'zoomin', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'circleopen', 'circleclose', 'radial', 'pixelize', 'hblur'],
    visualizers: [
      { id: 'bounce', label: 'Beat bounce' }, { id: 'flicker', label: 'Beat flicker' },
      { id: 'pulse', label: 'Pulse frame' }, { id: 'eqbars', label: 'Equalizer bars' },
      { id: 'orbit', label: 'Orbit dots' }, { id: 'glitch', label: 'Glitch slices' },
      { id: 'sparkle', label: 'Sparkle rain' }, { id: 'glowpulse', label: 'Glow pulse' },
      { id: 'chroma', label: 'Chromatic flash' }, { id: 'wavelength', label: 'Wave lines' },
    ],
    presets: [
      { id: 'hollywood', label: 'Hollywood magical', fx: ['cinematic', 'glow'], transitions: ['zoomin', 'fadeblack'], visualizers: ['bounce', 'glowpulse'] },
      { id: 'cartoon', label: 'Cartoon pop', fx: ['vibrant', 'sharpen'], transitions: ['slideleft', 'zoomin'], visualizers: ['bounce', 'sparkle'] },
      { id: 'comedy', label: 'Comedy quick-cut', fx: ['vibrant', 'glitch'], transitions: ['fadefast', 'pixelize'], visualizers: ['flicker', 'glitch'] },
      { id: 'science', label: 'Science fiction', fx: ['neon', 'chromatic'], transitions: ['radial', 'hblur'], visualizers: ['chroma', 'orbit'] },
      { id: 'music', label: 'Music video', fx: ['neon', 'glow'], transitions: ['wiperight', 'zoomin'], visualizers: ['eqbars', 'wavelength'] },
    ],
    categories: ['story', 'cartoon', 'comedy', 'science fiction', 'music', 'ad / promo', 'documentary'],
  };
}

function fillStudioSelect(select, values, selected) {
  if (!select) return;
  select.replaceChildren();
  for (const value of values) {
    const option = document.createElement('option');
    option.value = typeof value === 'string' ? value : value.id;
    option.textContent = typeof value === 'string' ? value : value.label;
    select.append(option);
  }
  if (selected && values.some((value) => (typeof value === 'string' ? value : value.id) === selected)) {
    select.value = selected;
  }
}

function studioChips(container, values, selectedSet, group) {
  if (!container) return;
  container.replaceChildren();
  for (const entry of values) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const label = typeof entry === 'string' ? entry : entry.label;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `studio-chip${selectedSet.has(id) ? ' on' : ''}`;
    chip.textContent = label;
    chip.title = `${group}: ${label}`;
    chip.addEventListener('click', () => {
      if (selectedSet.has(id)) selectedSet.delete(id);
      else selectedSet.add(id);
      chip.classList.toggle('on', selectedSet.has(id));
      if (group === 'fx') els.studioFxCount.textContent = `${selectedSet.size} selected`;
      if (group === 'transitions') els.studioTransitionCount.textContent = `${selectedSet.size} selected`;
    });
    container.append(chip);
  }
}

function renderStudioPresets(presets) {
  const container = els.studioPresetGrid;
  if (!container) return;
  const notes = {
    hollywood: 'Cinematic glow',
    cartoon: 'Bright & playful',
    comedy: 'Fast cuts',
    science: 'Neon sci-fi',
    emotional: 'Soft & warm',
    music: 'Beat driven',
  };
  container.replaceChildren();
  for (const preset of presets || []) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `preset-card${preset.id === studioState.preset ? ' on' : ''}`;
    card.dataset.preset = preset.id;
    const title = document.createElement('strong');
    title.textContent = preset.label;
    const note = document.createElement('small');
    note.textContent = notes[preset.id] || 'Pro look';
    card.append(title, note);
    card.addEventListener('click', () => {
      applyStudioPreset(preset.id);
      if (els.studioPreset) els.studioPreset.value = preset.id;
    });
    container.append(card);
  }
}

function renderStudioControls() {
  const catalog = studioState.catalog || studioFallbackCatalog();
  fillStudioSelect(els.studioCategory, catalog.categories, els.studioCategory.value || 'cartoon');
  fillStudioSelect(els.studioPreset, catalog.presets || [], studioState.preset);
  renderStudioPresets(catalog.presets || []);
  fillStudioSelect(els.studioTransition, catalog.transitions, 'zoomin');
  studioChips(els.studioFx, catalog.fx, studioState.fx, 'fx');
  studioChips(els.studioTransitions, catalog.transitions, studioState.transitions, 'transitions');
  studioChips(els.studioVisualizers, catalog.visualizers, studioState.visualizers, 'visualizers');
  studioChips(els.studioAudioFx, ['compress', 'echo', 'reverb', 'denoise', 'crusher', 'crystalizer'], studioState.audioFx, 'audioFx');
  els.studioFxCount.textContent = `${studioState.fx.size} selected`;
  els.studioTransitionCount.textContent = `${studioState.transitions.size} selected`;
  if (els.studioTransition.value && !studioState.transitions.has(els.studioTransition.value)) {
    els.studioTransition.value = [...studioState.transitions][0] || catalog.transitions[0];
  }
  applyStudioPreset(studioState.preset);
}

function applyStudioPreset(id) {
  const catalog = studioState.catalog || studioFallbackCatalog();
  const preset = (catalog.presets || []).find((item) => item.id === id);
  if (!preset) return;
  studioState.preset = id;
  studioState.fx = new Set(preset.fx || []);
  studioState.transitions = new Set(preset.transitions || []);
  studioState.visualizers = new Set(preset.visualizers || []);
  els.studioPresetName.textContent = preset.label;
  for (const card of els.studioPresetGrid?.querySelectorAll('.preset-card') || []) {
    card.classList.toggle('on', card.dataset.preset === id);
  }
  studioChips(els.studioFx, catalog.fx, studioState.fx, 'fx');
  studioChips(els.studioTransitions, catalog.transitions, studioState.transitions, 'transitions');
  studioChips(els.studioVisualizers, catalog.visualizers, studioState.visualizers, 'visualizers');
  els.studioFxCount.textContent = `${studioState.fx.size} selected`;
  els.studioTransitionCount.textContent = `${studioState.transitions.size} selected`;
}

function studioAssetKind(file) {
  const type = String(file.type || '');
  const name = String(file.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/.test(name)) return 'video';
  return 'audio';
}

function renderStudioAssets() {
  const list = els.studioMediaList;
  list.replaceChildren();
  if (!studioState.assets.length) {
    const hint = document.createElement('p');
    hint.className = 'studio-hint';
    hint.textContent = 'Abhi koi file nahi.Import se image/video/audio daalein.';
    list.append(hint);
    return;
  }
  studioState.assets.forEach((asset, index) => {
    const row = document.createElement('div');
    row.className = 'studio-media-item';
    const thumb = document.createElement(asset.kind === 'video' ? 'video' : (asset.kind === 'image' ? 'img' : 'div'));
    if (asset.kind === 'image' || asset.kind === 'video') {
      thumb.src = `/api/file?path=${encodeURIComponent(asset.path)}`;
      if (asset.kind === 'video') { thumb.muted = true; thumb.preload = 'metadata'; }
    } else {
      thumb.textContent = '🎵';
      thumb.style.cssText = 'display:grid;place-items:center;font-size:20px';
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = asset.name || `asset-${index + 1}`;
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = `${asset.kind}${asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ''}${analysisText(asset)}`;
    meta.append(name, sub);
    const role = document.createElement('select');
    for (const value of ['scene', 'voice', 'bgm']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value === 'scene' ? 'Scene' : value === 'voice' ? 'Voice' : 'BGM';
      role.append(option);
    }
    role.value = asset.role || (asset.kind === 'audio' ? 'voice' : 'scene');
    role.addEventListener('change', () => { asset.role = role.value; });
    row.append(thumb, meta, role);
    list.append(row);
  });
}

function analysisText(asset) {
  if (!asset.analysis) return '';
  const info = asset.analysis;
  if (info.width) return ` · ${info.width}x${info.height}`;
  if (info.audioCodec) return ` · ${info.audioCodec}`;
  return '';
}

async function importStudioFiles(files) {
  const items = [...(files || [])];
  if (!items.length) return;
  for (const file of items) {
    toast(`Studio me import ho raha hai: ${file.name}`);
    try {
      const response = await fetch('/api/media-upload', {
        method: 'POST',
        headers: {
          'content-type': 'application/octet-stream',
          'x-file-name': encodeURIComponent(file.name),
        },
        body: file,
      });
      const uploaded = await response.json().catch(() => ({}));
      if (!response.ok || !uploaded.path) throw new Error(uploaded.error || 'Upload failed');
      const kind = studioAssetKind(file);
      const asset = {
        path: uploaded.path,
        name: uploaded.name || file.name,
        kind,
        role: kind === 'audio' ? 'voice' : 'scene',
        size: uploaded.size,
      };
      try {
        const analysisResponse = await fetch('/api/video-studio/analyze', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ path: uploaded.path }),
        });
        if (analysisResponse.ok) asset.analysis = await analysisResponse.json();
      } catch { /* analysis optional */ }
      asset.duration = Number(asset.analysis?.duration) || 0;
      studioState.assets.push(asset);
    } catch (err) {
      toast(err.message || `${file.name} import nahi hua`);
    }
  }
  renderStudioAssets();
  toast(`${items.length} file(s) studio me ready`);
}

function studioPayload() {
  const prompt = els.studioPrompt.value.trim();
  const hasSceneAssets = studioState.assets.some((asset) => asset.role === 'scene');
  if (!prompt && !hasSceneAssets) {
    toast('Idea likho ya kam se kam ek image/video import karo');
    return null;
  }
  const category = els.studioCategory.value || 'story';
  const voice = els.studioVoice.value || 'auto';
  const voiceText = { male: 'male', female: 'female', child: 'child', auto: '' }[voice] || '';
  const voiceAsset = studioState.assets.find((asset) => asset.role === 'voice');
  if (voiceAsset) els.studioNarration.checked = true;
  return {
    prompt: prompt || `Create a professional ${category} video from the uploaded media with cinematic editing.`,
    chatId: activeChat()?.id,
    studio: true,
    category,
    type: /cartoon|anime|comic/.test(category) ? 'cartoon'
      : /comedy|meme|funny/.test(category) ? 'meme'
        : /music|song|gaana/.test(category) ? 'song' : 'story',
    style: /cartoon|anime|comic/.test(category) ? 'cartoon' : 'cinematic',
    durationSeconds: Number(els.studioDuration.value) || 60,
    ratio: els.studioRatio.value || '16:9',
    sourceAssets: studioState.assets.filter((asset) => asset.role === 'scene')
      .map((asset) => ({ path: asset.path, kind: asset.kind, name: asset.name, duration: asset.duration })),
    audioPath: voiceAsset?.path || null,
    bgmPath: studioState.assets.find((asset) => asset.role === 'bgm')?.path || null,
    fx: [...studioState.fx],
    transitions: [...studioState.transitions],
    visualizers: [...studioState.visualizers],
    audioFx: [...studioState.audioFx],
    bpm: Number(els.studioBpm.value) || 0,
    narration: els.studioNarration.checked,
    voice: voiceText,
    useAiVideo: false,
    imageProvider: settings.imageProvider || DEFAULT_SETTINGS.imageProvider,
    imageModel: settings.mediaModels.image,
  };
}

async function renderStudioVideo() {
  const payload = studioPayload();
  if (!payload) return;
  els.studioRender.disabled = true;
  els.studioRender.textContent = 'Creating… autosave on';
  els.studioRenderNote.textContent = 'Story, beats, voice, images, FX, visualizers aur render — sab chal rahe hain.';
  try {
    const response = await fetch('/api/video-studio/render', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.id) throw new Error(data.error || 'Studio job shuru nahi hua');
    studioState.jobId = data.id;
    applyJobUpdate(data);
    renderStudioDashboard();
    toast('Pro video ban raha hai — sidebar me progress dekhein');
  } catch (err) {
    els.studioRenderNote.textContent = err.message || 'Render start failed';
    toast(err.message || 'Render start failed');
  } finally {
    els.studioRender.disabled = false;
    els.studioRender.textContent = 'Create video →';
  }
}

function studioDoneScenes(job) {
  const statuses = new Set(['done', 'ready', 'clip-ready', 'image-ready']);
  return (job?.scenes || []).filter((scene) => statuses.has(scene.status)).length;
}

function studioStageLabel(stage, status) {
  const labels = {
    story: 'Story ready',
    assets: 'Building scenes',
    voice: 'Voice generation',
    render: 'Final FFmpeg render',
    done: 'Ready',
  };
  if (status === 'error') return 'Paused · error';
  if (status === 'awaiting-render') return 'Waiting for render';
  return labels[stage] || 'Queued';
}

function renderStudioDashboard() {
  if (!els.studio || els.studio.hidden) return;
  const jobs = mediaJobs.filter((job) => job.studio || job.id === studioState.jobId);
  const job = jobs.find((item) => item.id === studioState.jobId) || jobs[0];
  if (!job) {
    els.studioStage.textContent = 'Ready';
    els.studioStepText.textContent = 'Video banane ke liye idea likho ya files import karein.';
    els.studioProgress.style.width = '0%';
    els.studioCounts.textContent = '0 scenes · 0 done';
    els.studioTimeline.innerHTML = '<div class="studio-hint">Scene timeline yahan dikhogi.</div>';
    if (els.studioImageTimeline) els.studioImageTimeline.innerHTML = '<div class="studio-hint">Image beats yahan dikhenge.</div>';
    renderStudioRuler(60);
    updateStudioPlayhead();
    els.studioDone.innerHTML = '<span class="studio-hint">—</span>';
    els.studioRemaining.innerHTML = '<span class="studio-hint">—</span>';
    els.studioSave.textContent = 'Autosave on';
    els.studioResumeBtn.hidden = true;
    return;
  }
  studioState.jobId = job.id;
  const scenes = job.scenes || [];
  const done = studioDoneScenes(job);
  const progress = Math.max(0, Math.min(100, Number(job.progress) || 0));
  els.studioStage.textContent = studioStageLabel(job.stage, job.status);
  els.studioStepText.textContent = job.step || job.error || '';
  els.studioProgress.style.width = `${progress}%`;
  els.studioCounts.textContent = `${scenes.length || job.sceneCount || 0} scenes · ${done} done · ${Math.round(progress)}%`;
  const remaining = Math.max(0, (scenes.length || job.sceneCount || 0) - done);
  const minutes = job.status === 'done' ? 0
    : Math.max(1, Math.ceil(remaining * 0.18 + (Number(job.durationSeconds) || 60) / 45));
  els.studioEta.textContent = job.status === 'done'
    ? 'Finished'
    : `Estimate ~${minutes} min remaining`;
  els.studioSave.textContent = job.autosaveAt
    ? `Autosaved ${new Date(job.autosaveAt).toLocaleTimeString()}`
    : 'Autosave on';

  els.studioTimeline.replaceChildren();
  if (!scenes.length) {
    const hint = document.createElement('div');
    hint.className = 'studio-hint';
    hint.textContent = 'Scenes banate hi yahan live dikhenge.';
    els.studioTimeline.append(hint);
  }
  scenes.forEach((scene, index) => {
    const node = document.createElement('div');
    const isDone = ['done', 'ready', 'clip-ready', 'image-ready'].includes(scene.status);
    node.className = `studio-scene${isDone ? ' done' : ''}${job.status === 'rendering' && index === scenes.length - 1 ? ' active' : ''}`;
    const source = scene.image || scene.video;
    if (source) {
      const thumb = document.createElement(scene.image ? 'img' : 'video');
      thumb.src = `/api/file?path=${encodeURIComponent(source)}`;
      if (scene.video) { thumb.muted = true; thumb.preload = 'metadata'; }
      node.append(thumb);
    }
    const copy = document.createElement('div');
    copy.className = 'scene-copy';
    const title = document.createElement('b');
    title.textContent = `Scene ${index + 1}`;
    const caption = document.createElement('span');
    caption.textContent = scene.caption || scene.imagePrompt || '—';
    const state = document.createElement('em');
    state.textContent = isDone ? '✓ ready' : (scene.status || 'queued');
    copy.append(title, caption, state);
    node.append(copy);
    const beat = job.visualBeats?.[index];
    const duration = Number(job.durationSeconds) || 60;
    const seconds = beat?.end > beat?.start ? beat.end - beat.start : duration / Math.max(1, scenes.length);
    const start = Number.isFinite(Number(beat?.start)) ? Number(beat.start) : (duration / Math.max(1, scenes.length)) * index;
    node.dataset.start = String(start);
    const time = document.createElement('span');
    time.className = 'clip-time';
    time.textContent = `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
    node.append(time);
    els.studioTimeline.append(node);
  });
  renderStudioImageTimeline(job, scenes);
  renderStudioRuler(Number(job.durationSeconds) || studioVideoDuration());
  updateStudioPlayhead();
  els.studioSceneCount.textContent = scenes.length ? `· ${done}/${scenes.length} ready` : '';

  const stageOrder = ['story', 'assets', 'voice', 'render'];
  const stageIndex = Math.max(0, stageOrder.indexOf(job.stage || 'story'));
  const doneStages = job.status === 'done' ? stageOrder : stageOrder.slice(0, stageIndex);
  const waitStages = job.status === 'done' ? [] : stageOrder.slice(stageIndex);
  renderStudioPills(els.studioDone, [
    ...doneStages.map((stage) => `${stage} ✓`),
    ...scenes.map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => ['done', 'ready', 'clip-ready', 'image-ready'].includes(scene.status))
      .map(({ index }) => `S${index + 1}`),
  ], 'ok');
  renderStudioPills(els.studioRemaining, [
    ...waitStages,
    ...scenes.map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !['done', 'ready', 'clip-ready', 'image-ready'].includes(scene.status))
      .map(({ index }) => `S${index + 1}`),
  ], 'wait');

  els.studioResumeBtn.hidden = !['error', 'awaiting-render'].includes(job.status);
  if (job.outputUrl && els.studioPreview.dataset.job !== job.id) {
    els.studioPreview.src = job.outputUrl;
    els.studioPreview.dataset.job = job.id;
    els.studioPreviewEmpty.hidden = true;
    if (els.studioPreview.dataset.controls !== '1') {
      els.studioPreview.parentElement.append(playerControls(els.studioPreview, job.id));
      els.studioPreview.dataset.controls = '1';
    }
  }
}

function renderStudioImageTimeline(job, scenes) {
  if (!els.studioImageTimeline) return;
  els.studioImageTimeline.replaceChildren();
  if (!scenes.length) {
    const hint = document.createElement('div');
    hint.className = 'studio-hint';
    hint.textContent = 'Image beats yahan dikhenge.';
    els.studioImageTimeline.append(hint);
    return;
  }
  const duration = Number(job.durationSeconds) || 60;
  scenes.forEach((scene, index) => {
    const beat = job.visualBeats?.[index];
    const start = Number.isFinite(Number(beat?.start)) ? Number(beat.start) : (duration / scenes.length) * index;
    const end = Number.isFinite(Number(beat?.end)) ? Number(beat.end) : start + duration / scenes.length;
    const node = document.createElement('div');
    node.className = 'studio-beat';
    node.dataset.start = String(start);
    const image = scene.image || scene.video;
    if (image) {
      const thumb = document.createElement(scene.image ? 'img' : 'video');
      thumb.src = `/api/file?path=${encodeURIComponent(image)}`;
      if (scene.video) { thumb.muted = true; thumb.preload = 'metadata'; }
      node.append(thumb);
    }
    const label = document.createElement('span');
    label.textContent = `${index + 1} · ${formatStudioClock(end - start)}`;
    node.append(label);
    els.studioImageTimeline.append(node);
  });
}

function renderStudioPills(container, items, className) {
  if (!container) return;
  container.replaceChildren();
  const shown = items.slice(-18);
  if (!shown.length) {
    const hint = document.createElement('span');
    hint.className = 'studio-hint';
    hint.textContent = '—';
    container.append(hint);
    return;
  }
  for (const item of shown) {
    const pill = document.createElement('span');
    pill.className = `studio-log-pill ${className}`;
    pill.textContent = item;
    container.append(pill);
  }
}

async function resumeStudioJob() {
  const job = mediaJobs.find((item) => item.id === studioState.jobId);
  if (!job) return;
  try {
    const response = await fetch(`/api/media-jobs/${encodeURIComponent(job.id)}/retry`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Resume nahi hua');
    applyJobUpdate(data);
    toast('Same video wahin se resume hoga');
  } catch (err) {
    toast(err.message || 'Resume failed');
  }
}

function askStudioAgent() {
  const prompt = els.studioPrompt.value.trim();
  if (!prompt) {
    toast('Agent ko ek line instruction do');
    return;
  }
  settings.modes.agent = true;
  settings.modes.video = false;
  settings.modes.imagine = false;
  settings.modes.search = false;
  settings.modes.think = false;
  saveSettings();
  renderModes();
  closeStudio();
  send(`Video Studio: ${prompt}. Complete end-to-end with create_video_studio_project — story, FX, transitions, visualizers, autosave aur final MP4 sab handle karo.`);
}

function findJobMessage(jobId) {
  for (const chat of chats) {
    const message = chat.messages.find((item) => item.kind === 'job' && item.job?.id === jobId);
    if (message) return { chat, message };
  }
  return null;
}

function upsertJobMessage(chat, job) {
  let message = chat.messages.find((item) => item.kind === 'job' && item.job?.id === job.id);
  const isNew = !message;
  if (isNew) {
    message = { role: 'assistant', kind: 'job', job, ts: Date.now() };
    chat.messages.push(message);
  } else {
    message.job = job;
  }
  chat.updatedAt = Date.now();
  saveChats();
  if (activeId === chat.id) {
    if (!isNew && message.kind === 'job') {
      // Progress updates aayein to poori chat rebuild mat karein — video card flicker/refresh rukta hai.
      patchJobCard(job);
    } else {
      renderMessages();
      scrollToBottom();
    }
  }
  renderSidebar();
}

function patchJobCard(job) {
  const found = findJobMessage(job.id);
  if (!found || found.chat.id !== activeId) return;
  const index = found.chat.messages.indexOf(found.message);
  const node = els.messages.querySelector(`.msg.ai[data-index="${index}"] .job-card`);
  if (!node) return;
  node.replaceWith(jobCard(found.message));
}

function applyJobUpdate(job) {
  if (!job?.id) return;
  if (cancelledJobs.has(job.id)) return;
  const index = mediaJobs.findIndex((item) => item.id === job.id);
  if (index === -1) mediaJobs.unshift(job);
  else mediaJobs[index] = job;

  const found = findJobMessage(job.id);
  if (found) upsertJobMessage(found.chat, job);
  else {
    const target = chats.find((item) => item.id === job.chatId) || activeChat() || ensureChat();
    upsertJobMessage(target, job);
  }

  if ((job.status === 'done' || job.status === 'error') && !notifiedJobs.has(job.id)) {
    notifiedJobs.add(job.id);
    playCompletionSound(job.status === 'done' ? 'done' : 'error');
    toast(job.status === 'done' ? 'Video ready — chat me check karein' : `Video failed: ${job.error || 'render error'}`);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(job.status === 'done' ? 'Nova · Video ready' : 'Nova · Video failed', {
          body: job.step || job.prompt || '',
        });
      } catch {
        /* notifications are optional */
      }
    }
  }

  if (job.status === 'awaiting-render' && job.scenes?.length) queueMediaRender(job);
}

function syncMediaJobs(list) {
  if (!Array.isArray(list)) return;
  // Delete ki hui video/chat server poll se dobara na aaye.
  const visibleList = list.filter((job) =>
    !cancelledJobs.has(job.id) && !deletedChatIds.has(String(job.chatId || '')));
  for (const chat of chats) {
    chat.messages = chat.messages.filter((message) => {
      const id = message.job?.id || message.jobId;
      return !id || !cancelledJobs.has(id);
    });
  }
  chats = chats.filter((chat) => !deletedChatIds.has(String(chat.id)));
  mediaJobs = visibleList;
  for (const job of visibleList) {
    const found = findJobMessage(job.id);
    if (found) {
      found.message.job = job;
      if (found.chat.id === activeId) patchJobCard(job);
    } else {
      const target = chats.find((item) => item.id === job.chatId) || activeChat() || ensureChat();
      upsertJobMessage(target, job);
    }
    const lastTouch = Number(job.updatedAt || job.createdAt || 0);
    if (job.status === 'rendering' && Date.now() - lastTouch > 60_000) {
      // Page/renderer refresh ke baad rendering status atak jata hai — dobara queue karein.
      job.status = 'awaiting-render';
      job.step = 'Render resume…';
      updateJobStatus(job, 'awaiting-render', 'Render resume…', 75);
    }
    if (job.status === 'awaiting-render' && job.scenes?.length) queueMediaRender(job);
    if ((job.status === 'done' || job.status === 'error') && !notifiedJobs.has(job.id)) {
      notifiedJobs.add(job.id);
      playCompletionSound(job.status === 'done' ? 'done' : 'error');
      toast(job.status === 'done' ? 'Video ready — chat me check karein' : `Video failed: ${job.error || 'render error'}`);
    }
  }
  saveChats();
}

async function loadMediaJobs() {
  try {
    const response = await fetch('/api/media-jobs');
    if (!response.ok) return;
    const data = await response.json();
    syncMediaJobs(data.jobs || []);
  } catch {
    /* server offline — keep local cards */
  }
}

async function updateJobStatus(job, status, step, progress) {
  try {
    await fetch(`/api/media-jobs/${encodeURIComponent(job.id)}/status`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ status, step, progress }),
    });
  } catch {
    /* the next poll will still show local progress */
  }
}

async function cancelMediaJob(jobId) {
  if (!jobId) return;
  rememberDeletedJob(jobId);
  mediaJobs = mediaJobs.filter((item) => item.id !== jobId);
  for (let i = renderQueue.length - 1; i >= 0; i -= 1) {
    if (renderQueue[i].id === jobId) renderQueue.splice(i, 1);
  }
  for (const chat of chats) {
    chat.messages = chat.messages.filter((item) => item.job?.id !== jobId);
    chat.updatedAt = Date.now();
  }
  saveChats();
  renderAll();
  try {
    await fetch(`/api/media-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
  } catch {
    /* local card already removed */
  }
}

function cancelActiveMediaJobs() {
  const active = mediaJobs.filter((job) =>
    ['queued', 'assets', 'awaiting-render', 'rendering'].includes(job.status),
  );
  for (const job of active) cancelMediaJob(job.id);
  if (active.length) toast('Stuck video job(s) cancel ho gaye');
  return active.length;
}

async function uploadAudioBlob(blob, name) {
  const response = await fetch('/api/media-upload', {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-file-name': encodeURIComponent(name || 'audio.mp3'),
    },
    body: blob,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.path) throw new Error(data.error || 'Audio upload nahi hua.');
  return data.path;
}

async function startVideoJob(chat, prompt, audioAttachment) {
  let audioPath = null;
  if (audioAttachment?.blob) {
    toast('MP3 upload ho raha hai…');
    try {
      audioPath = await uploadAudioBlob(audioAttachment.blob, audioAttachment.name);
    } catch (err) {
      toast(err.message || 'MP3 upload failed');
    }
  }

  if (!audioPath && settings.songPath) audioPath = settings.songPath;
  const type = inferVideoType(prompt, Boolean(audioPath));
  const videoProvider = settings.videoProvider || DEFAULT_SETTINGS.videoProvider;
  let requestedScenes = settings.videoSceneCount === 'auto' ? 0 : (Number(settings.videoSceneCount) || 0);
  // Song upload ya 3+ min story me purana chhota scene count (6/8) kabhi na bhejein.
  if (requestedScenes > 0 && requestedScenes < 20 && (audioPath || (Number(settings.videoLengthSeconds) || 60) >= 180)) {
    requestedScenes = 0;
  }
  // Auto scenes server par actual duration/BPM se decide hote hain — fixed 6 nahi.
  const sceneCount = type === 'meme' && !requestedScenes ? 8 : requestedScenes;
  const payload = {
    prompt,
    chatId: chat.id,
    type,
    ratio: settings.videoRatio || '16:9',
    style: inferVideoStyle(prompt, type),
    fx: inferVideoFx(prompt),
    transitions: inferVideoTransitions(prompt),
    audioPath,
    sceneCount,
    clipSeconds: Number(settings.videoDuration) || 5,
    // Song upload ho to actual MP3 length server ffprobe se lega — 3 min ka song = 3 min video.
    durationSeconds: audioPath ? 0 : Number(settings.videoLengthSeconds) || 60,
    lyrics: settings.lyrics || '',
    narration: settings.narration !== false,
    voice: settings.voice || 'Microsoft Hazel Desktop',
    useAiVideo: videoProvider === 'auto' || videoProvider === 'ltx',
    imageProvider: settings.imageProvider || DEFAULT_SETTINGS.imageProvider,
    videoProvider,
    imageModel: settings.mediaModels.image,
    videoModel: settings.mediaModels.video,
  };

  const response = await fetch('/api/media-jobs', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    const message = { role: 'assistant', content: `Video shuru nahi hua: ${data.error || response.status}`, ts: Date.now() };
    chat.messages.push(message);
    touch(chat);
    renderMessages();
    return;
  }
  applyJobUpdate(data);
  toast('Video job chal raha hai — progress chat me dikhega');
}

async function generateVideo(chat, prompt) {
  const provider = settings.videoProvider || DEFAULT_SETTINGS.videoProvider;
  const url =
    `/api/video?prompt=${encodeURIComponent(prompt)}` +
    `&model=${encodeURIComponent(settings.mediaModels.video)}` +
    `&duration=${Number(settings.videoDuration) || 5}` +
    `&ratio=${encodeURIComponent(settings.videoRatio || '16:9')}` +
    `&provider=${encodeURIComponent(provider)}`;
  const message = { role: 'assistant', kind: 'video', prompt, url, status: 'loading', ts: Date.now() };
  chat.messages.push(message);
  touch(chat);
  renderMessages();
  scrollToBottom();
  syncComposer();
}

async function syncMediaCredentials() {
  const creds = settings.mediaCredentials || {};
  try {
    const response = await fetch('/api/media-credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cloudflareAccount: String(creds.cloudflareAccount || ''),
        cloudflareToken: String(creds.cloudflareToken || ''),
        hfToken: String(creds.hfToken || ''),
        geminiToken: String(creds.geminiToken || ''),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (data.mediaProviders) {
      serverConfig.mediaProviders = data.mediaProviders;
    }
    return data;
  } catch {
    return null;
  }
}

function fillMediaSelect(select, models, selected, fallback) {
  select.replaceChildren();
  const list = Array.isArray(models) && models.length ? models : fallback;
  const ids = [...new Set(list.map((item) => String(item.id || '')).filter(Boolean))];
  if (selected && !ids.includes(selected)) ids.unshift(selected);
  for (const id of ids) {
    const item = list.find((entry) => String(entry.id) === id) || {};
    const option = document.createElement('option');
    option.value = id;
    option.textContent = item.title ? `${item.title} · ${id}` : id;
    select.append(option);
  }
  select.value = selected && ids.includes(selected) ? selected : ids[0] || '';
}

async function loadMediaModels() {
  try {
    const response = await fetch('/api/media-models', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    mediaCatalog = {
      image: Array.isArray(data.image) ? data.image : MEDIA_FALLBACK.image,
      video: Array.isArray(data.video) ? data.video : MEDIA_FALLBACK.video,
    };
  } catch {
    mediaCatalog = { image: MEDIA_FALLBACK.image, video: MEDIA_FALLBACK.video };
  }

  const savedImage = settings.mediaModels.image;
  const savedVideo = settings.mediaModels.video;
  fillMediaSelect(els.imageModelSelect, mediaCatalog.image, savedImage, MEDIA_FALLBACK.image);
  fillMediaSelect(els.videoModelSelect, mediaCatalog.video, savedVideo, MEDIA_FALLBACK.video);
  settings.mediaModels.image = els.imageModelSelect.value || 'flux';
  settings.mediaModels.video = els.videoModelSelect.value || DEFAULT_SETTINGS.mediaModels.video;
  saveSettings();
}

function loadImageElement(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadVideoElement(src) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => resolve(null);
    video.src = src;
    video.load();
  });
}

function waitForAudio(audio) {
  return new Promise((resolve) => {
    if (audio.readyState >= 2) return resolve(true);
    audio.oncanplay = () => resolve(true);
    audio.onerror = () => resolve(false);
    setTimeout(() => resolve(audio.readyState >= 2), 8000);
  });
}

function stylePalette(style) {
  if (style === 'cartoon' || style === 'anime') return ['#20234a', '#7138a6', '#ff8f6b'];
  if (style === 'meme') return ['#161616', '#4b3a00', '#f2c200'];
  return ['#071824', '#12384a', '#b45a2c'];
}

function drawCover(ctx, media, w, h, zoom, offsetX, offsetY) {
  const iw = media.videoWidth || media.naturalWidth || media.width || w;
  const ih = media.videoHeight || media.naturalHeight || media.height || h;
  const scale = Math.max(w / iw, h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2 + offsetX * w * 0.08;
  const dy = (h - dh) / 2 + offsetY * h * 0.06;
  ctx.drawImage(media, dx, dy, dw, dh);
}

function wrapCaption(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function drawCaption(ctx, job, caption, w, h) {
  const isMeme = job.style === 'meme' || job.type === 'meme';
  const fontSize = Math.max(28, Math.round((isMeme ? 0.055 : 0.045) * w));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isMeme) {
    ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
    const lines = wrapCaption(ctx, String(caption || '').toUpperCase(), w * 0.88);
    const bandHeight = lines.length * fontSize * 1.15 + 22;
    ctx.fillStyle = 'rgba(0,0,0,0.86)';
    ctx.fillRect(0, h - bandHeight, w, bandHeight);
    lines.forEach((line, index) => {
      const y = h - bandHeight + 16 + fontSize * (index + 0.55) * 1.15;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.strokeText(line, w / 2, y);
      ctx.fillStyle = '#fff';
      ctx.fillText(line, w / 2, y);
    });
    ctx.restore();
    return;
  }

  const gradient = ctx.createLinearGradient(0, h * 0.55, 0, h);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  const lines = wrapCaption(ctx, caption, w * 0.84);
  lines.forEach((line, index) => {
    const y = h - fontSize * (lines.length - index + 0.6) * 1.25 - h * 0.05;
    ctx.lineWidth = Math.max(4, fontSize * 0.14);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(line, w / 2, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, w / 2, y);
  });
  ctx.restore();
}

function drawSparkles(ctx, w, h, t, seed) {
  ctx.save();
  for (let i = 0; i < 22; i += 1) {
    const phase = (t * 0.35 + i * 0.137 + seed * 0.01) % 1;
    const x = ((i * 97 + seed * 13) % 1000) / 1000 * w;
    const y = (1 - phase) * h;
    const alpha = Math.sin(phase * Math.PI) * 0.8;
    const size = 2 + (i % 4);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGlitch(ctx, canvas, w, h, t, seed) {
  if (Math.floor(t * 1.5 + seed) % 5 !== 0) return;
  ctx.save();
  for (let i = 0; i < 5; i += 1) {
    const sy = ((i * 173 + Math.floor(t * 30) * 31) % h);
    const sh = 8 + (i % 3) * 12;
    const shift = ((i % 2 ? 1 : -1) * (8 + (i % 4) * 6));
    ctx.drawImage(canvas, 0, sy, w, sh, shift, sy, w, sh);
  }
  ctx.fillStyle = 'rgba(255,0,90,0.08)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawFrame(ctx, canvas, job, scenes, images, clips, w, h, index, local, t) {
  const fx = Array.isArray(job.fx) ? job.fx : [];
  const transitions = Array.isArray(job.transitions) ? job.transitions : ['fade'];
  const palette = stylePalette(job.style);
  const background = ctx.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, palette[0]);
  background.addColorStop(0.55, palette[1]);
  background.addColorStop(1, palette[2]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  if (fx.includes('shake')) ctx.translate(Math.sin(t * 21) * 5, Math.cos(t * 29) * 5);

  const drawScene = (sceneIndex, alpha, offsetX = 0, zoomBoost = 1) => {
    const media = clips[sceneIndex]?.readyState >= 2 ? clips[sceneIndex] : images[sceneIndex];
    if (!media) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const zoom = 1.04 + local * (fx.includes('zoom') ? 0.16 : 0.07);
    const pan = fx.includes('pan') ? Math.sin((local + sceneIndex * 0.2) * Math.PI) : 0;
    drawCover(ctx, media, w, h, zoom * zoomBoost, pan + offsetX, Math.cos(local * Math.PI) * 0.3);
    ctx.restore();
  };

  const transitionTime = 0.45;
  if (index > 0 && local < transitionTime) {
    const progress = local / transitionTime;
    drawScene(index - 1, 1 - progress);
    if (transitions.includes('slide')) drawScene(index, progress, 1 - progress);
    else if (transitions.includes('wipe')) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * progress, h);
      ctx.clip();
      drawScene(index, 1);
      ctx.restore();
    } else if (transitions.includes('zoom')) drawScene(index, progress, 0, 0.92 + progress * 0.08);
    else drawScene(index, progress);
  } else {
    drawScene(index, 1);
  }
  ctx.restore();

  if (fx.includes('sparkle')) drawSparkles(ctx, w, h, t, index + 1);
  if (fx.includes('fade')) {
    const edge = Math.min(local, 1 - local);
    if (edge < 0.12) {
      ctx.fillStyle = `rgba(0,0,0,${(0.12 - edge) / 0.12 * 0.55})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  drawGlitch(ctx, canvas, w, h, t, index + 1);

  if (job.type === 'song') {
    ctx.save();
    const bars = 34;
    const barWidth = w / (bars * 1.8);
    for (let i = 0; i < bars; i += 1) {
      const amplitude = 12 + Math.abs(Math.sin(t * 4 + i * 0.7)) * (h * 0.06);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = i % 3 === 0 ? '#ff7ab6' : '#8ad7ff';
      ctx.fillRect((w - bars * barWidth * 1.8) / 2 + i * barWidth * 1.8, h * 0.12 - amplitude / 2, barWidth, amplitude);
    }
    ctx.restore();
  }

  drawCaption(ctx, job, scenes[index]?.caption || job.prompt, w, h);

  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${Math.max(15, Math.round(w * 0.018))}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('NOVA STUDIO', w - w * 0.04, h * 0.055);
  ctx.restore();
}

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((mime) => MediaRecorder.isTypeSupported(mime)) || '';
}

function queueMediaRender(job) {
  if (!job?.id || mediaRendering.has(job.id)) return;
  mediaRendering.add(job.id);
  renderQueue.push(job);
  if (!renderingQueue) processRenderQueue();
}

async function processRenderQueue() {
  renderingQueue = true;
  while (renderQueue.length) {
    const job = renderQueue.shift();
    try {
      await renderJobVideo(job);
    } catch (err) {
      const message = String(err?.message || err).slice(0, 500);
      try {
        await fetch(`/api/media-jobs/${encodeURIComponent(job.id)}/error`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ error: message }),
        });
        await loadMediaJobs();
      } catch {
        /* keep the local card visible */
      }
      toast(`Video render failed: ${message}`);
    } finally {
      mediaRendering.delete(job.id);
    }
  }
  renderingQueue = false;
}

async function renderJobVideo(job) {
  if (typeof MediaRecorder === 'undefined') throw new Error('Ye browser MediaRecorder support nahi karta — Chrome ya Edge use karein.');
  const mime = pickRecorderMime();
  if (!mime) throw new Error('Browser me WebM recorder available nahi hai — Chrome ya Edge use karein.');

  const scenes = Array.isArray(job.scenes) ? job.scenes : [];
  if (!scenes.length) throw new Error('Video ke liye koi scene nahi mila.');

  const ratio = job.ratio === '9:16' ? '9:16' : '16:9';
  // WebView2 me 1280x720 @24fps MediaRecorder kabhi-kabhi renderer ko crash karta tha.
  const w = ratio === '9:16' ? 540 : 960;
  const h = ratio === '9:16' ? 960 : 540;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D unavailable.');

  await updateJobStatus(job, 'rendering', `Assets load ho rahe hain (${ratio})…`, 76);
  const imageSrcs = scenes.map((scene) => `/workspace/${String(scene.image || '').replace(/\\/g, '/')}`);
  const clipSrcs = scenes.map((scene) => (scene.video ? `/workspace/${String(scene.video).replace(/\\/g, '/')}` : null));
  const images = await Promise.all(imageSrcs.map((src) => (src.includes('undefined') ? Promise.resolve(null) : loadImageElement(src))));
  const clips = await Promise.all(clipSrcs.map((src) => (src ? loadVideoElement(src) : Promise.resolve(null))));
  if (!images.some(Boolean)) throw new Error('Scene images load nahi hui — server ya files check karein.');

  let audio = null;
  let mediaStream = null;
  if (job.audioPath) {
    audio = new Audio(`/workspace/${String(job.audioPath).replace(/\\/g, '/')}`);
    audio.preload = 'auto';
    const ready = await waitForAudio(audio);
    if (ready) {
      // WebAudio graph ke jagah direct captureStream — WebView2 me zyada stable.
      try { mediaStream = audio.captureStream ? audio.captureStream() : null; } catch { mediaStream = null; }
    } else {
      audio = null;
    }
  }

  const stream = canvas.captureStream(15);
  mediaStream?.getAudioTracks().forEach((track) => stream.addTrack(track));
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: ratio === '9:16' ? 1_800_000 : 2_400_000,
  });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    recorder.onerror = (event) => reject(event.error || new Error('Recorder failed.'));
    recorder.onstop = () => resolve();
  });

  const clipMs = Math.max(2000, Math.min(10000, Number(job.clipSeconds) || 4)) * 1000;
  const totalMs = scenes.length * clipMs;
  const fps = 15;
  const started = performance.now();
  let lastReport = 0;

  await updateJobStatus(job, 'rendering', `Rendering · ${scenes.length} scenes · ${ratio}`, 78);
  recorder.start(500);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
  clips.forEach((clip) => clip?.play().catch(() => {}));

  const hardDeadline = totalMs + 60_000;
  const timer = setInterval(() => {
    const rawElapsed = performance.now() - started;
    const elapsed = Math.min(totalMs, rawElapsed);
    const t = elapsed / 1000;
    const index = Math.min(scenes.length - 1, Math.floor(elapsed / clipMs));
    const local = Math.min(1, (elapsed - index * clipMs) / clipMs);
    drawFrame(ctx, canvas, job, scenes, images, clips, w, h, index, local, t);

    if (elapsed - lastReport > 2000) {
      lastReport = elapsed;
      const percent = 78 + Math.round((elapsed / totalMs) * 21);
      updateJobStatus(job, 'rendering', `Rendering scene ${index + 1}/${scenes.length} · ${ratio}`, percent);
    }
    if (cancelledJobs.has(job.id)) {
      clearInterval(timer);
      audio?.pause();
      clips.forEach((clip) => clip?.pause());
      recorder.stop();
    } else if (rawElapsed >= hardDeadline) {
      clearInterval(timer);
      updateJobStatus(job, 'rendering', 'Render timeout — partial video save ho raha hai…', 98);
      recorder.stop();
    } else if (elapsed >= totalMs) {
      clearInterval(timer);
      recorder.stop();
    }
  }, 1000 / fps);

  await finished;
  if (cancelledJobs.has(job.id)) {
    audio?.pause();
    clips.forEach((clip) => clip?.pause());
    mediaStream?.getTracks().forEach((track) => track.stop());
    stream.getTracks().forEach((track) => track.stop());
    return;
  }
  audio?.pause();
  clips.forEach((clip) => clip?.pause());
  mediaStream?.getTracks().forEach((track) => track.stop());
  stream.getTracks().forEach((track) => track.stop());

  const blob = new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' });
  if (!blob.size) throw new Error('Recorder ne koi data nahi diya.');
  await updateJobStatus(job, 'rendering', 'Final video save ho raha hai…', 99);
  const response = await fetch(`/api/media-jobs/${encodeURIComponent(job.id)}/render`, {
    method: 'POST',
    headers: {
      'content-type': blob.type || 'video/webm',
      'x-media-extension': 'webm',
    },
    body: blob,
  });
  const done = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(done.error || 'Final video save nahi hua.');
  applyJobUpdate(done);
}

function patchAssistant(chat, assistant) {
  if (activeId !== chat.id) return;
  const index = chat.messages.indexOf(assistant);
  if (index === -1) return;

  const node = els.messages.querySelector(`.msg.ai[data-index="${index}"]`);
  if (!node) return;

  if (assistant.sources?.length && !node.querySelector('.sources')) {
    const meta = node.querySelector('.msg-meta');
    meta.insertAdjacentElement('afterend', sourcesEl(assistant.sources));
  }

  if (assistant.reasoning && !node.querySelector('.reasoning')) {
    const body = node.querySelector('.body');
    body.insertAdjacentElement('beforebegin', reasoningEl(assistant.reasoning, true));
  }
  const reasoningBody = node.querySelector('.reasoning-body');
  if (reasoningBody) reasoningBody.textContent = assistant.reasoning;

  const body = node.querySelector('.body');
  if (!body) return;

  const hasTrace =
    assistant.steps?.length || assistant.tools?.length || assistant.agentFiles?.length || assistant.agentImages?.length;
  const oldTrace = node.querySelector('.agent-trace');
  if (hasTrace) {
    const open = oldTrace ? oldTrace.open : Boolean(assistant.streaming);
    const fresh = agentTraceEl(assistant, open);
    if (oldTrace) oldTrace.replaceWith(fresh);
    else body.insertAdjacentElement('beforebegin', fresh);
  } else if (oldTrace) {
    oldTrace.remove();
  }

  if (assistant.pending) {
    body.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>';
    return;
  }
  if (assistant.streaming) {
    body.classList.add('streaming');
    body.innerHTML = `${escapeHtml(assistant.content)}<span class="cursor"></span>`;
  } else if (assistant.error) {
    body.classList.remove('streaming');
    body.classList.add('msg-error');
    body.textContent = assistant.error;
  } else {
    body.classList.remove('streaming');
    body.innerHTML = renderMarkdown(assistant.content);
  }
}

function schedulePaint(chat, assistant) {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => {
    paintQueued = false;
    patchAssistant(chat, assistant);
    scrollToBottom();
  });
}

function stopStream() {
  if (!stream) return;
  els.stopBtn.hidden = true;
  stream.controller.abort();
}

function regenerate() {
  const chat = activeChat();
  if (!chat || busy()) return;

  let lastUser = -1;
  for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
    if (chat.messages[i].role === 'user') {
      lastUser = i;
      break;
    }
  }
  if (lastUser === -1) return;

  const previous = chat.messages[lastUser + 1];
  const prompt = chat.messages[lastUser].content;
  chat.messages = chat.messages.slice(0, lastUser + 1);
  touch(chat);
  renderMessages();

  if (previous?.kind === 'image') generateImage(chat, prompt);
  else runChat(chat);
}

/* ------------------------------- attachments ------------------------------- */

async function downscaleImage(file, maxSide = 900) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

const TEXT_EXT = /\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|py|rb|go|rs|java|c|h|cpp|cs|php|html|css|scss|yml|yaml|toml|ini|sh|bat|sql|log)$/i;

async function addFiles(fileList) {
  const files = [...fileList];
  for (const file of files) {
    if (attachments.length >= 6) {
      toast('Up to 6 attachments per message');
      break;
    }
    const base = { id: uid(), name: file.name };

    if (file.type.startsWith('image/')) {
      try {
        const dataUrl = await downscaleImage(file);
        attachments.push({ ...base, kind: 'image', dataUrl, size: dataUrl.length });
      } catch {
        toast(`Could not read ${file.name}`);
      }
      continue;
    }

    const looksText = file.type.startsWith('text/') || TEXT_EXT.test(file.name) || file.type === 'application/json';
    if (looksText && file.size <= 400_000) {
      const text = await file.text();
      attachments.push({ ...base, kind: 'text', text: text.slice(0, 120_000), size: text.length });
      continue;
    }

    const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name);
    if (isAudio && file.size <= 80 * 1024 * 1024) {
      attachments.push({ ...base, kind: 'audio', blob: file, size: file.size });
      continue;
    }

    toast(`${file.name}: unsupported (text, images or MP3 audio only)`);
  }
  renderAttachments();
  syncComposer();
}

/* ---------------------------------- voice ---------------------------------- */

function toggleMic() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast('Voice input is not supported in this browser');
    return;
  }
  if (recognition?.listening) {
    recognition.stop();
    return;
  }

  const instance = new Recognition();
  instance.lang = navigator.language || 'en-US';
  instance.interimResults = true;
  instance.continuous = false;
  recognition = instance;
  instance.listening = true;

  const base = els.input.value;
  instance.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    els.input.value = `${base}${base && !base.endsWith(' ') ? ' ' : ''}${transcript}`;
    autoGrow();
    syncComposer();
  };
  instance.onend = () => {
    instance.listening = false;
    if (recognition === instance) recognition = null;
    syncComposer();
    els.input.focus();
  };
  instance.onerror = () => {
    instance.listening = false;
    if (recognition === instance) recognition = null;
    syncComposer();
  };

  instance.start();
  syncComposer();
}

/* ---------------------------------- misc ---------------------------------- */

function autoGrow() {
  els.input.style.height = 'auto';
  els.input.style.height = `${Math.min(els.input.scrollHeight, 210)}px`;
}

function scrollToBottom(force = false) {
  const nearBottom = els.chat.scrollHeight - els.chat.scrollTop - els.chat.clientHeight < 160;
  if (force || nearBottom) els.chat.scrollTop = els.chat.scrollHeight;
}

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function openMobileSidebar() {
  els.app.classList.add('mobile-open');
  els.scrim.hidden = false;
}

function closeMobileSidebar() {
  els.app.classList.remove('mobile-open');
  els.scrim.hidden = true;
}

function isNarrowLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function showSidebar() {
  if (isNarrowLayout()) openMobileSidebar();
  else els.app.classList.remove('collapsed');
}

function toggleSidebar() {
  if (isNarrowLayout()) {
    if (els.app.classList.contains('mobile-open')) closeMobileSidebar();
    else openMobileSidebar();
    return;
  }
  els.app.classList.toggle('collapsed');
}

function focusChatSearch() {
  showSidebar();
  requestAnimationFrame(() => {
    els.chatSearch.focus();
    els.chatSearch.select();
  });
}

function openSettings() {
  els.providerSelect.value = settings.provider || 'nvidia';
  els.baseUrlInput.value = settings.baseUrl || PROVIDERS.nvidia.base;
  els.apiKeyProvider.textContent = String(settings.provider || 'nvidia').toUpperCase();
  els.apiKeyInput.value = settings.apiKeys?.[settings.provider] || '';
  els.imageProviderSelect.value = settings.imageProvider || DEFAULT_SETTINGS.imageProvider;
  els.imageRatioSelect.value = settings.imageRatio || DEFAULT_SETTINGS.imageRatio;
  els.videoProviderSelect.value = settings.videoProvider || DEFAULT_SETTINGS.videoProvider;
  els.cfAccountInput.value = settings.mediaCredentials?.cloudflareAccount || '';
  els.cfTokenInput.value = settings.mediaCredentials?.cloudflareToken || '';
  els.hfTokenInput.value = settings.mediaCredentials?.hfToken || '';
  if (els.geminiTokenInput) els.geminiTokenInput.value = settings.mediaCredentials?.geminiToken || '';
  fillMediaSelect(els.imageModelSelect, mediaCatalog.image, settings.mediaModels.image, MEDIA_FALLBACK.image);
  fillMediaSelect(els.videoModelSelect, mediaCatalog.video, settings.mediaModels.video, MEDIA_FALLBACK.video);
  els.videoRatioSelect.value = settings.videoRatio || '16:9';
  els.videoDurationSelect.value = String(settings.videoDuration || 5);
  els.videoLengthSelect.value = String(settings.videoLengthSeconds || 60);
  els.sceneCountSelect.value = settings.videoSceneCount || 'auto';
  els.songPath.value = settings.songPath || '';
  els.lyricsInput.value = settings.lyrics || '';
  const voiceValue = settings.voice || 'auto';
  const voicePresetMap = {
    'gemini:Kore': 'female', 'gemini:Charon': 'male', 'gemini:Puck': 'child',
    'openai:nova': 'female', 'openai:onyx': 'male', 'openai:alloy': 'auto',
  };
  const presetValue = ['auto', 'male', 'female', 'child'].includes(voiceValue)
    ? voiceValue
    : voicePresetMap[voiceValue] || 'custom';
  if (els.voicePreset) els.voicePreset.value = presetValue;
  els.voiceInput.value = presetValue === 'custom' ? voiceValue : '';
  els.narrationToggle.checked = settings.narration !== false;
  if (els.autoModeToggle) els.autoModeToggle.checked = settings.autoMode !== false;
  if (els.soundToggle) els.soundToggle.checked = settings.soundEnabled !== false;
  updateFolderButton();
  els.modelInput.value = settings.customModel || '';
  els.tempInput.value = String(settings.temperature ?? 0.7);
  els.tempValue.textContent = Number(settings.temperature ?? 0.7).toFixed(1);
  els.systemInput.value = settings.system || '';
  els.modelFilter.value = '';
  renderModelList();
  els.modal.hidden = false;
  els.apiKeyInput.focus();
}

function closeSettings() {
  els.modal.hidden = true;
}

async function refreshKeyStatus() {
  const hasKey = Boolean(settings.apiKey) || Boolean(serverConfig.serverKeys?.[settings.provider]);
  const provider = String(settings.provider || 'nvidia').toUpperCase();
  els.statusDot.classList.toggle('ok', hasKey);
  els.statusDot.classList.toggle('bad', !hasKey);
  els.keyLabel.textContent = `${hasKey ? 'Ready' : 'No key'} · ${provider}`;
  els.keyBanner.hidden = hasKey;
}

function renderModelList() {
  const filter = els.modelFilter.value.trim().toLowerCase();
  const list = availableModels.filter((id) => !filter || id.toLowerCase().includes(filter));
  els.modelList.replaceChildren();

  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'help';
    empty.style.padding = '10px';
    empty.textContent = availableModels.length
      ? 'No models match that filter.'
      : modelLoadError
        ? `Models load nahi hue: ${modelLoadError}`
        : 'No models loaded. Pehle provider chuno, phir uski API key paste karein.';
    els.modelList.append(empty);
    return;
  }

  for (const id of list) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `model-row${settings.customModel === id ? ' active' : ''}`;

    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.textContent = settings.customModel === id ? '✓' : '';
    row.append(tick);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = id;
    name.title = id;
    row.append(name);

    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = TOP_MODELS.includes(id)
      ? 'top free'
      : /embed|rerank|clip|guard|safety|detector|calibration/i.test(id)
        ? 'utility'
        : /reason|think|omni/i.test(id)
          ? 'reasoning'
          : 'chat';
    row.append(kind);

    row.addEventListener('click', () => {
      settings.customModel = id;
      settings.tier = 'custom';
      els.modelInput.value = id;
      syncActiveModel();
      saveSettings();
      renderModelList();
      renderTiers();
      syncComposer();
      toast(`Model: ${id.split('/').pop()}`);
    });

    els.modelList.append(row);
  }
}

async function loadModels() {
  els.modelCount.textContent = 'Loading…';
  modelLoadError = '';
  try {
    const response = await fetch('/api/models', {
      headers: {
        'x-api-key': settings.apiKey || '',
        'x-provider': settings.provider || 'nvidia',
        'x-upstream-base': settings.baseUrl || PROVIDERS.nvidia.base,
      },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load models');
    availableModels = (data.models || []).sort((a, b) => {
      const ai = TOP_MODELS.indexOf(a);
      const bi = TOP_MODELS.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.localeCompare(b);
    });
    els.modelCount.textContent = `${availableModels.length} models`;
  } catch (err) {
    availableModels = [];
    modelLoadError = err.message || 'Could not load models';
    els.modelCount.textContent = 'Load error';
  }

  els.modelOptions.replaceChildren();
  const ids = [...new Set([...availableModels, settings.customModel].filter(Boolean))];
  for (const id of ids) {
    const option = document.createElement('option');
    option.value = id;
    els.modelOptions.append(option);
  }
  renderModelList();
  renderTiers();
}

function apiHeaders() {
  return {
    'content-type': 'application/json',
    'x-api-key': settings.apiKey || '',
    'x-provider': settings.provider || 'nvidia',
    'x-upstream-base': settings.baseUrl || PROVIDERS.nvidia.base,
  };
}

function defaultDate() {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWhen(ms) {
  if (!Number.isFinite(ms)) return 'Manual only';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

function buildYouTubePrompt() {
  const date = els.scheduleDate.value;
  const time = els.scheduleTime.value;
  if (!date || !time) return '';

  const publish = new Date(`${date}T${time}:00`);
  const iso = publish.toISOString();
  const file = els.videoFile.value.trim() || '(path not given — search the allowed folder for the video)';
  const topic = els.videoTopic.value.trim() || 'infer the topic from the video';
  const slug = `${date}-youtube-package`;

  return [
    'You are a YouTube upload-preparation agent. Finish the whole package, not just a plan.',
    `Publish slot: ${date} ${time} (local time), ISO ${iso}.`,
    `Video file: ${file}. Topic/niche: ${topic}.`,
    'Steps:',
    '1. List the allowed folder and locate the video file. If it is missing, say so clearly and stop.',
    '2. Write an SEO title under 60 characters, a description with timestamps/chapters, 12–15 hashtags, 20 tags, a category and a thumbnail idea.',
    `3. Save the complete metadata package as youtube/${slug}.md inside the allowed folder.`,
    '4. Generate youtube_upload.py using google-api-python-client with OAuth. It must set privacyStatus="private" and publishAt to the ISO slot above, then call videos.insert so YouTube schedules the video.',
    '5. Add a short README with the exact OAuth setup steps and the command to run the script.',
    'Do NOT claim the video was uploaded. Report exactly which files you created and the remaining OAuth step the user must complete.',
  ].join('\n');
}

function syncScheduleForm() {
  const isYouTube = els.scheduleWorkflow.value === 'youtube';
  els.youtubeFields.hidden = !isYouTube;
  els.scheduleDateLabel.textContent = isYouTube ? 'Publish date *' : 'Run date *';

  if (isYouTube) {
    const prompt = buildYouTubePrompt();
    if (prompt) els.schedulePrompt.value = prompt;
    els.schedulePrompt.dataset.auto = 'youtube';
  } else if (els.schedulePrompt.dataset.auto === 'youtube') {
    els.schedulePrompt.value = '';
    els.schedulePrompt.dataset.auto = '';
  }
}

function openSchedule() {
  if (!els.scheduleDate.value) els.scheduleDate.value = defaultDate();
  if (!els.scheduleTime.value) els.scheduleTime.value = '09:00';
  syncScheduleForm();
  els.scheduleModal.hidden = false;
  loadSchedules();
  els.scheduleDate.focus();
}

function closeSchedule() {
  els.scheduleModal.hidden = true;
}

function renderJobs(tasks, container, kind) {
  container.replaceChildren();
  if (!tasks.length) {
    const empty = document.createElement('p');
    empty.className = 'help';
    empty.textContent = kind === 'bot' ? 'Abhi koi bot nahi hai.' : 'Abhi koi task scheduled nahi hai.';
    container.append(empty);
    return;
  }

  const base = kind === 'bot' ? '/api/bots' : '/api/schedules';

  for (const task of tasks) {
    const item = document.createElement('div');
    item.className = 'job-item';

    const title = document.createElement('div');
    title.className = 'job-title';
    const name = document.createElement('span');
    name.textContent = `${kind === 'bot' ? '🤖' : '🕒'} ${task.name}`;
    const status = document.createElement('span');
    status.className = 'badge';
    status.textContent = task.lastStatus === 'error' ? 'Failed' : task.lastStatus === 'ok' ? 'Done' : task.enabled ? 'Armed' : 'Off';
    title.append(name, status);

    const meta = document.createElement('div');
    meta.className = 'job-meta';
    meta.textContent = `${formatWhen(task.nextRun)} · ${task.repeat}${task.rootDir ? ` · ${task.rootDir}` : ''}`;
    item.append(title, meta);

    if (task.lastOutput) {
      const out = document.createElement('div');
      out.className = 'job-meta';
      out.textContent = task.lastOutput.slice(0, 180);
      item.append(out);
    }

    const actions = document.createElement('div');
    actions.className = 'job-actions';

    const run = document.createElement('button');
    run.type = 'button';
    run.textContent = 'Run now';
    run.addEventListener('click', async () => {
      toast('Running…');
      await fetch(`${base}/${task.id}/run`, { method: 'POST', headers: apiHeaders() });
      await (kind === 'bot' ? loadBots() : loadSchedules());
      toast('Run finished');
    });

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = task.enabled ? 'Pause' : 'Resume';
    toggle.addEventListener('click', async () => {
      await fetch(`${base}/${task.id}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      await (kind === 'bot' ? loadBots() : loadSchedules());
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (!confirm(`Delete "${task.name}"?`)) return;
      await fetch(`${base}/${task.id}`, { method: 'DELETE', headers: apiHeaders() });
      await (kind === 'bot' ? loadBots() : loadSchedules());
    });

    actions.append(run, toggle, del);
    item.append(actions);
    container.append(item);
  }
}

async function loadSchedules() {
  try {
    const response = await fetch('/api/schedules');
    const data = await response.json();
    renderJobs(data.tasks || [], els.scheduledList, 'schedule');
  } catch {
    /* keep existing view */
  }
}

async function saveNewSchedule() {
  const date = els.scheduleDate.value;
  const time = els.scheduleTime.value;
  if (!date || !time) {
    toast('Pehle date aur time bharo');
    els.scheduleDate.focus();
    return;
  }

  const isYouTube = els.scheduleWorkflow.value === 'youtube';
  const slot = new Date(`${date}T${time}:00`);
  const lead = isYouTube ? Math.max(0, Number(els.leadMinutes.value) || 0) : 0;
  const runAt = new Date(slot.getTime() - lead * 60_000);
  const prompt = els.schedulePrompt.value.trim();
  if (!prompt) {
    toast('Master prompt likho');
    els.schedulePrompt.focus();
    return;
  }

  const name = els.scheduleName.value.trim() || (isYouTube ? `YouTube · ${date} ${time}` : `Task · ${date} ${time}`);
  const response = await fetch('/api/schedules', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      name,
      prompt,
      workflow: els.scheduleWorkflow.value,
      model: settings.customModel || '',
      runAt: runAt.toISOString(),
      repeat: els.scheduleRepeat.value,
      enabled: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    toast(data.error || 'Could not schedule');
    return;
  }

  closeSchedule();
  await loadSchedules();
  toast(isYouTube ? `Scheduled · agent ${lead}m pehle chalega` : 'Task scheduled');
}

function nativeRequest(type, extra = {}) {
  return new Promise((resolve) => {
    if (!window.chrome?.webview?.postMessage) {
      resolve(null);
      return;
    }
    const requestId = `native_${Date.now()}_${++nativeRequestSeq}`;
    nativeRequests.set(requestId, resolve);
    window.chrome.webview.postMessage({ type, requestId, ...extra });
  });
}

if (window.chrome?.webview?.addEventListener) {
  window.chrome.webview.addEventListener('message', (event) => {
    const data = event.data || {};
    if (!data.requestId || !nativeRequests.has(data.requestId)) return;
    const resolve = nativeRequests.get(data.requestId);
    nativeRequests.delete(data.requestId);
    resolve(data);
  });
}

function folderOf(filePath) {
  const clean = String(filePath || '').replace(/^"|"$/g, '');
  const cut = Math.max(clean.lastIndexOf('\\'), clean.lastIndexOf('/'));
  return cut > 0 ? clean.slice(0, cut) : clean;
}

function updateFolderButton() {
  if (!els.folderBtnText) return;
  const folder = settings.codingFolder || '';
  const short = folder.split(/[\\/]/).filter(Boolean).pop() || '';
  els.folderBtnText.textContent = short || 'Coding folder';
  els.folderBtn.title = folder ? `Coding folder: ${folder}` : 'Choose coding folder';
}

async function allowFolderPath(folderPath, options = {}) {
  const response = await fetch('/api/folders', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ path: folderPath }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Folder allow nahi hua');
  allowedFolders = data.folders || allowedFolders;
  if (options.selectCoding) {
    settings.codingFolder = data.added || folderPath;
    settings.modes.agent = true;
    settings.modes.imagine = false;
    settings.modes.video = false;
    saveSettings();
    renderModes();
  }
  if (els.botFolderPath) els.botFolderPath.value = '';
  await loadFolders();
  if (data.added && els.botRoot) els.botRoot.value = data.added;
  if (!options.quiet) {
    toast(options.selectCoding ? 'Coding folder set · Agent mode ON — ab code yahin save hoga' : 'Folder allowed');
  }
  return data.added || folderPath;
}

async function chooseCodingFolder() {
  const result = await nativeRequest('choose-folder', { initialPath: settings.codingFolder || '' });
  if (!result) {
    if (els.botFolderPath) els.botFolderPath.focus();
    toast('Desktop app me folder picker available hai. Yahan path type karein.');
    return;
  }
  if (result.cancelled || !result.path) return;
  try {
    await allowFolderPath(result.path, { selectCoding: true });
  } catch (err) {
    toast(err.message || 'Folder set nahi hua');
  }
}

async function chooseNativeFile(input, multiple = false) {
  const result = await nativeRequest(multiple ? 'choose-files' : 'choose-file', {});
  if (!result) {
    input.focus();
    toast('Desktop app me file picker available hai. Yahan path type karein.');
    return;
  }
  const paths = result.paths || (result.path ? [result.path] : []);
  if (!paths.length) return;
  input.value = multiple ? paths.join('\n') : paths[0];
  input.dispatchEvent(new Event('input', { bubbles: true }));
  for (const filePath of paths) {
    const parent = folderOf(filePath);
    if (parent) await allowFolderPath(parent, { quiet: true }).catch(() => {});
  }
}

async function loadFolders() {
  try {
    const response = await fetch('/api/folders');
    const data = await response.json();
    allowedFolders = data.folders || [];
  } catch {
    allowedFolders = [];
  }
  if (settings.codingFolder && !allowedFolders.includes(settings.codingFolder)) {
    settings.codingFolder = '';
    saveSettings();
  }
  updateFolderButton();

  els.botRoot.replaceChildren();
  for (const folder of allowedFolders) {
    const option = document.createElement('option');
    option.value = folder;
    option.textContent = folder;
    els.botRoot.append(option);
  }
  if (settings.codingFolder) els.botRoot.value = settings.codingFolder;

  els.folderList.replaceChildren();
  for (const folder of allowedFolders) {
    const item = document.createElement('div');
    item.className = 'folder-item';
    const label = document.createElement('span');
    label.textContent = folder;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost-btn';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/folders', {
          method: 'DELETE',
          headers: apiHeaders(),
          body: JSON.stringify({ path: folder }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Remove nahi hua');
        if (settings.codingFolder === folder) {
          settings.codingFolder = '';
          saveSettings();
        }
        await loadFolders();
        toast('Folder access hata diya');
      } catch (err) {
        toast(err.message || 'Folder remove nahi hua');
      }
    });
    item.append(label, remove);
    els.folderList.append(item);
  }
}

function openFfmpeg() {
  els.ffmpegModal.hidden = false;
  loadFfmpegStatus();
  loadFfmpegJobs();
}

function closeFfmpeg() {
  els.ffmpegModal.hidden = true;
}

async function loadFfmpegStatus() {
  try {
    const response = await fetch('/api/ffmpeg/status');
    const data = await response.json();
    ffmpegAvailable = Boolean(data.available);
    els.ffmpegStatusText.textContent = ffmpegAvailable
      ? `FFmpeg ready · ${data.version || 'installed'}`
      : 'FFmpeg bundled nahi mila — installer dobara install karein.';
  } catch {
    ffmpegAvailable = false;
    els.ffmpegStatusText.textContent = 'FFmpeg status check nahi hua.';
  }
}

async function loadFfmpegJobs() {
  try {
    const response = await fetch('/api/ffmpeg/jobs');
    const data = await response.json();
    ffmpegJobs = data.jobs || [];
    for (const job of ffmpegJobs) {
      if (['done', 'error'].includes(job.status)) {
        if (ffmpegNotifyReady && !notifiedFfmpegJobs.has(job.id)) {
          notifiedFfmpegJobs.add(job.id);
          playCompletionSound(job.status === 'done' ? 'done' : 'error');
          toast(job.status === 'done' ? 'FFmpeg edit ready' : `FFmpeg edit failed: ${job.error || 'error'}`);
        } else {
          notifiedFfmpegJobs.add(job.id);
        }
      }
    }
    ffmpegNotifyReady = true;
    renderFfmpegJobs();
  } catch {
    /* keep local list */
  }
}

function renderFfmpegJobs() {
  els.ffmpegJobs.replaceChildren();
  if (!ffmpegJobs.length) {
    const empty = document.createElement('p');
    empty.className = 'help';
    empty.textContent = 'Abhi koi editing job nahi hai.';
    els.ffmpegJobs.append(empty);
    return;
  }
  for (const job of ffmpegJobs.slice(0, 8)) {
    const item = document.createElement('div');
    item.className = 'job-item ffmpeg-job';
    const head = document.createElement('div');
    head.className = 'job-title';
    const name = document.createElement('strong');
    name.textContent = `${job.operation} · ${job.status || 'queued'}`;
    const badge = document.createElement('span');
    badge.textContent = `${job.progress || 0}%`;
    head.append(name, badge);
    const step = document.createElement('div');
    step.textContent = job.step || '';
    const bar = document.createElement('div');
    bar.className = 'progress-track';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(0, Math.min(100, job.progress || 0))}%`;
    bar.append(fill);
    item.append(head, step, bar);
    if (job.status === 'done' && job.outputUrl) {
      const link = document.createElement('a');
      link.href = job.outputUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open / download edited video';
      item.append(link);
    }
    if (job.status === 'error') {
      const error = document.createElement('div');
      error.className = 'help';
      error.textContent = job.error || 'Editing failed';
      item.append(error);
    }
    if (['queued', 'rendering'].includes(job.status)) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'ghost-btn';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', async () => {
        await fetch(`/api/ffmpeg/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
        await loadFfmpegJobs();
      });
      item.append(cancel);
    }
    els.ffmpegJobs.append(item);
  }
}

function syncFfmpegOperationFields() {
  const operation = els.ffmpegOperation.value;
  els.ffmpegMergeFields.hidden = operation !== 'merge';
  els.ffmpegAudioFields.hidden = operation !== 'add-audio';
  els.ffmpegStart.closest('.field').hidden = operation !== 'trim';
  els.ffmpegDuration.closest('.field').hidden = operation !== 'trim';
  els.ffmpegWidth.closest('.field').hidden = operation !== 'resize';
  els.ffmpegHeight.closest('.field').hidden = operation !== 'resize';
}

async function runFfmpegJob() {
  if (!ffmpegAvailable) {
    toast('FFmpeg available nahi hai');
    return;
  }
  const operation = els.ffmpegOperation.value;
  const inputs = els.ffmpegMergeInputs.value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const input = operation === 'merge' ? inputs[0] : els.ffmpegInput.value.trim();
  if (!input) {
    toast('Source video choose karein');
    return;
  }
  if (operation === 'merge' && inputs.length < 2) {
    toast('Merge ke liye 2 clips choose karein');
    return;
  }
  const payload = {
    operation,
    input,
    inputs,
    audio: els.ffmpegAudioInput.value.trim(),
    outputName: els.ffmpegOutputName.value.trim(),
    outputFolder: els.ffmpegOutputFolder.value.trim(),
    start: Number(els.ffmpegStart.value) || 0,
    duration: Number(els.ffmpegDuration.value) || 0,
    width: Number(els.ffmpegWidth.value) || 0,
    height: Number(els.ffmpegHeight.value) || 0,
    accurate: true,
  };
  const response = await fetch('/api/ffmpeg/jobs', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    toast(data.error || 'Editing job shuru nahi hua');
    return;
  }
  ffmpegJobs.unshift(data);
  renderFfmpegJobs();
  toast('FFmpeg editing shuru ho gaya');
}

function openBots() {
  els.botsModal.hidden = false;
  loadFolders();
  loadBots();
  els.botName.focus();
}

function closeBots() {
  els.botsModal.hidden = true;
}

async function loadBots() {
  try {
    const response = await fetch('/api/bots');
    const data = await response.json();
    renderJobs(data.bots || [], els.botList, 'bot');
  } catch {
    /* keep existing view */
  }
}

async function addNewBot() {
  const name = els.botName.value.trim();
  const prompt = els.botPrompt.value.trim();
  if (!name || !prompt) {
    toast('Bot name aur master prompt likho');
    return;
  }

  const hasDate = Boolean(els.botDate.value);
  const runAt = hasDate ? new Date(`${els.botDate.value}T${els.botTime.value || '09:00'}:00`).toISOString() : null;
  const response = await fetch('/api/bots', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      name,
      prompt,
      model: settings.customModel || '',
      rootDir: els.botRoot.value,
      runAt,
      repeat: els.botRepeat.value,
      enabled: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    toast(data.error || 'Could not add bot');
    return;
  }

  els.botName.value = '';
  els.botPrompt.value = '';
  els.botDate.value = '';
  await loadBots();
  toast('Bot added');
}

async function runAllBotsNow() {
  toast('Sab bots chal rahe hain…');
  await fetch('/api/bots/run-all', { method: 'POST', headers: apiHeaders() });
  await loadBots();
  toast('Sab bots ho gaye');
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) serverConfig = await response.json();
  } catch {
    /* keep fallbacks */
  }
  // Render me sirf provider key env me hai, browser me nahi — to usi provider par switch karo.
  const currentProvider = settings.provider || 'nvidia';
  const browserKey = settings.apiKeys?.[currentProvider];
  const serverKey = serverConfig.serverKeys?.[currentProvider];
  if (!browserKey && !serverKey) {
    const configured = Object.entries(serverConfig.serverKeys || {}).find(
      ([id, ok]) => ok && PROVIDERS[id],
    );
    if (configured) {
      settings.provider = configured[0];
      settings.baseUrl = PROVIDERS[configured[0]].base;
      syncActiveKey();
      saveSettings();
      els.providerSelect.value = settings.provider;
      els.baseUrlInput.value = settings.baseUrl;
      els.apiKeyProvider.textContent = String(settings.provider).toUpperCase();
      els.apiKeyInput.value = '';
    }
  }
  await refreshKeyStatus();
  await loadModels();
}

/* --------------------------------- events --------------------------------- */

els.composer.addEventListener('submit', (event) => {
  event.preventDefault();
  send(els.input.value);
});

els.input.addEventListener('input', () => {
  autoGrow();
  syncComposer();
});

els.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send(els.input.value);
  }
});

els.stopBtn.addEventListener('click', stopStream);
els.newChatBtn.addEventListener('click', newChat);
els.brand.addEventListener('click', (event) => {
  event.preventDefault();
  newChat();
});
els.menuBtn.addEventListener('click', toggleSidebar);
els.topSearchBtn.addEventListener('click', focusChatSearch);
els.scrim.addEventListener('click', closeMobileSidebar);
els.collapseBtn.addEventListener('click', toggleSidebar);
els.micBtn.addEventListener('click', toggleMic);

els.modes.addEventListener('click', (event) => {
  const button = event.target.closest('.mode');
  if (!button) return;
  const mode = button.dataset.mode;
  settings.modes[mode] = !settings.modes[mode];

  if (mode === 'video' && settings.modes.video) {
    settings.modes.imagine = false;
    settings.modes.agent = false;
    settings.modes.search = false;
    settings.modes.think = false;
  }
  if (mode === 'imagine' && settings.modes.imagine) {
    settings.modes.search = false;
    settings.modes.think = false;
    settings.modes.agent = false;
    settings.modes.video = false;
  }
  if (mode === 'agent' && settings.modes.agent) {
    settings.modes.imagine = false;
    settings.modes.video = false;
  }
  if ((mode === 'search' || mode === 'think') && settings.modes[mode]) {
    settings.modes.imagine = false;
    settings.modes.video = false;
  }

  saveSettings();
  renderModes();
  els.input.focus();
});

els.suggestions.addEventListener('click', (event) => {
  const suggestion = event.target.closest('.suggestion');
  if (!suggestion) return;
  const mode = suggestion.dataset.mode;
  if (mode === 'search' || mode === 'think' || mode === 'imagine') {
    settings.modes.imagine = mode === 'imagine';
    settings.modes.search = mode === 'search';
    settings.modes.think = mode === 'think';
    settings.modes.agent = mode !== 'imagine';
    settings.modes.video = false;
    saveSettings();
    renderModes();
  }
  send(suggestion.dataset.prompt || '');
});

els.attachBtn.addEventListener('click', () => {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.multiple = true;
  picker.accept = 'image/*,audio/*,text/*,.md,.json,.csv,.js,.ts,.py,.html,.css,.yml,.yaml,.sh,.sql,.mp3,.m4a,.wav,.ogg';
  picker.addEventListener('change', () => addFiles(picker.files));
  picker.click();
});

els.input.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files || [])];
  if (files.length) {
    event.preventDefault();
    addFiles(files);
  }
});

els.chatSearch.addEventListener('input', renderSidebar);

els.modelFilter.addEventListener('input', renderModelList);

els.providerSelect.addEventListener('change', () => {
  const preset = PROVIDERS[els.providerSelect.value];
  if (!preset) return;

  syncActiveModel();
  settings.provider = els.providerSelect.value;
  settings.baseUrl = preset.base;
  settings.customModel = settings.providerModels[settings.provider] || preset.model || '';
  settings.tier = settings.customModel ? 'custom' : 'auto';
  syncActiveKey();

  els.baseUrlInput.value = settings.baseUrl;
  els.apiKeyProvider.textContent = settings.provider.toUpperCase();
  els.apiKeyInput.value = settings.apiKey;
  els.modelInput.value = settings.customModel || '';
  saveSettings();
  renderTiers();
  syncComposer();
  refreshKeyStatus();
  loadModels();
  toast(`${settings.provider.toUpperCase()} key field ready`);
});

els.tierSelect.addEventListener('change', () => {
  const value = els.tierSelect.value;
  if (value.startsWith('model:')) {
    settings.customModel = value.slice(6);
    settings.tier = 'custom';
  } else if (value === '__custom') {
    settings.tier = 'custom';
  } else {
    settings.tier = value;
    settings.customModel = '';
    els.modelInput.value = '';
  }
  syncActiveModel();
  saveSettings();
  renderTiers();
  syncComposer();
  toast(`Model: ${els.tierSelect.selectedOptions[0]?.textContent || value}`);
});

els.messages.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-code');
  if (!button) return;
  const code = button.closest('.code-block')?.querySelector('code')?.textContent || '';
  await copyText(code);
  button.textContent = 'Copied';
  setTimeout(() => {
    button.textContent = 'Copy';
  }, 1400);
});

els.scheduleBtn.addEventListener('click', openSchedule);
els.botsBtn.addEventListener('click', openBots);
els.folderBtn.addEventListener('click', chooseCodingFolder);
els.chooseFolderBtn.addEventListener('click', chooseCodingFolder);
els.studioBtn.addEventListener('click', openStudio);
els.topStudioBtn.addEventListener('click', openStudio);
els.studioClose.addEventListener('click', closeStudio);
els.studioUpload.addEventListener('click', () => els.studioFiles.click());
els.studioDrop?.addEventListener('click', () => els.studioFiles.click());
els.studioFiles.addEventListener('change', () => {
  importStudioFiles(els.studioFiles.files);
  els.studioFiles.value = '';
});
const studioDropZone = els.studio?.querySelector('.studio-left');
if (studioDropZone) {
  studioDropZone.addEventListener('dragover', (event) => event.preventDefault());
  studioDropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    importStudioFiles(event.dataTransfer?.files);
  });
}
els.studioPreset.addEventListener('change', () => applyStudioPreset(els.studioPreset.value));
els.studioTransition.addEventListener('change', () => {
  const value = els.studioTransition.value;
  if (value) {
    studioState.transitions = new Set([value, ...studioState.transitions]);
    els.studioTransitionCount.textContent = `${studioState.transitions.size} selected`;
    const catalog = studioState.catalog || studioFallbackCatalog();
    studioChips(els.studioTransitions, catalog.transitions, studioState.transitions, 'transitions');
  }
});
els.studioRender.addEventListener('click', renderStudioVideo);
els.studioResumeBtn.addEventListener('click', resumeStudioJob);
els.studioAgentBtn.addEventListener('click', askStudioAgent);
els.studioSteps.addEventListener('click', (event) => {
  const step = event.target.closest('.studio-step');
  if (!step) return;
  for (const button of els.studioSteps.querySelectorAll('.studio-step')) button.classList.remove('active');
  step.classList.add('active');
  if (step.dataset.stage === 'create') els.studioPrompt.focus();
  if (step.dataset.stage === 'edit') els.studioTimeline.scrollIntoView({ block: 'center' });
  if (step.dataset.stage === 'export') els.studioPreviewWrap?.scrollIntoView?.({ block: 'center' });
});
els.ffmpegBtn.addEventListener('click', openFfmpeg);
els.closeFfmpeg.addEventListener('click', closeFfmpeg);
els.ffmpegModal.addEventListener('click', (event) => {
  if (event.target === els.ffmpegModal) closeFfmpeg();
});
els.ffmpegOperation.addEventListener('change', syncFfmpegOperationFields);
els.runFfmpeg.addEventListener('click', runFfmpegJob);
els.chooseVideoBtn.addEventListener('click', () => chooseNativeFile(els.ffmpegInput));
els.chooseClipsBtn.addEventListener('click', () => chooseNativeFile(els.ffmpegMergeInputs, true));
els.chooseAudioBtn.addEventListener('click', () => chooseNativeFile(els.ffmpegAudioInput));
els.chooseOutputFolderBtn.addEventListener('click', async () => {
  const result = await nativeRequest('choose-folder', { initialPath: els.ffmpegOutputFolder.value });
  if (!result || result.cancelled || !result.path) return;
  els.ffmpegOutputFolder.value = result.path;
  await allowFolderPath(result.path, { quiet: true }).catch(() => {});
});
els.closeSchedule.addEventListener('click', closeSchedule);
els.cancelSchedule.addEventListener('click', closeSchedule);
els.closeBots.addEventListener('click', closeBots);
els.scheduleModal.addEventListener('click', (event) => {
  if (event.target === els.scheduleModal) closeSchedule();
});
els.botsModal.addEventListener('click', (event) => {
  if (event.target === els.botsModal) closeBots();
});
els.scheduleWorkflow.addEventListener('change', syncScheduleForm);
els.scheduleDate.addEventListener('input', syncScheduleForm);
els.scheduleTime.addEventListener('input', syncScheduleForm);
els.videoFile.addEventListener('input', syncScheduleForm);
els.videoTopic.addEventListener('input', syncScheduleForm);
els.chooseSongBtn.addEventListener('click', () => chooseNativeFile(els.songPath));
els.schedulePrompt.addEventListener('input', () => {
  if (els.schedulePrompt.dataset.auto) els.schedulePrompt.dataset.auto = 'user';
});
els.saveSchedule.addEventListener('click', saveNewSchedule);
els.allowFolderBtn.addEventListener('click', async () => {
  const folderPath = els.botFolderPath.value.trim();
  if (!folderPath) return;
  try {
    await allowFolderPath(folderPath, { selectCoding: true });
  } catch (err) {
    toast(err.message || 'Folder allow nahi hua');
  }
});
els.addBot.addEventListener('click', addNewBot);
els.runAllBots.addEventListener('click', runAllBotsNow);

els.settingsBtn.addEventListener('click', openSettings);
els.topSettingsBtn.addEventListener('click', openSettings);
els.bannerBtn.addEventListener('click', openSettings);
els.closeSettings.addEventListener('click', closeSettings);
els.modal.addEventListener('click', (event) => {
  if (event.target === els.modal) closeSettings();
});

els.apiKeyInput.addEventListener('input', () => {
  settings.apiKeys[settings.provider] = els.apiKeyInput.value.trim();
  syncActiveKey();
  saveSettings();
  refreshKeyStatus();
  clearTimeout(modelLoadTimer);
  modelLoadTimer = setTimeout(() => loadModels(), 500);
});

els.imageProviderSelect.addEventListener('change', () => {
  settings.imageProvider = els.imageProviderSelect.value;
  saveSettings();
  toast(`Image provider: ${els.imageProviderSelect.selectedOptions[0]?.textContent || settings.imageProvider}`);
});

els.videoProviderSelect.addEventListener('change', () => {
  settings.videoProvider = els.videoProviderSelect.value;
  saveSettings();
  toast(`Video provider: ${els.videoProviderSelect.selectedOptions[0]?.textContent || settings.videoProvider}`);
});

for (const [input, field] of [
  [els.cfAccountInput, 'cloudflareAccount'],
  [els.cfTokenInput, 'cloudflareToken'],
  [els.hfTokenInput, 'hfToken'],
  [els.geminiTokenInput, 'geminiToken'],
]) {
  input.addEventListener('input', () => {
    settings.mediaCredentials[field] = input.value.trim();
    saveSettings();
    clearTimeout(mediaCredentialsTimer);
    mediaCredentialsTimer = setTimeout(() => syncMediaCredentials(), 400);
  });
}

els.testCloudflareBtn.addEventListener('click', async () => {
  const button = els.testCloudflareBtn;
  const result = els.cloudflareTestResult;
  button.disabled = true;
  button.textContent = 'Testing…';
  result.textContent = '';
  try {
    await fetch('/api/media-credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cloudflareAccount: els.cfAccountInput.value.trim(),
        cloudflareToken: els.cfTokenInput.value.trim(),
      }),
    });
    const response = await fetch('/api/media/test/cloudflare', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    result.textContent = data.ok ? '✓ Token sahi hai' : `✗ ${data.error || 'Test fail'}`;
    result.style.color = data.ok ? 'var(--ok, #4ade80)' : 'var(--danger, #f87171)';
    if (!data.ok) toast(data.error || 'Cloudflare test fail');
  } catch (err) {
    result.textContent = `✗ ${err.message || 'Test fail'}`;
    result.style.color = 'var(--danger, #f87171)';
  } finally {
    button.disabled = false;
    button.textContent = 'Test Cloudflare token';
  }
});

els.imageModelSelect.addEventListener('change', () => {
  settings.mediaModels.image = els.imageModelSelect.value;
  saveSettings();
  toast(`Image model: ${els.imageModelSelect.value.split('/').pop()}`);
});

els.videoModelSelect.addEventListener('change', () => {
  settings.mediaModels.video = els.videoModelSelect.value;
  saveSettings();
  toast(`Video model: ${els.videoModelSelect.value.split('/').pop()}`);
});

els.videoRatioSelect.addEventListener('change', () => {
  settings.videoRatio = els.videoRatioSelect.value;
  saveSettings();
});

els.videoDurationSelect.addEventListener('change', () => {
  settings.videoDuration = Number(els.videoDurationSelect.value) || 5;
  saveSettings();
});

els.tempInput.addEventListener('input', () => {
  els.tempValue.textContent = Number(els.tempInput.value).toFixed(1);
});

els.browserLoginBtn?.addEventListener('click', async () => {
  const button = els.browserLoginBtn;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Opening Chrome…';
  try {
    const response = await fetch('/api/browser-login', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Chrome login tab nahi khul paaya.');
    toast('Chrome me login tabs khul gaye. Ek baar sign-in kar lo — baad me dobara nahi mangega.');
  } catch (err) {
    toast(err.message || 'Chrome login tab nahi khul paaya.');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

if (els.bingSyncField) {
  els.bingSyncField.hidden = !appIsLocal;
  els.bingSyncField.style.display = appIsLocal ? '' : 'none';
}

els.bingSyncBtn?.addEventListener('click', async () => {
  const button = els.bingSyncBtn;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Syncing…';
  try {
    const response = await fetch('/api/sync-bing-login', {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Bing login sync nahi hua.');
    toast('Bing login live site par sync ho gaya. Ab live par auto images Bing se banengi.');
  } catch (err) {
    toast(err.message || 'Bing login sync nahi hua.');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

els.puterLoginBtn?.addEventListener('click', async () => {
  const button = els.puterLoginBtn;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Opening Puter…';
  try {
    await loadPuter();
    await window.puter.auth.signIn({ attempt_temp_user_creation: true });
    button.textContent = 'Enabled ✓';
    toast('Free Puter account ready. Ab live par images banengi.');
  } catch (err) {
    toast(err.message || 'Puter sign-in nahi hua.');
    button.textContent = original;
  } finally {
    button.disabled = false;
    if (puterIsSignedIn()) button.textContent = 'Enabled ✓';
    else if (button.textContent !== 'Enabled ✓') button.textContent = original;
  }
});

els.saveSettings.addEventListener('click', async () => {
  settings.provider = els.providerSelect.value;
  settings.apiKeys[settings.provider] = els.apiKeyInput.value.trim();
  settings.imageProvider = els.imageProviderSelect.value || DEFAULT_SETTINGS.imageProvider;
  settings.imageRatio = els.imageRatioSelect.value || DEFAULT_SETTINGS.imageRatio;
  settings.videoProvider = els.videoProviderSelect.value || DEFAULT_SETTINGS.videoProvider;
  settings.mediaCredentials = {
    cloudflareAccount: els.cfAccountInput.value.trim(),
    cloudflareToken: els.cfTokenInput.value.trim(),
    hfToken: els.hfTokenInput.value.trim(),
    geminiToken: els.geminiTokenInput?.value.trim() || '',
  };
  syncActiveKey();
  settings.mediaModels.image = els.imageModelSelect.value || DEFAULT_SETTINGS.mediaModels.image;
  settings.mediaModels.video = els.videoModelSelect.value || DEFAULT_SETTINGS.mediaModels.video;
  settings.videoRatio = els.videoRatioSelect.value === '9:16' ? '9:16' : '16:9';
  settings.videoDuration = Number(els.videoDurationSelect.value) || 5;
  settings.videoLengthSeconds = Number(els.videoLengthSelect.value) || 60;
  settings.videoSceneCount = els.sceneCountSelect.value || 'auto';
  settings.songPath = els.songPath.value.trim();
  settings.lyrics = els.lyricsInput.value.trim();
  const selectedPreset = els.voicePreset?.value || 'auto';
  settings.voice = selectedPreset === 'custom'
    ? (els.voiceInput.value.trim() || 'Microsoft Hazel Desktop')
    : selectedPreset;
  settings.narration = els.narrationToggle.checked;
  settings.autoMode = els.autoModeToggle ? els.autoModeToggle.checked : settings.autoMode !== false;
  settings.soundEnabled = els.soundToggle ? els.soundToggle.checked : settings.soundEnabled !== false;
  if (settings.soundEnabled) unlockAudio();
  settings.baseUrl = els.baseUrlInput.value.trim() || PROVIDERS[settings.provider]?.base || PROVIDERS.nvidia.base;
  settings.customModel = els.modelInput.value.trim();
  syncActiveModel();
  settings.temperature = Number(els.tempInput.value);
  settings.system = els.systemInput.value.trim();
  if (settings.customModel && settings.tier !== 'custom') settings.tier = 'custom';
  if (!settings.customModel && settings.tier === 'custom') settings.tier = 'auto';
  saveSettings();
  renderTiers();
  syncComposer();
  await syncMediaCredentials();
  await refreshKeyStatus();
  await loadModels();
  closeSettings();
  toast('Settings saved');
});

els.clearAllBtn.addEventListener('click', () => {
  if (!chats.length) return;
  if (!confirm('Delete all chats? This cannot be undone.')) return;
  if (busy()) stopStream();
  for (const chat of chats) {
    rememberDeletedChat(chat.id);
    void removeMediaJobsForChat(chat);
  }
  chats = [];
  activeId = null;
  saveChats();
  renderAll();
  toast('All chats deleted');
});

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), chats, settings }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nova-chats-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!els.scheduleModal.hidden) closeSchedule();
    else if (!els.botsModal.hidden) closeBots();
    else if (!els.modal.hidden) closeSettings();
    else if (document.activeElement === els.chatSearch && els.chatSearch.value) {
      els.chatSearch.value = '';
      renderSidebar();
    } else if (els.app.classList.contains('mobile-open')) closeMobileSidebar();
    else if (busy()) stopStream();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    focusChatSearch();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    newChat();
  }
  if (event.key === '/' && document.activeElement !== els.input && els.modal.hidden) {
    event.preventDefault();
    els.input.focus();
  }
});

window.addEventListener('resize', () => {
  autoGrow();
  if (window.innerWidth > 900) closeMobileSidebar();
});

/* ---------------------------------- boot ---------------------------------- */

function boot() {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  loadPuter().catch(() => {});
  renderAll();
  autoGrow();
  els.input.focus();
  updateFolderButton();
  syncFfmpegOperationFields();
  loadFolders();
  loadConfig().then(() => {
    syncMediaCredentials();
    loadMediaModels();
    loadMediaJobs();
  });
  setInterval(() => {
    if (document.visibilityState !== 'hidden') loadMediaJobs();
    loadFfmpegJobs();
  }, 3000);
  setInterval(() => {
    if (document.visibilityState !== 'hidden') syncMediaCredentials();
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncMediaCredentials();
  });
}

boot();
