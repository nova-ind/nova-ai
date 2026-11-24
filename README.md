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

### GitHub Pages (optional landing site)

Repo push karne ke baad GitHub par **Settings → Pages → Build and deployment → Deploy from a branch → main → /docs** chuno.
`docs/index.html` ek static project landing page hai. Poori app GitHub Pages par nahi chal sakti (uske liye `server.js`/APIs chahiye);
live app ke liye clone karke local ya kisi Node host par `npm start` chalao.

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
| **Allowed folders** | Bots panel me absolute path allow karo; bot sirf unhi folders me file operations karega |
| **Agent tools** | `web_search`, `list_files`, `read_file`, `write_file`, `create_folder`, `delete_file`, `copy_file`, `move_file`, `run_code`, `generate_image`, `open_webpage`, `browser_open`, `browser_wait`, `browser_click`, `browser_type`, `browser_text`, `browser_screenshot` |
| **Workspace files** | Agent ne banayi files `G:\Nova Bot\workspace` me save hoti hain aur chat se `/workspace/...` link se khulti hain |
| **Think** | Extended reasoning toggle; reasoning models par live "Thinking" panel |
| **Search (DeepSearch)** | Real web search + neeche numbered sources |
| **Imagine** | In-chat image generation — Bing Image Creator (best free), Cloudflare Flux, Pollinations fallback |
| **Video Studio** | Story/cartoon/meme/song videos: 16:9 ya 9:16, style/FX/transitions auto-infer, MP3 upload, scene images + AI motion clips, browser me final render |
| **Free video model** | LTX-Video (open-source, GitHub/Hugging Face Space) — bina card/key ke short clips; Pollinations optional fallback |
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

- API key browser ke localStorage me rehti hai (server key `.env` me safe rehti hai). Permanent rakhne ke liye key ko `.env` me bhi daal do.
- Purane `meta/llama-3.3-70b-instruct` jaise IDs NVIDIA par EOL ho chuke hain (410). App ab current IDs use karta hai: `minimaxai/minimax-m3.1-flash`, `nvidia/nemotron-3.5-lightning-30b-a3b`, `google/gemma-4-31b-it`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.
- Live model list `/api/models` se aati hai — key + base URL Settings me ho to list auto-refresh hoti hai.
- Web search free Bing HTML + Wikipedia fallback use karta hai — kabhi kabhi provider block kar sakta hai.
- **Imagine / image provider:** Default `auto` hai — pehle **Bing Image Creator** (free, best quality; Chrome/Edge + Microsoft sign-in recommended for full credits), phir **Cloudflare Flux** (free 10k neurons/day; free token zaroori), phir **Pollinations** fallback. Bing official API nahi hai; app existing CDP browser profile me Bing UI automate karta hai. Settings me provider manually bhi chun sakte hain.
- **Video provider:** Default **LTX-Video** hai — open-source model GitHub/Hugging Face Space par free chalta hai, koi key/card nahi. Optional free HF token queue badhata hai. Pollinations video tabhi chalega jab free media key Settings me ho. Direct video mode aur Video Studio dono provider choose karte hain.
- **Cloudflare free tier:** Account ID + Workers AI API token Settings ya `.env` me daalo. Flux models: `flux-1-schnell` (sasta/tezz), `flux-2-klein-4b`, `flux-2-klein-9b`, `flux-2-dev` (better quality, zyada neurons). 10,000 neurons/day free hain.
- Browser profile (`workspace/.browser-profile`) me Microsoft account se sign-in kar lo to Bing ke free creations zyada milte hain aur captcha/guest limit se bachav hota hai.
- Search bar chhote screen par topbar se open hota hai (`Ctrl+K`); sidebar collapse hone par bhi toggle/search button topbar me rehta hai. `Esc` search clear karta hai ya mobile sidebar band karta hai.
- Agent mode default ON hai. Simple chat chahiye to ⚡ Agent button band kar do.
- Scheduled tasks aur bots **unattended** chalte hain, isliye unki API key `workspace/schedules.json` me local save hoti hai. Ye file share na karein.
- **Browser automation** bina `npm install` ke chaltti hai — server Chrome/Edge ko CDP (port 9222) se kholta hai. Akbar first run par wo browser window khul sakta hai; usme Gmail/Outlook ya koi bhi site login karke rakho (`workspace/.browser-profile`). Uske baad agent `browser_open`, `browser_click`, `browser_type`, `browser_text` se email padh/likh sakta hai, forms bhar sakta hai, kisi bhi webpage par kaam kar sakta hai.
- Email ke liye browser profile me pehle se login hona chahiye; agent khud password nahi maangta aur na hi store karta hai. YouTube upload ke liye OAuth setup abhi bhi manually ek baar karna hota hai (agent script bana deta hai).
- Bots ke liye **chhota, step-by-step master prompt** best chaltta hai (browser_open → browser_wait → browser_text → browser_click). Bahut lamba prompt agent ko 16-step limit tak le ja sakta hai.
- Agar server restart ke dauran koi bot run adhoora reh jaye aur “Run now” kuch na kare, to server ko ek baar restart karo — andaroka `runningJobs` lock clear ho jayega.
- Agent tool-calling support na hone par app automatically XML tool-call fallback use karta hai.
- Code execution workspace folder ke andar limited hai; timeout 20 seconds hai.
- Core app poori tarah local hai. Free providers me se Bing ke liye browser profile me Microsoft login recommended hai; Cloudflare/HF/Pollinations ke optional free tokens browser localStorage me rehte hain (server sirf memory me rakhta hai).

---

## 5. Grok app se comparison

Grok ka apna APK/EXE aapke paas nahi tha, is liye maine Grok ke live web interface
(grok.com) ke documented layout ko follow kiya: minimal composer, Auto/Fast/Expert/Heavy
model ladder, Think + DeepSearch + Imagine modes, sources, sidebar history + search,
message actions (copy/regenerate/rate), aur attachments.
