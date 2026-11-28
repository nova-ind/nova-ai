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
  audio: null,
  audioPath: '',
  audioBar: null,
  storyAudio: null,
  selection: new Set(),
  clipboard: readJson('nova.studio.clipboard.v1', []),
  lastSelected: null,
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
  studioTtsText: $('studioTtsText'),
  studioTtsVoice: $('studioTtsVoice'),
  studioTtsBtn: $('studioTtsBtn'),
  studioTtsAudio: $('studioTtsAudio'),
  studioTtsNote: $('studioTtsNote'),
  studioTtsState: $('studioTtsState'),
  studioImageText: $('studioImageText'),
  studioImageCount: $('studioImageCount'),
  studioImageBtn: $('studioImageBtn'),
  studioImageNote: $('studioImageNote'),
  studioImageState: $('studioImageState'),
  studioImageProgress: $('studioImageProgress'),
  studioImageProgressText: $('studioImageProgressText'),
  studioImageProgressBar: $('studioImageProgressBar'),
  studioPanelTabs: $('studioPanelTabs'),
  studioRail: $('studioRail'),
  studioRailChatGpt: $('studioRailChatGpt'),
  studioMusicImport: $('studioMusicImport'),
  studioMusicFiles: $('studioMusicFiles'),
  studioMusicList: $('studioMusicList'),
  studioMusicState: $('studioMusicState'),
  studioThumbText: $('studioThumbText'),
  studioThumbBtn: $('studioThumbBtn'),
  studioThumbState: $('studioThumbState'),
  studioThumbNote: $('studioThumbNote'),
  studioThumbPreview: $('studioThumbPreview'),
  studioThumbImage: $('studioThumbImage'),
  studioChatGptBtn: $('studioChatGptBtn'),
  studioChatGptLoginBtn: $('studioChatGptLoginBtn'),
  studioArenaLoginBtn: $('studioArenaLoginBtn'),
  studioArenaLoginBtnVideo: $('studioArenaLoginBtnVideo'),
  studioArenaLabel: $('studioArenaLabel'),
  studioArenaLabelVideo: $('studioArenaLabelVideo'),
  studioArenaNote: $('studioArenaNote'),
  studioArenaNoteVideo: $('studioArenaNoteVideo'),
  studioImageProvider: $('studioImageProvider'),
  studioVideoProvider: $('studioVideoProvider'),
  studioChatGptLabel: $('studioChatGptLabel'),
  studioChatGptNote: $('studioChatGptNote'),
  studioChatGptBadge: $('studioChatGptBadge'),
  studioChatGptInfo: $('studioChatGptInfo'),
  studioChatGptOpenBtn: $('studioChatGptOpenBtn'),
  studioVideoText: $('studioVideoText'),
  studioVideoDuration: $('studioVideoDuration'),
  studioVideoBtn: $('studioVideoBtn'),
  studioVideoState: $('studioVideoState'),
  studioVideoList: $('studioVideoList'),
  studioVideoNote: $('studioVideoNote'),
  chatGptLoginBtn: $('chatGptLoginBtn'),
  chatGptStatusText: $('chatGptStatusText'),
  studioVideoNote: $('studioVideoNote'),
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
  studioAudioTrack: $('studioAudioTrack'),
  studioTracks: $('studioTracks'),
  studioTrackAddMenu: $('studioTrackAddMenu'),
  studioTrackAddBtn: $('studioAddTrack'),
  studioTrackAddPopover: $('studioTrackAddPopover'),
  studioRuler: $('studioRuler'),
  studioPlayhead: $('studioPlayhead'),
  studioTimecode: $('studioTimecode'),
  studioTimelinePlay: $('studioTimelinePlay'),
  studioTimelineHome: $('studioTimelineHome'),
  studioPrevFrame: $('studioPrevFrame'),
  studioNextFrame: $('studioNextFrame'),
  studioSplit: $('studioSplit'),
  studioSnap: $('studioSnap'),
  studioSelectAll: $('studioSelectAll'),
  studioCopyClip: $('studioCopyClip'),
  studioPasteClip: $('studioPasteClip'),
  studioDeleteClip: $('studioDeleteClip'),
  studioZoomOut: $('studioZoomOut'),
  studioZoomFit: $('studioZoomFit'),
  studioZoomIn: $('studioZoomIn'),
  studioUndo: $('studioUndo'),
  studioRedo: $('studioRedo'),
  studioMuteVideo: $('studioMuteVideo'),
  studioMuteImage: $('studioMuteImage'),
  studioMuteAudio: $('studioMuteAudio'),
  studioExportBtn: $('studioExportBtn'),
  studioExportFormat: $('studioExportFormat'),
  studioExportResolution: $('studioExportResolution'),
  studioExportQuality: $('studioExportQuality'),
  studioExportState: $('studioExportState'),
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
    if (job.chatId === chat.id && !job.studio) ids.add(job.id);
  }
  // Server me maujud lekin chat se hataaye gaye jobs bhi pakdein — warna poll se wapas aa jate hain.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/media-jobs', { signal: controller.signal });
      const data = await response.json();
      for (const job of data.jobs || []) {
        // Studio project alag hai — chat delete hone se uske images/audio delete nahi hone chahiye.
        if (job.chatId === chat.id && !job.studio) ids.add(job.id);
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
  if (studioState.audio) studioState.audio.muted = Boolean(muted.audio);
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
  const current = Number(els.studioPreview?.currentTime) || Number(studioState.audio?.currentTime) || 0;
  const ratio = duration ? Math.min(1, current / duration) : 0;
  if (els.studioPlayhead) els.studioPlayhead.style.left = `calc(92px + (100% - 92px) * ${ratio})`;
  if (els.studioTimecode) els.studioTimecode.textContent = `${formatStudioClock(current)} / ${formatStudioClock(duration)}`;
}

function syncStudioPlayButton() {
  if (!els.studioTimelinePlay) return;
  const hasVideo = Boolean(els.studioPreview?.getAttribute('src'));
  const paused = hasVideo
    ? !els.studioPreview || els.studioPreview.paused
    : !(studioState.audio && !studioState.audio.paused);
  els.studioTimelinePlay.innerHTML = paused
    ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>';
  els.studioTimelinePlay.title = paused ? 'Play' : 'Pause';
}

function studioSeekTo(seconds) {
  const duration = studioVideoDuration();
  const target = studioClamp(seconds, 0, duration);
  if (els.studioPreview?.src) {
    try { els.studioPreview.currentTime = target; } catch { /* not seekable yet */ }
  }
  if (studioState.audio) {
    try { studioState.audio.currentTime = Math.min(target, studioState.audio.duration || target); } catch { /* not seekable yet */ }
  }
  updateStudioPlayhead();
  if (studioState.audioBar && duration) studioState.audioBar.style.width = `${Math.round((target / duration) * 100)}%`;
}

async function toggleStudioPlayback() {
  const job = currentStudioJob();
  // Preview me video loaded hai? Nahi to current project ki voice track.
  const hasVideo = Boolean(els.studioPreview?.getAttribute('src'));
  const hasAudio = Boolean(studioState.audio);
  if (!hasVideo && !hasAudio) {
    // Koi video nahi bana abhi — purana finished video play karo.
    const fallback = mediaJobs.find((item) => item.studio && item.outputUrl);
    if (fallback && els.studioPreview) {
      els.studioPreview.src = fallback.outputUrl;
      els.studioPreview.dataset.src = fallback.outputUrl;
      els.studioPreview.dataset.job = fallback.id;
      els.studioPreviewEmpty.hidden = true;
      studioState.audio?.pause();
      try {
        await els.studioPreview.play();
        syncStudioPlayButton();
        toast('Purana video play ho raha hai — naya render chal raha hai');
      } catch (error) {
        toast(error?.message || 'Playback start nahi hua');
      }
      return;
    }
    toast('Pehle voice track ya final video ready ho');
    return;
  }
  try {
    if (hasVideo) {
      // Video me apni audio hai — narration track pause taaki double audio na chale.
      if (els.studioPreview.paused) {
        studioState.audio?.pause();
        await els.studioPreview.play();
      } else els.studioPreview.pause();
    } else if (studioState.audio.paused) {
      els.studioPreview?.pause();
      await studioState.audio.play();
    } else {
      studioState.audio.pause();
    }
  } catch (error) {
    toast(error?.message || 'Playback start nahi hua');
  }
  syncStudioPlayButton();
}

async function exportStudioMedia() {
  const job = mediaJobs.find((item) => item.id === studioState.jobId) || mediaJobs.find((item) => item.studio);
  if (!job) {
    toast('Pehle Studio me video banayein');
    return;
  }
  const payload = {
    jobId: job.id,
    format: els.studioExportFormat?.value || 'video',
    resolution: els.studioExportResolution?.value || '720p',
    quality: els.studioExportQuality?.value || 'standard',
  };
  try {
    const response = await fetch('/api/video-studio/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Export shuru nahi hua');
    const label = `${payload.format.toUpperCase()} · ${payload.resolution} · ${payload.quality}`;
    if (els.studioExportState) els.studioExportState.textContent = `${label} · queued`;
    toast(`${label} export shuru — FFmpeg background me chal raha hai`);
    watchStudioExport(data.job?.id, data.outputUrl, label);
  } catch (error) {
    toast(error?.message || 'Export fail ho gaya');
  }
}

function watchStudioExport(jobId, outputUrl, label) {
  if (!jobId) return;
  const timer = setInterval(async () => {
    try {
      const response = await fetch(`/api/ffmpeg/jobs/${encodeURIComponent(jobId)}`);
      if (!response.ok) return;
      const job = await response.json();
      if (els.studioExportState) {
        els.studioExportState.textContent = `${label} · ${job.status || 'working'} ${Math.round(Number(job.progress) || 0)}%`;
      }
      if (job.status === 'done' || job.status === 'error') {
        clearInterval(timer);
        if (job.status === 'done' && outputUrl) window.open(outputUrl, '_blank');
        toast(job.status === 'done' ? `${label} export ready` : (job.error || `${label} export fail`));
      }
    } catch {
      clearInterval(timer);
    }
  }, 1500);
}

const STUDIO_CLIPBOARD_KEY = 'nova.studio.clipboard.v1';

function currentStudioJob() {
  return mediaJobs.find((item) => item.id === studioState.jobId)
    || mediaJobs.find((item) => item.studio)
    || null;
}

function studioClipKey(track, index) {
  return `${track}:${index}`;
}

function applyStudioSelection() {
  document.querySelectorAll('#studio .timeline-dock [data-track][data-index]').forEach((node) => {
    node.classList.toggle('selected', studioState.selection.has(studioClipKey(node.dataset.track, node.dataset.index)));
  });
  const count = studioState.selection.size;
  if (els.studioCopyClip) els.studioCopyClip.disabled = count === 0;
  if (els.studioDeleteClip) els.studioDeleteClip.disabled = count === 0;
  if (els.studioPasteClip) els.studioPasteClip.disabled = !(studioState.clipboard || []).length;
}

function selectStudioClip(track, index, event = {}) {
  const key = studioClipKey(track, index);
  const selection = studioState.selection;
  if (event.shiftKey && studioState.lastSelected) {
    const [lastTrack, lastIndexRaw] = String(studioState.lastSelected).split(':');
    const lastIndex = Number(lastIndexRaw);
    if (lastTrack === track && Number.isFinite(lastIndex)) {
      for (let i = Math.min(lastIndex, index); i <= Math.max(lastIndex, index); i += 1) {
        selection.add(studioClipKey(track, i));
      }
    } else {
      selection.add(key);
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (selection.has(key)) selection.delete(key);
    else selection.add(key);
  } else {
    selection.clear();
    selection.add(key);
  }
  studioState.lastSelected = key;
  applyStudioSelection();
}

function handleStudioTrackClick(event, track) {
  const clip = event.target.closest(`[data-track="${track}"][data-index]`);
  if (!clip) {
    studioState.selection.clear();
    applyStudioSelection();
    return;
  }
  selectStudioClip(track, Number(clip.dataset.index), event);
  if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
    studioSeekTo(Number(clip.dataset.start) || 0);
  }
}

function selectAllStudioClips() {
  const job = currentStudioJob();
  if (!job) {
    toast('Pehle Studio me video banayein');
    return;
  }
  studioState.selection.clear();
  for (const [index, scene] of (job.scenes || []).entries()) {
    studioState.selection.add(studioClipKey('video', index));
    if (scene.image || scene.video) studioState.selection.add(studioClipKey('image', index));
  }
  if (job.narrationPath || job.audioPath || job.ambientPath) studioState.selection.add('audio:0');
  applyStudioSelection();
  toast(`${studioState.selection.size} clips select`);
}

function copyStudioSelection() {
  const job = currentStudioJob();
  if (!job || !studioState.selection.size) {
    toast('Pehle clip select karein');
    return;
  }
  const items = [];
  for (const key of studioState.selection) {
    const [track, indexRaw] = String(key).split(':');
    const index = Number(indexRaw);
    if (track === 'audio') {
      const source = job.narrationPath || job.audioPath || job.ambientPath || '';
      if (!source) continue;
      items.push({
        track: 'audio',
        source,
        kind: job.narrationPath ? 'narration' : (job.audioPath ? 'audio' : 'ambient'),
      });
      continue;
    }
    const scene = job.scenes?.[index];
    if (!scene) continue;
    const beat = JSON.parse(JSON.stringify(job.visualBeats?.[index] || {}));
    if (track === 'video') {
      items.push({ track: 'video', scene: JSON.parse(JSON.stringify(scene)), beat });
    } else if (scene.image || scene.video) {
      items.push({
        track: 'image',
        scene: {
          image: scene.image || null,
          video: track === 'image' && scene.image ? null : (scene.video || null),
          imagePrompt: scene.imagePrompt || '',
          caption: scene.caption || '',
          status: 'image-ready',
        },
        beat,
      });
    }
  }
  if (!items.length) {
    toast('Selected clips copy nahi hue');
    return;
  }
  studioState.clipboard = items;
  try { localStorage.setItem(STUDIO_CLIPBOARD_KEY, JSON.stringify(items)); } catch { /* storage full */ }
  applyStudioSelection();
  toast(`${items.length} clip copy`);
}

async function patchStudioJob(jobId, patch) {
  const response = await fetch(`/api/media-jobs/${encodeURIComponent(jobId)}/patch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Timeline edit save nahi hua');
  return data;
}

function evenStudioBeats(beats, durationSeconds) {
  const total = Math.max(1, beats.length);
  const duration = Number(durationSeconds) || 60;
  return beats.map((beat, index) => ({
    ...beat,
    lineIndex: Number.isFinite(Number(beat?.lineIndex)) ? Number(beat.lineIndex) : index,
    start: (duration * index) / total,
    end: (duration * (index + 1)) / total,
  }));
}

async function pasteStudioClips() {
  const job = currentStudioJob();
  const items = studioState.clipboard || [];
  if (!job) {
    toast('Pehle Studio me video banayein');
    return;
  }
  if (!items.length) {
    toast('Clipboard khaali hai — pehle copy karein');
    return;
  }
  const scenes = JSON.parse(JSON.stringify(job.scenes || []));
  const beats = JSON.parse(JSON.stringify(job.visualBeats || []));
  const prompts = JSON.parse(JSON.stringify(job.imagePrompts || []));
  const duration = Number(job.durationSeconds) || 60;
  const current = Number(els.studioPreview?.currentTime) || Number(studioState.audio?.currentTime) || 0;
  let at = Math.max(0, Math.min(scenes.length, Math.round((current / duration) * scenes.length)));
  const patch = {};
  for (const item of items) {
    if (item.track === 'audio') {
      if (!item.source) continue;
      if (item.kind === 'narration') patch.narrationPath = item.source;
      else if (item.kind === 'audio') patch.audioPath = item.source;
      else patch.ambientPath = item.source;
      continue;
    }
    const scene = JSON.parse(JSON.stringify(item.scene || {}));
    scene.index = at + 1;
    scene.status = item.track === 'image' ? 'image-ready' : (scene.status || 'ready');
    if (item.track === 'image') scene.video = null;
    scenes.splice(at, 0, scene);
    beats.splice(at, 0, JSON.parse(JSON.stringify(item.beat || { prompt: scene.imagePrompt || '' })));
    prompts.splice(at, 0, scene.imagePrompt || '');
    at += 1;
  }
  patch.scenes = scenes;
  patch.visualBeats = evenStudioBeats(beats, duration);
  patch.imagePrompts = prompts;
  patch.sceneCount = scenes.length;
  patch.status = 'awaiting-render';
  patch.progress = 75;
  patch.outputUrl = null;
  patch.output = null;
  patch.step = `${items.length} clip paste ho gaye — final render dobara karein`;
  try {
    await patchStudioJob(job.id, patch);
    await loadMediaJobs();
    studioState.selection.clear();
    studioState.lastSelected = null;
    applyStudioSelection();
    toast(`${items.length} clip paste ho gaye`);
  } catch (error) {
    toast(error?.message || 'Paste fail ho gaya');
  }
}

async function deleteStudioSelection() {
  const job = currentStudioJob();
  if (!job || !studioState.selection.size) {
    toast('Pehle delete ke liye clip select karein');
    return;
  }
  const scenes = JSON.parse(JSON.stringify(job.scenes || []));
  const beats = JSON.parse(JSON.stringify(job.visualBeats || []));
  const prompts = JSON.parse(JSON.stringify(job.imagePrompts || []));
  const videoIndices = new Set();
  const imageIndices = new Set();
  const patch = {};
  for (const key of studioState.selection) {
    const [track, indexRaw] = String(key).split(':');
    const index = Number(indexRaw);
    if (track === 'video' && Number.isInteger(index)) videoIndices.add(index);
    else if (track === 'image' && Number.isInteger(index)) imageIndices.add(index);
    else if (track === 'audio') {
      patch.narrationPath = null;
      patch.audioPath = null;
      patch.ambientPath = null;
    }
  }
  for (const index of imageIndices) {
    if (videoIndices.has(index) || !scenes[index]) continue;
    scenes[index].image = null;
    if (!scenes[index].video) videoIndices.add(index);
  }
  for (const index of [...videoIndices].sort((a, b) => b - a)) {
    scenes.splice(index, 1);
    beats.splice(index, 1);
    prompts.splice(index, 1);
  }
  patch.scenes = scenes;
  patch.visualBeats = evenStudioBeats(beats, job.durationSeconds);
  patch.imagePrompts = prompts;
  patch.sceneCount = scenes.length;
  patch.status = 'awaiting-render';
  patch.progress = 75;
  patch.outputUrl = null;
  patch.output = null;
  patch.step = 'Timeline edit hua — final render dobara karein';
  try {
    await patchStudioJob(job.id, patch);
    await loadMediaJobs();
    studioState.selection.clear();
    studioState.lastSelected = null;
    applyStudioSelection();
    toast('Selected clips delete ho gaye');
  } catch (error) {
    toast(error?.message || 'Delete fail ho gaya');
  }
}

function handleStudioKey(event) {
  if (!els.studio || els.studio.hidden) return;
  const tag = String(event.target?.tagName || '');
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
  const mod = event.ctrlKey || event.metaKey;
  const key = String(event.key || '').toLowerCase();
  if (mod && key === 'a') {
    event.preventDefault();
    selectAllStudioClips();
  } else if (mod && key === 'c') {
    event.preventDefault();
    copyStudioSelection();
  } else if (mod && key === 'v') {
    event.preventDefault();
    pasteStudioClips();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteStudioSelection();
  } else if (event.key === 'Escape') {
    studioState.selection.clear();
    applyStudioSelection();
  }
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
  els.studioTimeline?.addEventListener('click', (event) => handleStudioTrackClick(event, 'video'));
  els.studioImageTimeline?.addEventListener('click', (event) => handleStudioTrackClick(event, 'image'));
  els.studioAudioTrack?.addEventListener('click', (event) => {
    handleStudioTrackClick(event, 'audio');
    const rect = els.studioAudioTrack.getBoundingClientRect();
    const ratio = studioClamp((event.clientX - rect.left - 92) / Math.max(1, rect.width - 92), 0, 1);
    studioSeekTo(ratio * studioVideoDuration());
  });
  els.studioSelectAll?.addEventListener('click', selectAllStudioClips);
  els.studioCopyClip?.addEventListener('click', copyStudioSelection);
  els.studioPasteClip?.addEventListener('click', pasteStudioClips);
  els.studioDeleteClip?.addEventListener('click', deleteStudioSelection);
  document.addEventListener('keydown', handleStudioKey);
  els.studioExportBtn?.addEventListener('click', exportStudioMedia);
  els.studioMuteVideo?.addEventListener('click', () => toggleStudioTrack('video'));
  els.studioMuteImage?.addEventListener('click', () => toggleStudioTrack('image'));
  els.studioMuteAudio?.addEventListener('click', () => toggleStudioTrack('audio'));

  // Track add menu — video/image/audio/fx/transition tracks (multiple allowed).
  els.studioTrackAddBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    const popover = els.studioTrackAddPopover;
    if (!popover) return;
    popover.hidden = !popover.hidden;
    els.studioTrackAddBtn?.setAttribute('aria-expanded', String(!popover.hidden));
  });
  els.studioTrackAddPopover?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-track-type]');
    if (!button) return;
    event.stopPropagation();
    const job = currentStudioJob();
    if (!job) {
      toast('Pehle Studio me video banayein — tab track add hoga');
      return;
    }
    const type = button.dataset.trackType;
    els.studioTrackAddPopover.hidden = true;
    els.studioTrackAddBtn?.setAttribute('aria-expanded', 'false');
    await studioTrackAction(job.id, 'add-track', { type });
  });
  document.addEventListener('click', (event) => {
    if (!els.studioTrackAddPopover || els.studioTrackAddPopover.hidden) return;
    if (event.target.closest('#studioTrackAddMenu')) return;
    els.studioTrackAddPopover.hidden = true;
    els.studioTrackAddBtn?.setAttribute('aria-expanded', 'false');
  });
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
  setupStudioPanelTabs();
  setupStudioTimeline();
  loadChatGptStatus();
  loadArenaStatus();
  studioState.jobId = studioState.jobId || (mediaJobs.find((job) => job.studio)?.id || null);
  loadStudioCatalog();
  renderStudioAssets();
  renderStudioMusicList();
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

    // Timeline me drag karke daal sakte ho.
    row.draggable = true;
    row.addEventListener('dragstart', (event) => {
      row.classList.add('dragging');
      event.dataTransfer?.setData('application/x-nova-asset', JSON.stringify({
        path: asset.path,
        name: asset.name,
        kind: asset.kind,
        duration: asset.duration || 5,
      }));
      event.dataTransfer?.setData('text/plain', asset.name || asset.path);
      event.dataTransfer.effectAllowed = 'copy';
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));

    const actions = document.createElement('div');
    actions.className = 'inline-row';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'asset-add';
    addBtn.title = 'Timeline me add karo';
    addBtn.setAttribute('aria-label', 'Timeline me add karo');
    addBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>';
    addBtn.addEventListener('click', () => addStudioAssetToTimeline(asset));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'asset-del';
    delBtn.title = 'File delete karo';
    delBtn.setAttribute('aria-label', 'File delete karo');
    delBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></svg>';
    delBtn.addEventListener('click', () => deleteStudioAsset(asset));
    actions.append(addBtn, delBtn);

    row.append(thumb, meta, role, actions);
    list.append(row);
  });
}

// Import panel se asset ko sahi track me daal do.
async function addStudioAssetToTimeline(asset) {
  const job = currentStudioJob();
  if (!job) {
    toast('Pehle Studio me video banayein — tab timeline me add hoga');
    return;
  }
  const tracks = studioTrackList(job);
  const wanted = asset.kind === 'audio' ? 'audio' : asset.kind;
  let target = tracks.find((track) => track.type === wanted);
  if (!target) target = tracks.find((track) => track.type === 'video');
  if (!target) {
    toast('Track nahi mila');
    return;
  }
  await studioTrackAction(job.id, 'add-clip', {
    trackId: target.id,
    kind: asset.kind,
    label: asset.name || 'Imported clip',
    path: asset.path,
    start: 0,
    duration: Math.max(1, Number(asset.duration) || 5),
  });
}

// File delete — disk se bhi hatao aur timeline se.
async function deleteStudioAsset(asset) {
  if (!asset?.path) return;
  const index = studioState.assets.findIndex((item) => item.path === asset.path);
  if (index >= 0) studioState.assets.splice(index, 1);
  renderStudioAssets();
  renderStudioMusicList();
  try {
    const response = await fetch('/api/media-upload/delete', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ path: asset.path }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Delete fail');
    toast(`${asset.name || 'File'} delete ho gayi`);
    await loadMediaJobs();
    renderStudioDashboard();
  } catch (error) {
    toast(error?.message || 'Delete fail');
  }
}

function analysisText(asset) {
  if (!asset.analysis) return '';
  const info = asset.analysis;
  if (info.width) return ` · ${info.width}x${info.height}`;
  if (info.audioCodec) return ` · ${info.audioCodec}`;
  return '';
}

async function uploadStudioAsset(file, role = null) {
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
    role: role || (kind === 'audio' ? 'voice' : 'scene'),
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
  return asset;
}

async function importStudioFiles(files) {
  const items = [...(files || [])];
  if (!items.length) return;
  for (const file of items) {
    toast(`Studio me import ho raha hai: ${file.name}`);
    try {
      await uploadStudioAsset(file);
    } catch (err) {
      toast(err.message || `${file.name} import nahi hua`);
    }
  }
  renderStudioAssets();
  renderStudioMusicList();
  toast(`${items.length} file(s) studio me ready`);
}

async function importStudioMusic(files) {
  const items = [...(files || [])];
  if (!items.length) return;
  for (const file of items) {
    try {
      await uploadStudioAsset(file, 'bgm');
    } catch (err) {
      toast(err.message || `${file.name} import nahi hua`);
    }
  }
  renderStudioAssets();
  renderStudioMusicList();
  if (els.studioMusicState) els.studioMusicState.textContent = 'Ready';
  toast('Background music set ho gaya');
}

function renderStudioMusicList() {
  const list = els.studioMusicList;
  if (!list) return;
  list.replaceChildren();
  const tracks = studioState.assets.filter((asset) => asset.role === 'bgm');
  if (!tracks.length) {
    const hint = document.createElement('p');
    hint.className = 'studio-hint';
    hint.textContent = 'Abhi koi background music nahi.';
    list.append(hint);
    return;
  }
  tracks.forEach((asset) => {
    const row = document.createElement('div');
    row.className = 'studio-media-item';
    const thumb = document.createElement('div');
    thumb.textContent = '🎵';
    thumb.style.cssText = 'display:grid;place-items:center;font-size:20px';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = asset.name || 'bgm';
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = `Background music${asset.duration ? ` · ${asset.duration.toFixed(1)}s` : ''}`;
    meta.append(name, sub);
    row.append(thumb, meta);
    list.append(row);
  });
}

// Thumbnail: ek alag cinematic cover image banao.
async function generateStudioThumbnail() {
  const text = String(els.studioThumbText?.value || '').trim()
    || String(els.studioPrompt?.value || '').trim()
    || String(els.studioTtsText?.value || '').trim().slice(0, 200);
  if (text.length < 4) {
    toast('Thumbnail description likho');
    els.studioThumbText?.focus();
    return;
  }
  if (els.studioThumbBtn) {
    els.studioThumbBtn.disabled = true;
    els.studioThumbBtn.textContent = 'Creating…';
  }
  if (els.studioThumbState) els.studioThumbState.textContent = 'Creating…';
  try {
    const response = await fetch('/api/video-studio/thumbnail', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        text,
        ratio: els.studioRatio?.value || '16:9',
        imageProvider: settings.imageProvider || DEFAULT_SETTINGS.imageProvider,
        imageModel: settings.mediaModels.image,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || 'Thumbnail nahi bani');
    if (els.studioThumbImage) els.studioThumbImage.src = data.url;
    if (els.studioThumbPreview) els.studioThumbPreview.hidden = false;
    if (els.studioThumbState) els.studioThumbState.textContent = 'Ready';
    if (els.studioThumbNote) els.studioThumbNote.textContent = 'Thumbnail ready — export ke liye hai.';
    toast('Thumbnail ready');
  } catch (error) {
    if (els.studioThumbState) els.studioThumbState.textContent = 'Failed';
    if (els.studioThumbNote) els.studioThumbNote.textContent = error?.message || 'Thumbnail nahi bani — dobara try karein.';
    toast(error?.message || 'Thumbnail nahi bani');
  } finally {
    if (els.studioThumbBtn) {
      els.studioThumbBtn.disabled = false;
      els.studioThumbBtn.textContent = 'Generate thumbnail';
    }
  }
}

async function generateStudioAudio() {
  const text = String(els.studioTtsText?.value || '').trim();
  if (text.length < 10) {
    toast('Pehle story ya script likhein');
    els.studioTtsText?.focus();
    return;
  }
  if (text.length > 14_000) {
    toast('Story 14,000 characters se lambi hai — thoda chhota karein');
    return;
  }
  const voice = els.studioTtsVoice?.value || 'auto';
  if (els.studioTtsBtn) {
    els.studioTtsBtn.disabled = true;
    els.studioTtsBtn.textContent = 'Generating…';
  }
  if (els.studioTtsState) els.studioTtsState.textContent = 'Generating…';
  if (els.studioTtsNote) els.studioTtsNote.textContent = 'Neural voice story ki audio bana rahi hai…';
  try {
    const response = await fetch('/api/video-studio/text-to-audio', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ text, voice }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.path) throw new Error(data.error || 'Story audio nahi bani');
    const duration = Number(data.duration) || 0;
    studioState.storyAudio = {
      path: data.path,
      url: data.url || `/api/file?path=${encodeURIComponent(data.path)}`,
      duration,
      voice,
      text,
    };
    if (els.studioTtsAudio) {
      els.studioTtsAudio.src = studioState.storyAudio.url;
      els.studioTtsAudio.hidden = false;
      els.studioTtsAudio.load();
    }
    if (els.studioTtsState) els.studioTtsState.textContent = duration ? formatStudioClock(duration) : 'Audio ready';
    if (els.studioTtsNote) {
      els.studioTtsNote.textContent = `Audio ready${duration ? ` · ${formatStudioClock(duration)}` : ''} — Create video par ye voice track use hogi.`;
    }
    if (els.studioPrompt && !els.studioPrompt.value.trim()) els.studioPrompt.value = text;
    if (els.studioVoice) els.studioVoice.value = voice;
    if (els.studioNarration) els.studioNarration.checked = true;
    if (els.studioRenderNote) els.studioRenderNote.textContent = 'Story audio ready — ab Create video se images aur final video banayein.';
    toast(`Story audio ready${duration ? ` · ${formatStudioClock(duration)}` : ''}`);
  } catch (error) {
    if (els.studioTtsState) els.studioTtsState.textContent = 'Failed';
    if (els.studioTtsNote) els.studioTtsNote.textContent = error?.message || 'Story audio nahi bani — dobara try karein.';
    toast(error?.message || 'Story audio nahi bani');
  } finally {
    if (els.studioTtsBtn) {
      els.studioTtsBtn.disabled = false;
      els.studioTtsBtn.textContent = 'Generate audio';
    }
  }
}

// Text to video: ek short AI clip banao aur turant timeline me jod do.
async function generateStudioVideoClip() {
  const text = String(els.studioVideoText?.value || '').trim();
  if (text.length < 5) {
    toast('Clip description likho');
    els.studioVideoText?.focus();
    return;
  }
  const duration = Number(els.studioVideoDuration?.value) || 5;
  const videoProvider = studioVideoProvider();
  if (videoProvider === 'arena') {
    const arena = await loadArenaStatus();
    if (!arena?.loggedIn) {
      toast('Pehle Arena.ai login karein — button dabao, Chrome me sign-in karo');
      els.studioArenaLoginBtnVideo?.focus();
      return;
    }
  }
  if (els.studioVideoBtn) {
    els.studioVideoBtn.disabled = true;
    els.studioVideoBtn.textContent = 'Creating…';
  }
  if (els.studioVideoState) els.studioVideoState.textContent = 'Creating…';
  if (els.studioVideoNote) els.studioVideoNote.textContent = 'AI clip ban raha hai…';
  try {
    const response = await fetch('/api/video-studio/text-to-video', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        text,
        duration,
        jobId: studioState.jobId || null,
        storyAudioPath: studioState.storyAudio?.path || null,
        ratio: els.studioRatio?.value || '16:9',
        style: /cartoon|anime|comic/.test(els.studioCategory?.value || '') ? 'cartoon' : 'cinematic',
        videoModel: settings.mediaModels.video,
        imageProvider: settings.imageProvider || DEFAULT_SETTINGS.imageProvider,
        videoProvider,
        chatId: activeChat()?.id,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.jobId) throw new Error(data.error || 'Clip nahi bani');
    studioState.jobId = data.jobId;
    if (els.studioVideoState) els.studioVideoState.textContent = 'Ready';
    if (els.studioVideoNote) els.studioVideoNote.textContent = 'Clip ready — timeline me aa gayi.';
    if (els.studioVideoList) {
      const item = document.createElement('div');
      item.className = 'studio-media-item';
      const video = document.createElement('video');
      video.src = data.url || '';
      video.muted = true;
      video.preload = 'metadata';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = text.slice(0, 48);
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = `AI clip · ${duration}s`;
      meta.append(name, sub);
      item.append(video, meta);
      els.studioVideoList.prepend(item);
    }
    await loadMediaJobs();
    renderStudioDashboard();
    toast('Clip ban gayi — timeline me jud gayi');
  } catch (error) {
    if (els.studioVideoState) els.studioVideoState.textContent = 'Failed';
    if (els.studioVideoNote) els.studioVideoNote.textContent = error?.message || 'Clip nahi bani — dobara try karein.';
    toast(error?.message || 'Clip nahi bani');
  } finally {
    if (els.studioVideoBtn) {
      els.studioVideoBtn.disabled = false;
      els.studioVideoBtn.textContent = 'Generate clip';
    }
  }
}

// Compact icon tabs + left rail — sirf selected tool ka panel dikhe.
function selectStudioPane(name) {
  const tabs = els.studioPanelTabs;
  if (tabs) {
    for (const button of tabs.querySelectorAll('.studio-tab[data-pane]')) {
      button.classList.toggle('active', button.dataset.pane === name);
    }
  }
  const rail = els.studioRail;
  if (rail) {
    for (const button of rail.querySelectorAll('.studio-rail-item[data-pane]')) {
      button.classList.toggle('active', button.dataset.pane === name);
    }
  }
  for (const pane of document.querySelectorAll('.studio-pane')) {
    pane.classList.toggle('active', pane.dataset.pane === name);
  }
}

function setupStudioPanelTabs() {
  const tabs = els.studioPanelTabs;
  if (tabs && tabs.dataset.ready !== '1') {
    tabs.dataset.ready = '1';
    tabs.addEventListener('click', (event) => {
      const button = event.target.closest('.studio-tab[data-pane]');
      if (!button) return;
      selectStudioPane(button.dataset.pane);
    });
  }
  const rail = els.studioRail;
  if (rail && rail.dataset.ready !== '1') {
    rail.dataset.ready = '1';
    rail.addEventListener('click', (event) => {
      const button = event.target.closest('.studio-rail-item[data-pane]');
      if (!button) return;
      selectStudioPane(button.dataset.pane);
    });
  }
  const active = rail?.querySelector('.studio-rail-item.active') || tabs?.querySelector('.studio-tab.active');
  selectStudioPane(active?.dataset.pane || 'script');
}

async function loadChatGptStatus() {
  try {
    const response = await fetch('/api/chatgpt-status');
    const data = await response.json().catch(() => ({}));
    const connected = Boolean(data.configured);
    els.studioChatGptBadge?.classList.toggle('on', connected);
    els.studioRailChatGpt?.classList.toggle('on', connected);
    if (els.studioChatGptBtn) {
      els.studioChatGptBtn.classList.toggle('on', connected);
      els.studioChatGptBtn.title = connected
        ? `ChatGPT connected — ${data.user?.email || data.user?.name || 'account'}`
        : 'Login with ChatGPT';
    }
    if (els.studioChatGptLoginBtn) {
      els.studioChatGptLoginBtn.classList.toggle('on', connected);
      if (els.studioChatGptLabel) {
        els.studioChatGptLabel.textContent = connected
          ? `ChatGPT: ${data.user?.email || data.user?.name || 'connected'}`
          : 'Login with ChatGPT';
      }
    }
    if (els.studioChatGptNote) {
      els.studioChatGptNote.textContent = connected
        ? `Connected${data.chatId ? ' · Nova-AI project ready' : ''} — har story ka apna ChatGPT chat banta hai.`
        : 'ChatGPT account se images — har story ka apna alag chat, character same.';
    }
    if (els.chatGptStatusText) {
      els.chatGptStatusText.textContent = connected
        ? `Connected${data.user?.email ? ` · ${data.user.email}` : ''}${data.chatId ? ' · Nova-AI project ready' : ''}. Har story ka apna ChatGPT chat banta hai — restart ke baad wahin se resume.`
        : 'ChatGPT Go account se images — Nova ke apne Chrome profile me ek baar sign-in karein. Uske baad har story apne alag ChatGPT chat me images banati hai.';
    }
    // ChatGPT connected hai to images usi account se banein — default provider bhi wahi.
    // Arena.ai user ne khud chuna hai to usse force mat karo.
    if (connected && settings.imageProvider !== 'chatgpt' && settings.imageProvider !== 'arena') {
      settings.imageProvider = 'chatgpt';
      saveSettings();
      if (els.imageProviderSelect) els.imageProviderSelect.value = 'chatgpt';
    }
    return data;
  } catch {
    return null;
  }
}

async function chatGptLogin() {
  const button = els.studioChatGptLoginBtn || els.studioChatGptBtn || els.chatGptLoginBtn;
  if (button) button.disabled = true;
  const original = button?.textContent;
  try {
    const status = await loadChatGptStatus();
    if (status?.configured) {
      const response = await fetch('/api/chatgpt-sync', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'ChatGPT sync nahi hua');
      await loadChatGptStatus();
      toast('ChatGPT connected — har story apne chat me images banayegi');
      return;
    }
    const response = await fetch('/api/chatgpt-login', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'ChatGPT login tab nahi khul paaya');
    toast('Chrome me ChatGPT login karein — Nova wait kar raha hai…');
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const sync = await fetch('/api/chatgpt-sync', { method: 'POST' })
        .then((res) => res.json().catch(() => ({})))
        .catch(() => ({}));
      if (sync.configured) {
        await loadChatGptStatus();
        toast('ChatGPT login ho gaya — images isi account se bante hain');
        return;
      }
    }
    toast('Login complete karke button dobara dabao');
  } catch (error) {
    toast(error?.message || 'ChatGPT login nahi hua');
  } finally {
    if (button) {
      button.disabled = false;
      if (original && button === els.studioChatGptLoginBtn) button.textContent = original;
    }
  }
}

// Arena.ai — free image + video arena. Login ek baar, phir daily free credits.
async function loadArenaStatus(refresh = false) {
  try {
    const response = await fetch(`/api/arena-status${refresh ? '?refresh=1' : ''}`);
    const data = await response.json().catch(() => ({}));
    const connected = Boolean(data.loggedIn || data.configured);
    const labelText = connected
      ? `Arena.ai: ${data.email || data.name || 'connected'}`
      : 'Login with Arena.ai';
    for (const button of [els.studioArenaLoginBtn, els.studioArenaLoginBtnVideo]) {
      button?.classList.toggle('on', connected);
    }
    if (els.studioArenaLabel) els.studioArenaLabel.textContent = labelText;
    if (els.studioArenaLabelVideo) els.studioArenaLabelVideo.textContent = labelText;
    if (els.studioArenaNote) {
      els.studioArenaNote.textContent = connected
        ? 'Arena.ai connected — image + video arena free daily credits se chalega (GPT ki zarurat nahi).'
        : 'Arena.ai free hai — login ke baad image + video arena bina GPT ke chalega (daily free credits).';
    }
    if (els.studioArenaNoteVideo) {
      els.studioArenaNoteVideo.textContent = connected
        ? 'Arena.ai connected — video arena se free clip banegi (roz ~2 clips, generation slow).'
        : 'Arena.ai video arena free hai — roz ~2 clips, generation slow (10 min tak).';
    }
    return data;
  } catch {
    return null;
  }
}

async function arenaLogin() {
  const button = els.studioArenaLoginBtnVideo?.offsetParent ? els.studioArenaLoginBtnVideo : els.studioArenaLoginBtn;
  if (button) button.disabled = true;
  try {
    const response = await fetch('/api/arena-login', { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Arena.ai login nahi hua');
    await loadArenaStatus(true);
    toast('Arena.ai connected — ab images + clips bina GPT ke ban sakte hain');
  } catch (error) {
    toast(error?.message || 'Arena.ai login nahi hua');
  } finally {
    if (button) button.disabled = false;
  }
}

// Studio pane me provider select — blank = global setting use karo.
function studioImageProvider() {
  const picked = String(els.studioImageProvider?.value || '').trim();
  if (picked) return picked;
  return settings.imageProvider || DEFAULT_SETTINGS.imageProvider;
}

function studioVideoProvider() {
  const picked = String(els.studioVideoProvider?.value || '').trim();
  if (picked) return picked;
  return settings.videoProvider || 'ltx';
}

// Text to image: scene text se images banao — har image banate hi timeline me aa jayegi.
async function generateStudioImages() {
  const text = String(els.studioImageText?.value || '').trim()
    || String(els.studioTtsText?.value || '').trim()
    || String(els.studioPrompt?.value || '').trim();
  if (text.length < 8) {
    toast('Scene text likho ya story audio wala text use karo');
    els.studioImageText?.focus();
    return;
  }
  const countValue = String(els.studioImageCount?.value || 'auto');
  const count = countValue === 'auto' ? 0 : Number(countValue) || 0;
  const provider = studioImageProvider();
  if (provider === 'arena') {
    const arena = await loadArenaStatus();
    if (!arena?.loggedIn) {
      toast('Pehle Arena.ai login karein — button dabao, Chrome me sign-in karo');
      els.studioArenaLoginBtn?.focus();
      return;
    }
  }
  if (els.studioImageBtn) {
    els.studioImageBtn.disabled = true;
    els.studioImageBtn.textContent = 'Creating…';
  }
  if (els.studioImageState) els.studioImageState.textContent = 'Creating…';
  if (els.studioImageProgress) {
    els.studioImageProgress.hidden = false;
    const bar = els.studioImageProgressBar;
    if (bar) bar.style.width = '4%';
    if (els.studioImageProgressText) els.studioImageProgressText.textContent = '0 images ready';
  }
  if (els.studioImageNote) els.studioImageNote.textContent = 'Images ban rahi hain — ek ek karke timeline me aa jayengi…';
  try {
    const response = await fetch('/api/video-studio/text-to-image', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        text,
        count,
        storyAudioPath: studioState.storyAudio?.path || null,
        ratio: els.studioRatio?.value || '16:9',
        style: /cartoon|anime|comic/.test(els.studioCategory?.value || '') ? 'cartoon' : 'cinematic',
        imageProvider: provider,
        imageModel: settings.mediaModels.image,
        voice: els.studioVoice?.value || 'auto',
        chatId: activeChat()?.id,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.jobId) throw new Error(data.error || 'Images shuru nahi hui');
    studioState.jobId = data.jobId;
    if (els.studioRenderNote) els.studioRenderNote.textContent = 'Images ban rahi hain — ban jane par Create video dabayein.';
    await loadMediaJobs();
    renderStudioDashboard();
    toast('Images ban rahe hain — timeline me ek ek karke aayenge');
  } catch (error) {
    if (els.studioImageState) els.studioImageState.textContent = 'Failed';
    if (els.studioImageNote) els.studioImageNote.textContent = error?.message || 'Images nahi bani — dobara try karein.';
    toast(error?.message || 'Images nahi bani');
  } finally {
    if (els.studioImageBtn) {
      els.studioImageBtn.disabled = false;
      els.studioImageBtn.textContent = 'Generate images';
    }
  }
}

function studioPayload() {
  const storyText = String(els.studioTtsText?.value || '').trim();
  const prompt = els.studioPrompt.value.trim() || storyText;
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
    storyAudioPath: studioState.storyAudio?.path || null,
    storyText: storyText || null,
    bgmPath: studioState.assets.find((asset) => asset.role === 'bgm')?.path || null,
    fx: [...studioState.fx],
    transitions: [...studioState.transitions],
    visualizers: [...studioState.visualizers],
    audioFx: [...studioState.audioFx],
    bpm: Number(els.studioBpm.value) || 0,
    narration: els.studioNarration.checked,
    voice: voiceText,
    useAiVideo: false,
    imageProvider: studioImageProvider(),
    imageModel: settings.mediaModels.image,
  };
}

async function renderStudioVideo() {
  // Pehle se bani images + audio track hain to wahi render karo — naya job nahi.
  const existing = mediaJobs.find((item) => item.id === studioState.jobId);
  const reuse = existing && existing.status !== 'done'
    && (existing.scenes || []).some((scene) => scene.image || scene.video)
    ? existing
    : null;
  const payload = reuse ? { jobId: reuse.id } : studioPayload();
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
    toast(reuse ? 'Saved images + audio se final video render ho raha hai' : 'Pro video ban raha hai — sidebar me progress dekhein');
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

// ChatGPT chat info — har story ka apna chat, kitni images bani, kaun si lines baki.
function renderStudioChatGptInfo(job) {
  const row = els.studioChatGptInfo;
  const text = els.studioChatGptInfoText || row?.querySelector('span');
  const button = els.studioChatGptOpenBtn;
  if (!row) return;
  const chatId = job?.chatGptChatId || '';
  const total = Number(job?.chatGptImagesTotal) || 0;
  const done = Number(job?.chatGptImagesDone) || 0;
  const pending = Array.isArray(job?.chatGptPendingBeats) ? job.chatGptPendingBeats : [];
  if (!chatId && !total) {
    row.hidden = true;
    if (button) button.hidden = true;
    return;
  }
  row.hidden = false;
  if (button) button.hidden = !chatId;
  if (text) {
    const title = job?.chatGptChatTitle || 'Story chat';
    const parts = [title];
    if (total) parts.push(`${done}/${total} images`);
    if (pending.length) parts.push(`baki: ${pending.join(', ')}`);
    text.textContent = parts.join(' · ');
  }
}

async function openStudioChatGptChat() {
  const job = mediaJobs.find((item) => item.id === studioState.jobId)
    || mediaJobs.find((item) => item.studio);
  const chatId = job?.chatGptChatId || '';
  if (!chatId) {
    toast('Is story ka ChatGPT chat abhi bana nahi — pehle images banayein');
    return;
  }
  try {
    const response = await fetch('/api/chatgpt-open-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'ChatGPT chat nahi khul paaya');
    toast('ChatGPT chat khol diya — images wahi se check karo');
  } catch (error) {
    toast(error?.message || 'ChatGPT chat nahi khul paaya');
  }
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
    if (els.studioTracks) els.studioTracks.replaceChildren();
    if (els.studioTimeline) els.studioTimeline.innerHTML = '<div class="studio-hint">Scene timeline yahan dikhogi.</div>';
    if (els.studioImageTimeline) els.studioImageTimeline.innerHTML = '<div class="studio-hint">Image beats yahan dikhenge.</div>';
    if (els.studioAudioTrack) els.studioAudioTrack.innerHTML = '<div class="audio-wave"><i></i></div><span class="audio-empty">Voice track story ke baad yahan aayega…</span>';
    studioState.audio = null;
    studioState.audioPath = '';
    studioState.audioBar = null;
    renderStudioRuler(60);
    updateStudioPlayhead();
    els.studioDone.innerHTML = '<span class="studio-hint">—</span>';
    els.studioRemaining.innerHTML = '<span class="studio-hint">—</span>';
    els.studioSave.textContent = 'Autosave on';
    els.studioResumeBtn.hidden = true;
    applyStudioSelection();
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

  els.studioTimeline?.replaceChildren();
  if (els.studioTimeline && !scenes.length) {
    const hint = document.createElement('div');
    hint.className = 'studio-hint';
    hint.textContent = 'Scenes banate hi yahan live dikhenge.';
    els.studioTimeline.append(hint);
  }
  scenes.forEach((scene, index) => {
    const node = document.createElement('div');
    const isDone = ['done', 'ready', 'clip-ready', 'image-ready'].includes(scene.status);
    node.className = `studio-scene${isDone ? ' done' : ''}${job.status === 'rendering' && index === scenes.length - 1 ? ' active' : ''}`;
    node.dataset.track = 'video';
    node.dataset.index = String(index);
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
    els.studioTimeline?.append(node);
  });
  renderStudioImageTimeline(job, scenes);
  renderStudioAudioTrack(job);
  renderStudioTracks(job);
  renderStudioRuler(Number(job.durationSeconds) || studioVideoDuration());
  updateStudioPlayhead();
  applyStudioSelection();
  els.studioSceneCount.textContent = scenes.length ? `· ${done}/${scenes.length} ready` : '';
  if (els.studioImageProgress) {
    const total = Number(job.sceneCount) || scenes.length || 0;
    const readyImages = scenes.filter((scene) => scene.image || scene.video).length;
    if (total || readyImages) {
      els.studioImageProgress.hidden = false;
      const bar = els.studioImageProgressBar;
      const pct = total ? Math.min(100, Math.round((readyImages / total) * 100)) : 0;
      if (bar) bar.style.width = `${pct}%`;
      if (els.studioImageProgressText) {
        els.studioImageProgressText.textContent = job.status === 'done' || job.status === 'awaiting-render'
          ? `${readyImages} images ready`
          : `${readyImages}/${total || readyImages} images ready`;
      }
      if (els.studioImageState) {
        els.studioImageState.textContent = ['done', 'awaiting-render'].includes(job.status) ? 'Ready' : 'Creating…';
      }
    }
  }
  renderStudioChatGptInfo(job);

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
  // Preview video — current project ka output, warna last finished video (playable rahe).
  const previewJob = job.outputUrl
    ? job
    : mediaJobs.find((item) => item.studio && item.outputUrl) || null;
  const previewUrl = previewJob?.outputUrl || '';
  if (previewUrl && els.studioPreview.dataset.src !== previewUrl) {
    els.studioPreview.src = previewUrl;
    els.studioPreview.dataset.src = previewUrl;
    els.studioPreview.dataset.job = previewJob.id;
    els.studioPreviewEmpty.hidden = true;
    if (els.studioPreview.dataset.controls !== '1') {
      els.studioPreview.parentElement.append(playerControls(els.studioPreview, previewJob.id));
      els.studioPreview.dataset.controls = '1';
    }
  } else if (!previewUrl) {
    els.studioPreview.removeAttribute('src');
    els.studioPreview.dataset.src = '';
    els.studioPreview.dataset.job = '';
    els.studioPreviewEmpty.hidden = false;
  }
}

function renderStudioAudioTrack(job) {
  const track = els.studioAudioTrack;
  if (!track) return;
  const srcPath = job.narrationPath || job.audioPath || job.ambientPath || '';
  if (studioState.audio && studioState.audioPath === srcPath) return;
  if (studioState.audio) {
    studioState.audio.pause();
    studioState.audio.removeAttribute('src');
    studioState.audio = null;
    studioState.audioPath = '';
    studioState.audioBar = null;
  }
  if (!srcPath) {
    const empty = document.createElement('span');
    empty.className = 'audio-empty';
    empty.textContent = 'Voice track story ke baad yahan aayega…';
    track.replaceChildren(empty);
    return;
  }
  const audio = document.createElement('audio');
  audio.className = 'studio-audio';
  audio.preload = 'metadata';
  audio.src = `/api/file?path=${encodeURIComponent(srcPath)}`;
  audio.muted = Boolean(studioState.layout?.muted?.audio);
  const wave = document.createElement('div');
  wave.className = 'audio-wave';
  const bar = document.createElement('i');
  wave.append(bar);
  const label = document.createElement('span');
  label.className = 'audio-label';
  label.textContent = job.narrationPath ? 'Narration' : (job.audioPath ? 'Uploaded audio' : 'Ambient');
  track.replaceChildren(audio, wave, label);
  studioState.audio = audio;
  studioState.audioPath = srcPath;
  studioState.audioBar = bar;
  const duration = Number(job.durationSeconds) || 60;
  audio.addEventListener('timeupdate', () => {
    bar.style.width = `${Math.round((Number(audio.currentTime || 0) / duration) * 100)}%`;
    if (!els.studioPreview?.src) updateStudioPlayhead();
  });
  audio.addEventListener('play', syncStudioPlayButton);
  audio.addEventListener('pause', syncStudioPlayButton);
  syncStudioPlayButton();
}

function renderStudioImageTimeline(job, scenes) {
  if (!els.studioImageTimeline) return;
  els.studioImageTimeline.replaceChildren();
  const beats = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => Boolean(scene.image || scene.video));
  if (!beats.length) {
    const hint = document.createElement('div');
    hint.className = 'studio-hint';
    hint.textContent = 'Image beats yahan dikhenge.';
    els.studioImageTimeline.append(hint);
    return;
  }
  const duration = Number(job.durationSeconds) || 60;
  for (const { scene, index } of beats) {
    const beat = job.visualBeats?.[index];
    const start = Number.isFinite(Number(beat?.start)) ? Number(beat.start) : (duration / scenes.length) * index;
    const end = Number.isFinite(Number(beat?.end)) ? Number(beat.end) : start + duration / scenes.length;
    const node = document.createElement('div');
    node.className = 'studio-beat';
    node.dataset.track = 'image';
    node.dataset.index = String(index);
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
  }
}

/* ---------------------- Multi-track timeline ------------------------------- */

const STUDIO_TRACK_TYPES = ['video', 'image', 'audio', 'fx', 'transition'];
const STUDIO_TRACK_PREFIX = { video: 'V', image: 'I', audio: 'A', fx: 'FX', transition: 'T' };
const STUDIO_TRACK_LABEL = { video: 'Video', image: 'Image', audio: 'Audio', fx: 'FX', transition: 'Transition' };

// Job se track list banao — default 5 tracks (video/image/audio/fx/transition) + user added.
function studioTrackList(job) {
  const list = Array.isArray(job?.trackList) ? job.trackList : [];
  const tracks = list
    .filter((track) => STUDIO_TRACK_TYPES.includes(track?.type))
    .map((track, index) => ({
      id: String(track.id || `tr_${track.type}_${index + 1}`),
      type: track.type,
      label: String(track.label || `${STUDIO_TRACK_PREFIX[track.type]}${index + 1}`),
      muted: Boolean(track.muted),
      locked: Boolean(track.locked),
      hidden: Boolean(track.hidden),
      clips: Array.isArray(track.clips) ? track.clips : [],
    }));
  for (const type of STUDIO_TRACK_TYPES) {
    if (tracks.some((track) => track.type === type)) continue;
    const count = tracks.filter((track) => track.type === type).length + 1;
    tracks.push({
      id: `tr_${type}_${count}`,
      type,
      label: `${STUDIO_TRACK_PREFIX[type]}${count} · ${STUDIO_TRACK_LABEL[type]}`,
      muted: false,
      locked: false,
      hidden: false,
      clips: [],
    });
  }
  return tracks;
}

// Track clips ko scene data se bharo (video/image/fx/transition + audio).
// Sirf har type ka PEHLA track scene-derived clips dikhata hai — extra tracks
// sirf user ke manually add kiye clips rakhte hain (CapCut jaisa overlay track).
function studioTrackClips(job, track, isPrimary = true) {
  const scenes = Array.isArray(job?.scenes) ? job.scenes : [];
  const duration = Math.max(1, Number(job?.durationSeconds) || 60);
  const perScene = duration / Math.max(1, scenes.length);
  const clips = [];
  if (isPrimary && (track.type === 'video' || track.type === 'image')) {
    scenes.forEach((scene, sceneIndex) => {
      const path = track.type === 'video' ? scene.video : scene.image;
      if (!path) return;
      const beat = job.visualBeats?.[sceneIndex];
      const start = Number.isFinite(Number(beat?.start)) ? Number(beat.start) : perScene * sceneIndex;
      const end = Number(beat?.end);
      clips.push({
        id: `${track.type}_${sceneIndex}`,
        kind: track.type,
        label: scene.caption || `${track.type === 'video' ? 'Scene' : 'Image'} ${sceneIndex + 1}`,
        path,
        start,
        duration: end > start ? end - start : perScene,
        sceneIndex,
      });
    });
  } else if (isPrimary && track.type === 'fx') {
    const fx = Array.isArray(job?.fx) ? job.fx : [];
    if (fx.length) {
      scenes.forEach((scene, sceneIndex) => {
        const beat = job.visualBeats?.[sceneIndex];
        const start = Number.isFinite(Number(beat?.start)) ? Number(beat.start) : perScene * sceneIndex;
        clips.push({
          id: `fx_${sceneIndex}`,
          kind: 'fx',
          label: fx.join(' + '),
          path: null,
          start,
          duration: perScene,
          sceneIndex,
        });
      });
    }
  } else if (isPrimary && track.type === 'transition') {
    const transitions = Array.isArray(job?.transitions) ? job.transitions : [];
    if (transitions.length) {
      scenes.forEach((scene, sceneIndex) => {
        if (sceneIndex >= scenes.length - 1) return;
        const beat = job.visualBeats?.[sceneIndex];
        const start = Number.isFinite(Number(beat?.start)) ? Number(beat.start) : perScene * sceneIndex;
        const end = Number(beat?.end);
        const clipDuration = end > start ? end - start : perScene;
        clips.push({
          id: `t_${sceneIndex}`,
          kind: 'transition',
          label: transitions[sceneIndex % transitions.length],
          path: null,
          start: start + clipDuration,
          duration: Math.min(0.8, Math.max(0.2, clipDuration / 5)),
          sceneIndex,
        });
      });
    }
  }
  // User ke manually add kiye clips (extra tracks) — unhe merge karo.
  for (const clip of track.clips || []) {
    if (clip?.sceneIndex !== null && clip?.sceneIndex !== undefined && clip.sceneIndex >= 0) continue;
    clips.push({ ...clip });
  }
  if (isPrimary && track.type === 'audio') {
    const sources = [
      { path: job.narrationPath, label: 'Narration' },
      { path: job.audioPath, label: 'Voice / Audio' },
      { path: job.ambientPath, label: 'Ambient' },
      { path: job.bgmPath, label: 'BGM' },
    ].filter((item) => item.path);
    sources.forEach((source, sourceIndex) => {
      clips.push({
        id: `a_${sourceIndex}`,
        kind: 'audio',
        label: source.label,
        path: source.path,
        start: 0,
        duration,
      });
    });
  }
  return clips;
}

function studioTrackIcon(type) {
  const paths = {
    video: '<rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" />',
    image: '<rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-5 4 4 3-3 4 4" />',
    audio: '<path d="M9 18V5l10-2v13" /><path d="M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />',
    fx: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" />',
    transition: '<path d="M3 8h12l-3-3M21 16H9l3 3" />',
  };
  return `<svg viewBox="0 0 24 24">${paths[type] || paths.video}</svg>`;
}

function renderStudioTracks(job) {
  const container = els.studioTracks;
  if (!container) return;
  container.replaceChildren();
  const tracks = studioTrackList(job);
  if (!tracks.length) return;
  const typeSeen = {};
  for (const track of tracks) {
    const isPrimary = !typeSeen[track.type];
    typeSeen[track.type] = true;
    if (track.hidden) continue;
    const row = document.createElement('div');
    row.className = `multi-track multi-track--${track.type}`;
    row.dataset.trackId = track.id;
    row.dataset.trackType = track.type;
    if (track.muted) row.classList.add('muted');

    const head = document.createElement('div');
    head.className = 'multi-track-head';
    const rowTop = document.createElement('div');
    rowTop.className = 'row';
    const title = document.createElement('strong');
    title.textContent = track.label;
    title.title = `${STUDIO_TRACK_LABEL[track.type]} track — ${track.label}`;
    const typeTag = document.createElement('small');
    typeTag.textContent = STUDIO_TRACK_PREFIX[track.type];
    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = `mini-track-btn${track.muted ? ' on' : ''}`;
    muteBtn.title = track.muted ? 'Unmute track' : 'Mute track';
    muteBtn.setAttribute('aria-label', muteBtn.title);
    muteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l4 6M21 9l-4 6" /></svg>';
    muteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      studioTrackAction(job.id, 'update-track', { trackId: track.id, muted: !track.muted });
    });
    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = `mini-track-btn${track.locked ? ' on' : ''}`;
    lockBtn.title = track.locked ? 'Unlock track' : 'Lock track';
    lockBtn.setAttribute('aria-label', lockBtn.title);
    lockBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>';
    lockBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      studioTrackAction(job.id, 'update-track', { trackId: track.id, locked: !track.locked });
    });
    rowTop.append(title, typeTag, muteBtn, lockBtn);
    const count = document.createElement('small');
    count.textContent = `${track.clips?.length || 0} clips`;
    head.append(rowTop, count);

    const lane = document.createElement('div');
    lane.className = 'multi-track-lane';
    const clips = studioTrackClips(job, track, isPrimary);
    if (!clips.length) {
      const hint = document.createElement('span');
      hint.className = 'studio-hint';
      hint.textContent = track.type === 'audio'
        ? 'Voice/BGM import karo ya Text-to-audio se banao.'
        : `${STUDIO_TRACK_LABEL[track.type]} clips yahan aayenge.`;
      lane.append(hint);
    }
    for (const clip of clips) {
      const node = document.createElement('div');
      node.className = 'track-clip';
      node.dataset.kind = clip.kind;
      node.dataset.trackId = track.id;
      node.dataset.clipId = clip.id;
      node.dataset.start = String(clip.start || 0);
      node.dataset.duration = String(clip.duration || 0);
      node.title = `${clip.label} · ${formatStudioClock(clip.duration || 0)}`;
      if (clip.path && (clip.kind === 'image' || clip.kind === 'video')) {
        const thumb = document.createElement(clip.kind === 'image' ? 'img' : 'video');
        thumb.src = `/api/file?path=${encodeURIComponent(clip.path)}`;
        if (clip.kind === 'video') { thumb.muted = true; thumb.preload = 'metadata'; }
        node.append(thumb);
      }
      const name = document.createElement('span');
      name.className = 'clip-name';
      name.textContent = clip.label;
      const dur = document.createElement('span');
      dur.className = 'clip-dur';
      dur.textContent = formatStudioClock(clip.duration || 0);
      node.append(name, dur);
      if (track.type !== 'video' && track.type !== 'image') {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'clip-del';
        del.title = 'Clip hatao';
        del.setAttribute('aria-label', 'Clip hatao');
        del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" /></svg>';
        del.addEventListener('click', (event) => {
          event.stopPropagation();
          studioTrackAction(job.id, 'remove-clip', { trackId: track.id, clipId: clip.id });
        });
        node.append(del);
      }
      lane.append(node);
    }

    // Import panel se drag karke clip drop karo.
    lane.addEventListener('dragover', (event) => {
      event.preventDefault();
      row.classList.add('drop-target');
    });
    lane.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    lane.addEventListener('drop', (event) => {
      event.preventDefault();
      row.classList.remove('drop-target');
      const raw = event.dataTransfer?.getData('application/x-nova-asset');
      if (!raw) return;
      let asset;
      try { asset = JSON.parse(raw); } catch { return; }
      if (!asset?.path) return;
      const kind = asset.kind || track.type;
      const compatible = (track.type === kind)
        || (track.type === 'video' && kind === 'image')
        || (track.type === 'image' && kind === 'video')
        || track.type === 'audio';
      if (!compatible) {
        toast(`${STUDIO_TRACK_LABEL[kind]} clip ${STUDIO_TRACK_LABEL[track.type]} track me nahi aa sakta`);
        return;
      }
      studioTrackAction(job.id, 'add-clip', {
        trackId: track.id,
        kind,
        label: asset.name || 'Imported clip',
        path: asset.path,
        start: 0,
        duration: Math.max(1, Number(asset.duration) || 5),
      });
    });

    row.append(head, lane);
    container.append(row);
  }
}

async function studioTrackAction(jobId, action, payload = {}) {
  try {
    const response = await fetch('/api/video-studio/tracks', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ jobId, action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Track update fail');
    await loadMediaJobs();
    renderStudioDashboard();
    toast(action === 'add-track' ? `${STUDIO_TRACK_LABEL[payload.type] || 'Track'} add ho gayi` : 'Timeline update saved');
  } catch (error) {
    toast(error?.message || 'Track update fail');
  }
}

function renderStudioPills(container, items, className) {  if (!container) return;
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
    } else if (!job.studio) {
      // Studio jobs apne dashboard me rehte hain — chat card me mat daalo,
      // warna chat delete karne se user ke banaye images/video delete ho jayenge.
      const target = chats.find((item) => item.id === job.chatId) || activeChat() || ensureChat();
      upsertJobMessage(target, job);
    }
    const lastTouch = Number(job.updatedAt || job.createdAt || 0);
    if (job.status === 'rendering' && Date.now() - lastTouch > 60_000) {
      if (job.renderMode === 'server') {
        // Server FFmpeg render kar raha hai (ek scene me minutes lagte hain) —
        // browser render queue karna double render ban jayega.
        job.step = 'Server render chal raha hai…';
      } else {
        // Page/renderer refresh ke baad rendering status atak jata hai — dobara queue karein.
        job.status = 'awaiting-render';
        job.step = 'Render resume…';
        updateJobStatus(job, 'awaiting-render', 'Render resume…', 75);
      }
    }
    // Server FFmpeg render kar raha hai to browser render queue mat karo (double render nahi).
    if (job.status === 'awaiting-render' && job.scenes?.length && job.renderMode !== 'server') queueMediaRender(job);
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
    await fetch(`/api/media-jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      headers: { 'x-nova-force': '1' },
    });
  } catch {
    /* local card already removed */
  }
}

function cancelActiveMediaJobs() {
  // Sirf abhi render chal raha wala job rok do. Studio assets (images/audio
  // + awaiting-render) user ke banaye hain — unhe kabhi delete mat karo.
  const active = mediaJobs.filter((job) =>
    !job.studio && ['queued', 'rendering'].includes(job.status),
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
els.studioTtsBtn?.addEventListener('click', generateStudioAudio);
els.studioImageBtn?.addEventListener('click', generateStudioImages);
els.studioVideoBtn?.addEventListener('click', generateStudioVideoClip);
els.studioThumbBtn?.addEventListener('click', generateStudioThumbnail);
els.studioChatGptBtn?.addEventListener('click', chatGptLogin);
els.studioChatGptLoginBtn?.addEventListener('click', chatGptLogin);
els.studioRailChatGpt?.addEventListener('click', chatGptLogin);
els.chatGptLoginBtn?.addEventListener('click', chatGptLogin);
els.studioChatGptOpenBtn?.addEventListener('click', openStudioChatGptChat);
els.studioArenaLoginBtn?.addEventListener('click', arenaLogin);
els.studioArenaLoginBtnVideo?.addEventListener('click', arenaLogin);
els.studioMusicImport?.addEventListener('click', () => els.studioMusicFiles?.click());
els.studioMusicFiles?.addEventListener('change', () => {
  importStudioMusic(els.studioMusicFiles.files);
  els.studioMusicFiles.value = '';
});
els.studioSteps.addEventListener('click', (event) => {
  const step = event.target.closest('.studio-step');
  if (!step) return;
  for (const button of els.studioSteps.querySelectorAll('.studio-step')) button.classList.remove('active');
  step.classList.add('active');
  if (step.dataset.stage === 'create') els.studioPrompt.focus();
  if (step.dataset.stage === 'edit') els.studioTracks?.scrollIntoView({ block: 'center' });
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
