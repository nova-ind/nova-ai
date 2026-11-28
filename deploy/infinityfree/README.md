# Domain setup — `nova-ai.infinityfree.io`

Nova app Node.js server hai (`server.js` + `/api/*`), aur live version Render par chal raha hai:
**https://nova-ai-9gbh.onrender.com**

InfinityFree ke free hosting par **sirf PHP + MySQL** chalega — Node.js, npm, SSH, cron nahi,
aur API hosting ki ToS allow nahi karti. Isliye Nova ko wahan "host" nahi kar sakte; do sahi
tarike hain:

---

## Option A (recommended for `nova-ai.infinityfree.io`) — 301 redirect

Subdomain ke saamne wala app Render par hi rahega; domain uspar seedha bhej dega.

### Step 1 — InfinityFree control panel

1. https://infinityfree.com par login → **Control Panel** → apna free account (`nova-ai.infinityfree.io`).
2. **File Manager** → `htdocs` folder kholein.
3. Is folder ke andar ye 2 files upload karein:
   - `.htaccess` → 301 redirect (saare paths `/api/health` samet)
   - `index.php` → fallback (agar `.htaccess` allow na ho)

   Files yahan hain: [`deploy/infinityfree/`](.)

### Step 2 — (optional) Control panel Redirects tool

Agar `.htaccess` upload karne par hosting reject kar de, to:

**Control Panel → Redirects → Create Redirect**

| Field | Value |
| --- | --- |
| Source URL | `nova-ai.infinityfree.io/*` |
| Destination URL | `https://nova-ai-9gbh.onrender.com/*` |
| Redirect type | **Permanent (301)** |

### Step 3 — Verify

```powershell
curl.exe -I https://nova-ai.infinityfree.io/api/health
```

Expected: `HTTP/2 301` + `location: https://nova-ai-9gbh.onrender.com/api/health`

> Browser me address bar Render URL dikhayega — ye normal hai, kyunki InfinityFree sirf
> redirect kar sakta hai, app wahan host nahi ho sakti.

---

## Option B — Asli custom domain (agar apna domain khud ho, e.g. `myapp.com`)

Isme app Render par hi rehti hai, bas domain Render se attach ho jata hai (address bar same rehta hai).

1. Apne DNS provider me record banao:
   | Type | Name | Value | TTL |
   | --- | --- | --- | --- |
   | CNAME | `nova` (ya `@` for root) | `nova-ai-9gbh.onrender.com` | Auto |

   - **DNS-only** (orange cloud off) rakhein — proxy/CDN Render ke saath proxy nahi kar sakta.
   - **AAAA record mat daalein** — Render sirf IPv4 deta hai.

2. Render dashboard → apni service → **Settings → Custom Domains → Add Custom Domain**
   → `nova.myapp.com` add karein.

3. Render DNS propagate hone tak wait karein (5–60 min). Certificate (TLS) auto issue hota hai.

4. Verify:

```powershell
curl.exe -I https://nova.myapp.com/api/health
```

> `nova-ai.infinityfree.io` jaise InfinityFree ke free subdomains me nameserver/ DNS delegation
> nahi milta (sirf A record), isliye Option B un par apply nahi hota — wahan Option A hi sahi hai.

---

## Note

- Render free service cold start me ~30–60 second lag sakte hain; app andar se har 4 minute
  `/api/health` ping karti hai jisse service jaagti rehti hai.
- Cloud par Chrome/CDP profile nahi hota — ChatGPT/Arena/Bing browser-login features sirf
  local Windows app me chalte hain.
