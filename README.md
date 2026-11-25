# Nova — Grok-jaisa AI Chat App

Nova ek minimal, Grok-style **AI agent** hai: streaming replies, web search with sources,
reasoning (Think), image generation (Imagine), fun mode, aur — sabse upar — **Agent mode** jo
khud plan karke web search, file read/write, code execution aur image tools use karke kaam poora karta hai.

Backend **zero-dependency** Node.js hai — koi `npm install` nahi chahiye.

---

## 1. Chalane ka tarika

```powershell
cd "G:\Nova Bot"
copy .env.example .env      # phir .env me apni key daalo
npm start
```

Phir browser me kholo: **http://localhost:4173**

> Node 20.6+ chahiye (aapke system par v26 hai).

### Windows desktop installer (offline EXE)

Professional per-user installer ready hai: **`dist/Nova-AI-Setup-v1.0.0.exe`**.
Ek hi EXE me Nova app, zero-dependency Node runtime aur **wahi logo** (white rounded square + black N) hai jo website par hai. Install ke time kuch download nahi hota.

- Default install location: `%LOCALAPPDATA%\Nova AI` (admin/UAC nahi chahiye).
- Start menu + optional desktop shortcut, tray icon, Open / Restart / Exit controls.
- Launcher apne andar local server start karta hai aur poori Nova UI **embedded WebView2 app window** me dikhata hai — Chrome alag se nahi khulta. “Browser” button se kabhi bhi system browser me khol sakte hain.
- WebView2 runtime offline installer ke andar hai; purane PC par missing ho to setup khud silently install kar deta hai.
- Title bar ka **“Bing Login”** button ek baar Microsoft sign-in tab kholta hai. Login cookies `%LOCALAPPDATA%\Nova AI\workspace\.browser-profile` me persist hote hain, isliye baar baar login nahi karna padta.
- Port 4173 busy ho to launcher apne aap free port pick kar leta hai.
- Sidebar ke niche **folder icon** se coding folder chuno — native Windows folder dialog khulta hai. Chat/Agent usi folder me code likh sakta hai (Bots panel se multiple folders allow kar sakte hain).
- Composer me **scissors icon** se free FFmpeg editor khulta hai: trim, merge, compress, mute, add audio, extract MP3, resize, convert. FFmpeg/ffprobe installer ke andar offline bundled hain.
- Data/log: `%LOCALAPPDATA%\Nova AI\workspace\desktop-launcher.log`.
- Chat API ke liye internet + API key chahiye; image tools ke liye Chrome/Edge recommended hain.

Installer dobara banane ke liye:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "G:\Nova Bot\installer\build.ps1"
```

### Live app: Render (free) + auto crawler

GitHub Pages sirf static landing page dikhata hai; **poori Nova app wahan nahi chal sakti** kyunki usko `server.js` aur `/api/*` chahiye.
App ko online chalane ka free tarika:

1. Ye repo GitHub par push karein (`.env` aur `workspace/` hargiz nahi).
2. https://dashboard.render.com → **New + → Web Service** → repo select karein.
3. `render.yaml` automatically detect ho jayega, ya manually:
   - **Build Command:** `npm install --no-audit --no-fund`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Plan:** Free
4. Render dashboard me **Environment** me apni keys daalein (optional — har visitor apni key Settings me bhi daal sakta hai).
5. App apne andar se har 4 minute par `/api/health` ping karti hai (Render detected hone par) — free service sleep nahi karti. Koi GitHub token/workflow chahiye nahi. Extra safety ke liye **UptimeRobot** ya **cron-job.org** se bhi har 5 minute par GET kar sakte ho:

```text
https://nova-ai-9gbh.onrender.com/api/health
```

> Render par Chrome/CDP browser profile nahi hota. Isliye `browser_open`, Bing Image Creator UI, Gmail/YouTube login jaise tools wahan kaam nahi karenge. Chat, web search, browser-side Hugging Face Flux images aur LTX video chalenge; Cloudflare Flux tab token ho to chalega. Pollinations intentionally disabled hai. In sab tools ke saath poori app chahiye to PC par `npm start` + Cloudflare Tunnel/ngrok use karein.

### GitHub Pages (sirf static landing page, optional)

Agar browsing ke liye ek simple project page chahiye: **Settings → Pages → Deploy from a branch → main → /docs**.
Ye sirf marketing/landing page hai; actual app ka live URL Render ka hoga.

### API key kahan se milegi (free)

1. https://build.nvidia.com par jao
2. Koi bhi model kholo → **Get API Key** (free credits milte hain)
3. `nvapi-...` key copy karo
4. `.env` me `NVIDIA_API_KEY=nvapi-...` daalo **ya** app ke Settings me paste karo

`.env`:
```env
NVIDIA_API_KEY=nvapi-xxxxxxxx
UPSTREAM_BASE_URL=https://integrate.api.nvidia.com/v1
DEFAULT_MODEL=minimaxai/minimax-m3.1-flash
PORT=4173
```

OpenRouter / Groq / Ollama bhi chalega — bas `UPSTREAM_BASE_URL` badal do
(misaal: `http://localhost:11434/v1` Ollama ke liye).

### Cloudflare Workers AI API token kaise banayein (free image generation ke liye)

1. https://dash.cloudflare.com par login karein.
2. Left menu me **AI → Workers AI** kholein, phir **Use REST API** chunein.
3. **Create a Workers AI API Token** par click karein → pre-filled details check karein → **Create API Token** → token copy karein. (Agar custom token bana rahe hain to usme `Account → Workers AI → Read` aur `Edit` dono permissions honi chahiye.)
4. Ussi page par **Account ID** (32-character string) copy karein. Account ID dashboard ke right sidebar me bhi milta hai.
5. Nova app me **Settings → Cloudflare Account ID** aur **Cloudflare API token** me dono paste karein → **Save settings**.
6. Image provider `Cloudflare Flux` ya `Auto` chunein. Free plan roz 10,000 neurons deta hai — Flux images ke liye kaafi.

> Global API key (`X-Auth-Key`) mat use karein. Nova ko sirf Workers AI API token + Account ID chahiye. Token sirf ek baar dikhayi deta hai — usako kahin safe save karein.

---

## 2. Features (Grok jaise)

| Feature | Kaise |
| --- | --- |
| **Auto / Fast / Expert / Heavy** tiers | Composer ke right me model pill (valid, current NVIDIA models) |
| **Live model list** | Settings → *Available models* — aapki key se 32 models automatically load hote hain, search + click to select |
| **Provider switch** | Settings → Provider: NVIDIA, MiniMax, OpenRouter, Groq, Ollama. **Har provider ki apni API key aur apna model alag save hota hai** — switch karte hi wahi key/model load hota hai |
| **Agent mode (default on)** | ⚡ button — khud plan banata hai, tools chalata hai, file/report banakar deta hai; chat me live tool-trace dikhta hai |
| **Top free model switch** | Composer ke model dropdown me “Top free models” list — click karte hi model change |
| **Schedule work** | 📅 button — master prompt + date/time; YouTube template pehle publish date/time puchta hai, metadata package + OAuth upload script banata hai |
| **Multiple bots** | 🤖 button — kai bots banao, har ka apna master prompt + allowed folder; “Run all bots” ek click me sab chalata hai |
| **Allowed folders / coding folder** | Sidebar folder button ya Bots panel se native picker se folder chuno; bot aur chat agent sirf unhi folders me file operations karte hain |
| **Free FFmpeg editor** | Trim/cut, merge, compress, mute, add/replace audio, extract MP3, resize aur convert — sab local, offline, bina kisi paid service ke |
| **Agent tools** | `web_search`, `list_files`, `read_file`, `write_file`, `create_folder`, `delete_file`, `copy_file`, `move_file`, `run_code`, `generate_image`, `open_webpage`, `browser_open`, `browser_wait`, `browser_click`, `browser_type`, `browser_text`, `browser_screenshot` |
| **Workspace files** | Agent ne banayi files `G:\Nova Bot\workspace` me save hoti hain aur chat se `/workspace/...` link se khulti hain |
| **Think** | Extended reasoning toggle; reasoning models par live "Thinking" panel |
| **Search (DeepSearch)** | Real web search + neeche numbered sources |
| **Imagine** | In-chat image generation — Bing Image Creator (best free), Cloudflare Flux, Hugging Face Flux. Pollinations disabled |
| **Video Studio (next level)** | 15 minute tak long-form video, 20/30/50/60 scenes, zoom/pan FX + xfade transitions, song BPM/energy-zone analysis, lyrics-aligned captions, offline SAPI voice-over aur FFmpeg final assembly. Chhote videos me optional LTX AI motion clips. |
| **Free video model** | LTX-Video (open-source, GitHub/Hugging Face Space) — bina card/key ke short clips |
| **Fun** | Grok jaisa witty/sarcastic personality |
| Chat history | Sidebar me Today / Yesterday / Previous 7 days, search box ke saath (sidebar collapse hone par bhi search/toggle topbar me reachable) |
| Attachments | `+` button — images (vision models) aur text/code files |
| Voice input | Mic icon (Chrome/Edge me Web Speech API) |
| Markdown | Code blocks + copy, tables, lists, links |
| Feedback | Copy, Regenerate, 👍/👎 |
| Shortcuts | `Enter` send, `Shift+Enter` newline, `Ctrl+K` search chats, `Ctrl+Shift+O` new chat, `/` focus composer |

---

## 3. Structure

```
G:\Nova Bot
├─ server.js          # Node HTTP server, SSE proxy, search, free media providers, media jobs, agent loop
├─ workspace/         # Agent ki banayi files yahin save hoti hain
├─ public/
│  ├─ index.html      # app shell
│  ├─ styles.css      # Grok-style dark UI
│  └─ app.js          # state, streaming, markdown, attachments, voice
├─ .env.example
└─ package.json
```

## 4. Notes

- API key browser ke localStorage me rehti hai. Server env keys (`NVIDIA_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MINIMAX_API_KEY`) bhi chalte hain — Render Dashboard me key daalte hi app us provider par auto-switch ho jata hai aur model list aa jati hai. Browser key na ho to env key use hoti hai.
- Purane `meta/llama-3.3-70b-instruct` jaise IDs NVIDIA par EOL ho chuke hain (410). App ab current IDs use karta hai: `minimaxai/minimax-m3.1-flash`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `google/gemma-4-31b-it`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.
- Live model list `/api/models` se aati hai — browser key ya Render env key + base URL Settings me ho to list auto-refresh hoti hai.
- Web search free Bing HTML + Wikipedia fallback use karta hai — kabhi kabhi provider block kar sakta hai.
- **Imagine / image provider:** Default `auto` hai — local PC par pehle **Bing Image Creator** (free, best quality; Chrome/Edge + Microsoft sign-in recommended), phir **Cloudflare Flux**, phir **Hugging Face Flux**. Live site par auto seedhe browser se **HF Flux ZeroGPU Space** use karta hai (token browser localStorage se), fallback server providers par hai. Image ratio 16:9 / 1:1 / 9:16 Settings me chun sakte hain. **Pollinations kabhi use nahi hota**. Bing official API nahi hai; app existing CDP browser profile me Bing UI automate karta hai.
- **Video provider:** Default **LTX-Video** hai — open-source model GitHub/Hugging Face Space par free chalta hai, koi key/card nahi. Optional free HF token queue badhata hai. Direct video mode aur Video Studio dono LTX use karte hain.
- **Cloudflare free tier:** Account ID + Workers AI API token Settings ya `.env` me daalo. Flux models: `flux-1-schnell` (sasta/tezz), `flux-2-klein-4b`, `flux-2-klein-9b`, `flux-2-dev` (better quality, zyada neurons). 10,000 neurons/day free hain.
- **Hugging Face free tier:** Free HF token optional hai — `FLUX.1-schnell` ZeroGPU Space se image banti hai. Free account ko ~5 min/day **ya 8 runs/day** quota milta hai; app pehle `/api/spaces/zero-gpu/quota` check karke exact reset time batati hai aur quota khatam hone par bar-bar retry nahi karti. Token browser localStorage (aur server memory) me rehta hai. Bina token public 2 min/day pool milega.
- Browser profile (`workspace/.browser-profile`) me Microsoft account se sign-in kar lo to Bing ke free creations zyada milte hain aur captcha/guest limit se bachav hota hai.
- Search bar chhote screen par topbar se open hota hai (`Ctrl+K`); sidebar collapse hone par bhi toggle/search button topbar me rehta hai. `Esc` search clear karta hai ya mobile sidebar band karta hai.
- Agent mode default ON hai. Simple chat chahiye to ⚡ Agent button band kar do.
- Scheduled tasks aur bots **unattended** chalte hain, isliye unki API key `workspace/schedules.json` me local save hoti hai. Ye file share na karein.
- **Browser automation** bina `npm install` ke chaltti hai — server Chrome/Edge ko CDP (port 9222) se kholta hai. **Settings → “Open login tabs in Chrome”** dabao: Bing/Microsoft aur Google login tabs khulenge; ek baar sign-in karo, cookies `workspace/.browser-profile` me save ho jate hain aur server restart ke baad bhi login rehta hai. Agent `browser_open`, `browser_click`, `browser_type`, `browser_text` se kaam karta hai. Login apne normal Chrome me mat karo — automation usi dedicated profile ka Chrome use karti hai.
- Live site par image generation ke liye sabse aasan raasta: Settings → **“Enable free images”** → Puter par Google/Microsoft/Apple ya email se free account bana lein. Iske baad Auto mode live par Puter se image banata hai — HF quota aur Bing captcha dono se bachat. API key nahi chahiye; session browser me saved rehta hai.
- Local Windows PC par Bing Image Creator alag **headless Chrome** (`workspace/.bing-headless-profile`, port `9223`) me chaltta hai — Bing ka page screen par kabhi nahi dikhta. Login cookies hidden reader (port `9224`) se asli Chrome profile se automatic padhe jate hain; visible Chrome kholne ki zarurat nahi. Settings → **“Sync Bing login to live site”** ek saath (1) Bing cookie, (2) hidden browser me login cookies aur (3) local PC image worker ko live server par connect karta hai. Live par auto image request aapke PC ke hidden Bing par banti hai; Bing ek baar me jo 4 images deta hai, sab live app me grid me dikh jati hain (har image ke Open/Download + poore message ka Copy/Delete). PC aur local Nova server chalte rehne chahiye. Deploy/restart ke baad button dobara dabayein (ya Render env me `BING_AUTH_COOKIE` + `NOVA_WORKER_TOKEN` set karein).
- Stale `SingletonLock`/`SingletonCookie` files launch se pehle auto-hata di jaati hain, isliye browser crash ke baad bhi wahi profile dobara khulta hai aur login dobara nahi mangta.
- Email ke liye isi profile me pehle se login hona chahiye; agent khud password nahi maangta aur na hi store karta hai. YouTube upload ke liye OAuth setup abhi bhi manually ek baar karna hota hai (agent script bana deta hai).
- Bots ke liye **chhota, step-by-step master prompt** best chaltta hai (browser_open → browser_wait → browser_text → browser_click). Bahut lamba prompt agent ko 16-step limit tak le ja sakta hai.
- Agar server restart ke dauran koi bot run adhoora reh jaye aur “Run now” kuch na kare, to server ko ek baar restart karo — andaroka `runningJobs` lock clear ho jayega.
- Agent tool-calling support na hone par app automatically XML tool-call fallback use karta hai.
- Code execution workspace folder ke andar limited hai; timeout 20 seconds hai.
- Core app poori tarah local hai. Free providers me se Bing ke liye browser profile me Microsoft login recommended hai; Cloudflare/HF ke optional free tokens browser localStorage me rehte hain (server sirf memory me rakhta hai).

---

## 5. Grok app se comparison

Grok ka apna APK/EXE aapke paas nahi tha, is liye maine Grok ke live web interface
(grok.com) ke documented layout ko follow kiya: minimal composer, Auto/Fast/Expert/Heavy
model ladder, Think + DeepSearch + Imagine modes, sources, sidebar history + search,
message actions (copy/regenerate/rate), aur attachments.
