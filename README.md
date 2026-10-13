# Manzil (manzil.bond)

NVIDIA NIM ke models ko **Claude Code** mein chalane ke liye ek Tauri 2 desktop app.

> **AI agents ke liye:** is repo mein kaam karne se pehle `CLAUDE.md`,
> `AGENT.md`, aur `SKILLS.md` padhein, aur har change ke baad `MEMORY.md`
> update karein. Ye teeno files isi maqsad ke liye hain.

Claude Code Anthropic Messages API bolta hai; NVIDIA OpenAI Chat Completions API
bolta hai. Beech mein ek proxy chalta hai jo dono directions mein translate karta
hai — **tool calling aur streaming samet**, jo Claude Code ke liye zaroori hai.

---

## Stack

| Layer | Kya |
|---|---|
| Frontend | Next.js 16 (App Router, `output: "export"`), React 19, TypeScript 7 |
| Shell | Tauri 2 (Rust) |
| Storage | SQLite via `tauri-plugin-sql` |
| Proxy | Zero-dependency Node script (built-in `http` + `fetch`) |

Next.js static export mode mein chalta hai — koi Node server nahi, koi SSR nahi.
Sab kuch client components hain jo Tauri commands `invoke` karte hain.

> **Do alag Node hain, confuse na hon:** `package.json` ka `engines.node
> >=24` **build machine** ke liye hai (jahan aap `pnpm`/Next.js chalate hain).
> App ke andar jo Node bundle hota hai (sidecar, `pnpm fetch:node` se) uski
> apni pinned version hai (`scripts/fetch-node.mjs` mein `NODE_VERSION`,
> abhi 22.14.0) — ye end user ke machine par chalti hai aur upar wali se
> koi taalluq nahi.

---

## Folder structure

```
Manzil/
├── package.json              pnpm, Node >= 24
├── next.config.ts            output: "export"  (Tauri ke liye zaroori)
├── tsconfig.json             @/* -> src/*
├── eslint.config.mjs
├── RELEASES.md                release process, signing keys setup, changelog
├── download-widget.html       manzil.bond ke liye standalone download widget
├── .github/workflows/release.yml   tag push par 4-platform build + draft release
│
├── scripts/
│   └── fetch-node.mjs        bundled Node download + stage (sidecar)
│
├── src/                      Next.js frontend
│   ├── app/
│   │   ├── layout.tsx        AppShell (sidebar + proxy context)
│   │   ├── globals.css
│   │   ├── page.tsx          /          → Server dashboard
│   │   └── settings/page.tsx /settings  → API key + model
│   │
│   ├── components/
│   │   ├── AppShell.tsx      ek hi useProxy instance poori app ke liye
│   │   ├── Sidebar.tsx
│   │   ├── Field.tsx         Field / Card / Alert
│   │   ├── ModelPicker.tsx   grouped <optgroup> dropdown
│   │   ├── LogConsole.tsx    live logs, level filter, auto-scroll
│   │   ├── StatusPill.tsx
│   │   └── EnvSnippet.tsx    Claude Code env + copy
│   │
│   ├── hooks/
│   │   ├── useSettings.ts    SQLite load/save
│   │   ├── useProxy.ts       start/stop + batched log stream
│   │
│   └── lib/
│       ├── types.ts          Rust structs ke mirrors
│       ├── db.ts             SQLite data layer (Tauri guard ke saath)
│       ├── tauri.ts          typed invoke/listen wrappers (Tauri guard ke saath)
│       ├── models.ts         hardcoded 20-model catalog + grouping
│       └── theme.ts          10 accent themes + light/dark/system
│
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json        externalBin: binaries/node (sidecar)
    ├── capabilities/default.json
    ├── icons/                 ← code se generate kiye (README dekhein)
    ├── binaries/              ← `pnpm fetch:node` se banta hai, git mein nahi
    ├── resources/proxy.js     zero-dep Node proxy (binary ke andar embed)
    └── src/
        ├── main.rs            plugins, SQLite migrations, entry point
        ├── config.rs          SAB HARDCODED VALUES YAHAN
        ├── proxy.rs           sidecar/system Node spawn + log piping
```

---

## Configurable vs hardcoded

Ye cheezein UI se badalti hain aur SQLite mein save hoti hain:

1. NVIDIA API key
2. Model (aur optional small/background model)
3. Port (default **3456** — `src-tauri/src/config.rs` ka `DEFAULT_PORT`;
   koi save na ho to yahi use hota hai)

Baaki sab `src-tauri/src/config.rs` mein hardcoded hai — upstream URL, max
tokens, reasoning effort, temperature, force-model, debug. Badalna ho to
wahan badal kar rebuild karein. Server page par ye sab read-only dikhta hai.

`node_path` bhi save hota hai, lekin normally khali rehta hai — bundled Node
(sidecar) khud kaam kar leta hai, aur Settings page ka "Node runtime" card
khud batata hai ke bundled Node mila ya nahi (`bundled_node_info` command,
platform ke hisaab se expected filename compute karta hai). Ye field sirf
tab bharein jab koi specific/alag Node version use karni ho.

---

## Theme, tray aur right-click

- **Themes:** Settings → "Color theme" mein 10 accent colors (green, blue,
  indigo, purple, pink, red, orange, yellow, teal, cyan). Sidebar ke neeche
  (status line ke upar) **Light / Dark / System** toggle hai — System OS ki
  setting ko live follow karta hai. Dono SQLite mein save hote hain
  (`theme`, `color_mode` keys). Sab colors `globals.css` ke CSS variables
  mein hain — naya theme = ek `:root[data-theme="..."]` line + `theme.ts` mein
  entry.
- **Tray:** window ka X dabane se app quit nahi hoti — tray mein chali jati
  hai aur proxy background mein chalta rehta hai. Tray icon par left-click =
  window wapas, right-click = menu (Show / Quit). Sirf tray ke **Quit** se
  asal exit hota hai (proxy bhi tab band hota hai). Menu ke labels selected
  language mein hote hain — Rust side `src/locales/*.json` ko compile-time
  embed karta hai aur frontend locale badalte hi `set_tray_locale` command
  call karta hai, to tray bhi turant badal jata hai.
- **Window show / single-instance:** normal launch par window Rust ke
  `setup()` se turant dikhti hai (JS load hone ka intezar nahi). App
  dobara kholne par (icon/shortcut) nayi copy nahi chalti — pehli wali ki
  window saamne aati hai (`tauri-plugin-single-instance`).
- **Launch at startup:** Settings → "Startup" checkbox
  (`tauri-plugin-autostart`). System boot par app `--hidden` arg ke saath
  chalti hai aur seedha tray mein jaati hai; manual launch par window
  dikhti hai. Checkbox ki state SQLite se nahi, asal OS se padhi jati hai.
- **Right-click menu:** browser ka default menu (Back/Refresh/Inspect...)
  band hai; uski jagah app ke pages ke links dikhte hain (aur text selected ho
  to Copy). Input fields mein native Cut/Copy/Paste menu barqarar hai.

---

## About aur Donate pages

- **`/about`** — app version (`Cargo.toml` se), homepage link, aur **real
  auto-update** (`tauri-plugin-updater` + `tauri-plugin-process`). "Check
  for updates" → NVIDIA... nahi, GitHub Releases ka `latest.json` check
  karta hai → update mile to "Download & Install" → install ke baad
  "Restart now". Tauri ke baghair (`pnpm dev`) ye releases page browser
  mein khol deta hai, kyunki updater plugin sirf real app ke andar kaam
  karta hai. Setup (signing keys, GitHub secrets) `RELEASES.md` mein hai —
  **jab tak aap apni khud ki keys generate na karein, updater kaam nahi
  karega** (security check fail hoga, galat/kisi-aur-ki key verify nahi
  hogi).

- **`/donate`** — `src/lib/donation.ts` mein real crypto addresses aur
  links (Gumroad, Buy Me a Coffee, PayPal.me) — user ne di hui.

---

## Release karna aur download widget

Naya version release karna ho (`git tag v1.x.x` push karke) — poora process,
signing keys setup, aur changelog **`RELEASES.md`** mein hai.

`.github/workflows/release.yml` tag push par khud Windows/macOS
(Intel+Apple Silicon)/Linux build kar ke ek draft GitHub Release banata hai.
Node sidecar har platform khud fetch karta hai (`pnpm fetch:node`).

**macOS par ek jaani-boojhi kami:** is workflow mein Apple code-signing /
notarization nahi hai (iske liye Apple Developer account + certificates
chahiye, jo humein nahi diye gaye). Matlab macOS users ko Gatekeeper ka
"unidentified developer" warning milega pehli baar app kholne par — user ko
System Settings → Privacy & Security se manually allow karna padega. Ye build
ko kharab nahi karta, bas ek extra click add karta hai.

`download-widget.html` — apni website (manzil.bond) par laga sakte hain,
GitHub Releases se khud latest version detect kar ke visitor ke OS ke
hisaab se sahi download button dikhata hai (koi backend nahi chahiye).

---

## Database

App ke data dir mein `manzil.db` banti hai. Migrations `src-tauri/src/main.rs`
mein declare hain aur startup par apne aap chalti hain.

```sql
settings(key, value, updated_at)              -- api_key, model, small_model, node_path
models(id, category, agentic, fetched_at)     -- cached NVIDIA catalog
model_usage(model_id, uses, last_used)        -- recently used
```

Catalog cache ka faida: app dobara kholte hi models list maujood hoti hai, chahe
internet na ho.

**API key plain text mein hai** (SQLite file ke andar, OS file permissions ke
peeche). OS keychain chahiye to `tauri-plugin-stronghold` add karna padega.

---

## Node — bundled hai, end user ko install nahi karna

App ke andar Node ka ek portable copy bundle hota hai (Tauri "sidecar"
feature), is liye jisay bhi ye app doge usay **khud Node install karne ki
zaroorat nahi**. `proxy.js` khud bhi Rust binary ke andar compile-time par
embed hai (`include_str!`) — koi separate file resolve nahi karni padti.

Build karne se pehle **ek dafa** Node stage karna hota hai:

```bash
pnpm fetch:node
```

Ye current OS/arch ke liye Node ka official build (nodejs.org) download kar
ke `src-tauri/binaries/node-<target-triple>` par rakh deta hai — Tauri ke
sidecar naming convention ke mutabiq. `pnpm app:build` khud bhi ye chala
leta hai (`tauri.conf.json` ka `beforeBundleCommand`), is liye normally
manually chalane ki zaroorat nahi — lekin agar network na ho build machine
par, pehle se chala kar rakh sakte hain.

**Dev mode (`pnpm app:dev`) sidecar ke baghair bhi chalta hai** — agar
`fetch:node` nahi chalaya to app system PATH ke `node` par fallback kar leta
hai (Node 20+ machine par hona chahiye). Settings page par "Check" button se
confirm kar sakte hain.

Script ka target **build target se** chunta hai, host machine se nahi:
`--target <triple>` arg, ya `TARGET_TRIPLE` env, ya (Tauri ke hooks mein)
`TAURI_ENV_TARGET_TRIPLE`; kuch na diya ho to host machine. Is se Apple Silicon
Mac par Intel build ho sakti hai: `TARGET_TRIPLE=x86_64-apple-darwin pnpm
fetch:node` (GitHub Actions mein `release.yml` matrix target yahi pass karta
hai). Windows -> Mac jaisi asli cross-compilation support nahi hoti. Naya
platform add karna ho to `scripts/fetch-node.mjs` ke `PLATFORM_MAP` mein entry
add karein.

---

## Setup

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Tauri system deps — apne OS ke liye https://tauri.app/start/prerequisites/
# Ubuntu/Debian:
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Project
pnpm install
pnpm app:icon ./logo.png      # ZAROORI — koi bhi square PNG 512px+
pnpm fetch:node               # Node stage karo (end-user distribution ke liye)

pnpm app:dev                  # development (sidecar na ho to system Node use hoga)
pnpm app:build                # installer (dmg / msi / AppImage / deb) — Node bundled hoga
```

---

## Istemal

1. **Settings** → API key daalein ([build.nvidia.com](https://build.nvidia.com) →
   Account → API Keys)
2. Dropdown se model chunein (20 verified models, sab hardcoded) → **Save**
4. **Server** → Start proxy
5. Snippet copy karein, terminal mein paste karein, `claude` chalayein

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_AUTH_TOKEN="local"
export ANTHROPIC_API_KEY=""
export API_TIMEOUT_MS=600000
claude
```

Permanent karne ke liye `~/.claude/settings.json` ke `env` block mein daal dein.

---

## Model chunna — asli rule

Model ko **function / tool calling** support karni chahiye. Ye optional nahi
hai: Claude Code ka har kaam — file read, file edit, bash — ek tool call hai.
Tool calling ke baghair model sirf baatein karega, kuch karega nahi.

**Model list ab hardcoded hai — koi live NVIDIA fetch nahi.** `src/lib/models.ts`
mein exactly 20 models hain, har ek NVIDIA ke apne code example se verify hua
(`proxy.js` ke `MODEL_OVERRIDES` se 1:1 match). Har model ka `agentic` flag
haath se set hai (koi pattern-matching heuristic nahi):

- **Recommended for Claude Code** — kimi-k3, deepseek-v4.1-flash, glm-5.3,
  glm-5.3-flash, nemotron-3-super/ultra/3.5-lightning/nano-omni, gpt-oss-20b,
  poolside laguna-xs-2.1
- **Text / General, Vision, Safety** — mistral-nemotron, muse-glimmer,
  gemma-4-31b-it, llama-3.2 vision, diffusiongemma, ising-calibration, aur
  3 safety classifiers (llama-guard, nemotron safety-guard, content-safety) —
  ye Claude Code ke agentic kaam ke liye nahi hain

`google/paligemma` aur `nvidia/kumo-relational` jaan-boojh kar list mein nahi
hain — dono `/v1/chat/completions` use hi nahi karte, is proxy se kaam nahi
karte.

Naya model add karna ho: `SKILLS.md` mein "Naya model add karna" dekhein.

---

## Proxy kya translate karta hai

**Anthropic → OpenAI**

- `system` (string ya blocks array, `cache_control` samet) → `system` message
- `tool_use` blocks → `tool_calls`
- `tool_result` blocks → `role: "tool"` messages, sahi order mein
- `image` blocks (base64/url) → `image_url` parts
- `tools[].input_schema` → `function.parameters`; `$schema` aur
  `additionalProperties` strip (NVIDIA inhe reject karta hai)
- Anthropic ke server-side tools (`web_search_*`) drop
- `thinking` blocks drop
- `max_tokens` clamp

**OpenAI → Anthropic**

- `tool_calls` → `tool_use` blocks + `stop_reason: "tool_use"`
- `finish_reason` → `stop_reason`
- Streaming: `message_start` → `content_block_start/delta/stop` →
  `message_delta` → `message_stop`, har 15s par `ping`

Text live stream hota hai. Tool arguments buffer hote hain aur end par ek
complete block ki tarah bheje jate hain — kuch models tool-call JSON ko tootay
hue tareeke se chunk karte hain. Parse fail ho to `{}` jaata hai aur `WARN` log
hota hai, taake Claude Code crash na ho.

### Per-model overrides (reasoning / safety-classifier extras)

NVIDIA ke kuch models "thinking mode" ya features enable karne ke liye
non-standard request fields maangte hain — koi ek standard convention nahi
hai. Aur jo models top-level `reasoning_effort` samajhte bhi hain, sab ek
shared enum accept nahi karte — kimi-k3 sirf `low`/`high`/`max` accept karta
hai (`medium` bhejne par NVIDIA `400` deta hai, production mein confirm hua
hai), deepseek ke example mein `high` hai. Koi universal scale nahi hai jise
assume kiya ja sake.

`proxy.js` ke `MODEL_OVERRIDES` object mein 20 models catalogued hain:

- **7 models** ko non-standard shape chahiye (`chat_template_kwargs`,
  `reasoning_budget`, ya dono) — `nemotron-3.5-lightning`, `nemotron-3-ultra`,
  `nemotron-3-nano-omni-reasoning`, `nemotron-3.5-content-safety`,
  `diffusiongemma-26b`, `deepseek-v4-flash`, aur `kimi-k3` (top-level).
- **12 models** reasoning support hi nahi karte (`mode: "none"`) — inhe
  koi reasoning field milta hi nahi, chahe global setting kuch bhi ho
  (`mistral-nemotron`, `glm-5.3`, `gpt-oss-20b`, vision models, guard
  models, etc.)

In 20 models ki reasoning_effort value **hardcoded/fixed hai** — bilkul wahi
jo NVIDIA ke apne working example mein thi (`reasoningEffortValue: "max"`
kimi-k3 ke liye, `"high"` deepseek ke liye, waghera). Global
`REASONING_EFFORT` (config.rs) in models tak pahunchti hi nahi — na cap,
na koi scale-comparison, kuch bhi nahi. Global setting sirf **uncatalogued
(naye) models** ke liye matter karti hai, jahan hamare paas model-specific
verified value nahi hai (purana default: top-level `reasoning_effort` =
global value).

Naya model isi tarah ka hona to `MODEL_OVERRIDES` mein entry add karein
(dekhein `SKILLS.md`) — **NVIDIA ke apne example se exact value lein, kisi
doosre model se guess na karein** (kimi-k3 wala bug isi guess se aaya tha).
Translation logic (`anthropicToOpenAI`) chhedne ki zaroorat nahi.

Proxy alag se bhi chal sakta hai (`proxy.js` source `src-tauri/resources/proxy.js`
mein hai — app runtime par isay temp file mein copy kar ke bundled ya system
Node se chalata hai):

```bash
UPSTREAM_API_KEY=nvapi-xxx DEFAULT_MODEL=moonshotai/kimi-k3 \
  node src-tauri/resources/proxy.js
```

---

## Zabaan (i18n)

UI 5 zabaanon mein available hai: English, اردو, Deutsch, العربية, हिन्दी
(`src/locales/{en,ur,de,ar,hi}.json`). Settings page se select karte hi
**foran active** ho jati hai aur SQLite mein save ho jati hai (`settings`
table ka `locale` key) — agli baar app khulte hi wahi language load hogi.
Urdu aur Arabic RTL (right-to-left) mein render hoti hain
(`<html dir="rtl">` automatically set hota hai).

Naya UI text ya nayi language add karne ka tareeqa `SKILLS.md` mein hai.
Har locale file mein bilkul same keys honi chahiye — `en.json` source of
truth hai.

---

## Troubleshooting

| Problem | Dekhein |
|---|---|
| `node start nahi hua` (system fallback) | `pnpm fetch:node` chalayein taake bundled Node use ho, ya Node 20+ install karein, ya Settings → Browse se path dein |
| Sidecar spawn error / permission | `src-tauri/capabilities/default.json` mein `shell:allow-execute` ka `binaries/node` entry check karein — https://tauri.app/develop/sidecar/ |
| Port already in use | `config.rs` mein `PORT` badal kar rebuild |
| Claude Code se `401` | `ANTHROPIC_API_KEY=""` set karna bhool gaye |
| NVIDIA se `400` | `config.rs` mein `DEBUG_LOGS = true` kar ke rebuild; payload log hoga |
| Tools use nahi ho rahe | Logs mein `tools=N` dekhein. `tools=0` = Claude Code bhej hi nahi raha; `N>0` aur phir bhi kuch nahi = model tool calling support nahi karta |
| Tool args tootay hue | Kuch models par normal. Proxy `{}` bhejta hai aur `WARN` deta hai. Doosra model try karein |
| Catalog refresh 401 | API key ghalat ya expire |
| `fetch-node.mjs` fail (`tar` error) | Windows par sirf 1803+ mein built-in `tar` hota hai. Manually archive extract kar ke `node.exe` ko `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe` par rakh dein |
