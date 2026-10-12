# MEMORY.md

Ye is project ki running memory hai. **Claude Code (ya koi bhi AI agent) is
repo mein kaam karte waqt har cheez banane/badalne/faisla lene ke baad yahan
turant likhta hai** — `CLAUDE.md` ka mandatory rule hai. Kaam khatam hone ka
intezaar mat karo, har step ke baad likho.

Format: naya entry hamesha sab se **upar** (reverse-chronological), dated,
chhote bullets. Poore paragraphs nahi.

---

## 2026-10-12 — v1.0.3: GitHub Actions ki teeno platform failures

User ne CI ke 4 screenshots bheje (macOS x2, Ubuntu, Windows) — teen alag
asal wajahein nikli, teeno fix:

- **macOS (aarch64 + x86_64) — `tsc` fail:** `Sidebar.tsx:62`
  `COLOR_MODES[(i+1) % len]` ka type `ColorMode | undefined` tha
  (`tsconfig` mein `noUncheckedIndexedAccess: true`). `?? "dark"` fallback.
  CI log mein "Found 1 error" tha, baaki index accesses scan kiye — sab typed
  keys hain, theek. **Meri pichli galti:** mere checks sirf
  `ts.transpileModule` (syntax) the, real type-check nahi — isi liye ye
  nikal gaya. Sandbox mein deps na hone se `tsc --noEmit` nahi chala sakta.
- **Ubuntu — `apt-get install` fail:** `libappindicator3-dev` aur
  `libayatana-appindicator3-dev` conflict karte hain. Pehle wala hata diya
  (Tauri 2 ayatana use karta hai).
- **Windows — `fetch-node.mjs` fail:** `EXDEV: cross-device link not
  permitted` — runner par temp `C:\` aur repo `D:\` hai, `renameSync`
  drive ke beech nahi chalta. `copyFileSync` kiya. Temp folder ka purana
  naam `zaheerai-node-fetch-` bhi `manzil-node-fetch-` kiya.
- Version 1.0.2 → **1.0.3**, `RELEASES.md` changelog add.
- **Verify nahi:** in fixes ke baad naye Rust-compile errors aa sakte hain
  (macOS/Linux/Windows teeno ab Rust build tak pahunchenge — pehli baar
  `tray.rs` / single-instance / autostart actual compiler se guzrenge).

---

## 2026-10-05 — v1.0.2: sidebar layout fix, tray i18n, window-show bug, single-instance, autostart, .env

- **Version scheme (user ne explicitly durust kiya):** pehle maine
  galti se 1.1.0 / 1.2.0 jaisa minor jump kiya. User ka rule: **1.0.1 se
  shuru, har baar sirf patch +1** (1.0.2, 1.0.3 ...). Ab **1.0.2** hai, teeno
  jagah sync. `CLAUDE.md` rule isi hisaab se likha, `RELEASES.md` changelog
  dobara likhi (v1.0.1 pehla release, v1.0.2 ye).
- **package.json:** user ki di hui file as-is (naye deps: plugin-autostart,
  plugin-opener, dotenv-cli devDep; naye versions). `app:build` =
  `dotenv -e .env -- tauri build`. Meri taraf se sirf `version` badla.
- **Cargo.lock hata diya** (zip + repo se; `src-tauri/.gitignore` mein
  add) — user ka instruction. Wajah bhi: naye deps (autostart, opener,
  single-instance) ke baad purani lock stale thi aur sandbox mein cargo nahi
  jo regenerate kare. Trade-off: app ke liye lockfile na commit karne se CI
  builds reproducible nahi rehtin (har run par naye transitive versions).
- **identifier = `com.csofts.manzil`** (tauri.conf.json), hamesha yahi.
  **Asar:** identifier badalne se OS app-data folder badal jata hai —
  `bond.manzil.app` wale build ki saved settings naye build mein nahi milengi.
- **`.env.example`** user ki di hui reference se banayi (Windows path example
  generic `YourName` kiya). `.env` pehle se gitignored.
- **Sidebar layout (video reference se):** video mein "Jadoo" app ki
  recording thi — asli bug ye tha ke maine collapse button nav ke turant baad
  (beech mein) rakha tha. Ab: nav → spacer → `.sidebar-bottom` group
  (mode toggle → status → divider line → collapse button, sab sabse neeche).
  Collapsed mein mode toggle 1 button, status sirf dot, collapse sirf chevron.
- **Top par version + line (screenshot se):** brand row mein naam ke saath
  `v{app_version}` (monospace, muted), neeche `border-bottom` line.
  Version `runtimeInfo()` (Cargo.toml) se aata hai. Collapsed mein hidden.
- **Window-show bug ki jad:** pehle `visible: false` + JS-side
  `WindowReveal.tsx` window dikhata tha — JS mein koi bhi silent failure
  ho to window kabhi nahi dikhti thi. Ab Rust `setup()` mein seedha
  `show_main_window()` (sirf `--hidden` arg par skip — jo autostart system
  boot par deta hai). `WindowReveal.tsx` delete kiya. `ThemeProvider.ready`
  flag rakha (ab unused, comment update). Trade-off: window JS theme load
  hone se pehle dikh sakti hai (ek pal ka default-theme flash).
- **Single-instance:** `tauri-plugin-single-instance` (sabse pehla plugin) —
  doosri launch par pehli instance ki window `show_main_window` se saamne
  aati hai. Pehle doosra process chalta tha (port clash).
- **Tray i18n (user ka "sab kuch locales mein" rule):** naya
  `src-tauri/src/tray.rs` — 5 locale JSON `include_str!` se embed, `tray.show`
  / `tray.quit` keys padhta hai (English fallback), `MenuItem` handles
  `TrayState` mein, `set_tray_locale` command. `I18nProvider` initial load +
  har `setLocale` par call karta hai. Alag Rust translation table nahi.
  Tooltip "Manzil" brand name hai (translate nahi hota).
- **Autostart:** `tauri-plugin-autostart` (LaunchAgent, args `--hidden`),
  Settings mein "Startup" checkbox, state OS se (`isEnabled()`), SQLite se nahi.
- **Opener:** About/Donate ab `@tauri-apps/plugin-opener`'s `openUrl`.
  `shell:allow-open` permission hata di (least privilege); `shell:allow-execute`
  Node sidecar ke liye rakhi. `@tauri-apps/plugin-shell` JS package user ki
  package.json mein hai magar JS mein ab import nahi hota (Rust side plugin
  sidecar ke liye zaroori hai).
- **Verify NAHI kar saka (sandbox mein Rust/Windows nahi):** `tray.rs`
  (`MenuItem<Wry>` storage, `set_text`, `include_str!` path
  `../../src/locales`), single-instance closure signature, autostart
  `init(MacosLauncher, Some(vec!["--hidden"]))` signature, `opener:default`/
  `autostart:default` permission names, `--hidden` arg autostart plugin
  sach mein pass karta hai ya nahi, sidebar ka asli visual (sirf video se
  match kiya, screen par nahi dekha). Cargo.lock na hone se pehli build par
  network chahiye.

---

## 2026-10-04 — Version sync rule (standing instruction) + v1.1.0 bump

- **User ka standing instruction:** "ab se package version bhi update kar ke
  dena 3no jagah, package.json, tauri.conf.json, Cargo.toml" — ye
  `CLAUDE.md` ke Hard Constraints mein likh diya hai taake future
  sessions (Claude Code ya main) bhool na jayein.
- **Version 1.0.0 → 1.1.0 bump kiya** (teeno jagah + `Cargo.lock` ki apni
  entry): 1.0.0 ke baad se itne naye features aa chuke the (themes, tray,
  i18n, 20-model catalog + overrides, real updater, donate/about,
  sidebar collapse) ke patch (1.0.1) ki jagah minor bump zyada sahi laga.
  `RELEASES.md` mein v1.1.0 changelog entry add ki.

---

## 2026-10-03 — Real auto-update, GitHub release workflow, download widget, RELEASES.md

- **tauri.conf.json merge-fix:** user ne reference file di (Jadoo project se
  adapt ki hui) — uski JSON invalid thi (missing comma bundle/plugins ke
  beech). Fix kar ke merge kiya: `publisher`/`category`
  (`"Video"` → `"DeveloperTool"`, galat thi) /`shortDescription`/
  `longDescription`/`copyright`/`createUpdaterArtifacts: true`.
- **Real auto-update wired:** `tauri-plugin-updater` +
  `tauri-plugin-process` (Cargo.toml + main.rs + capabilities
  `updater:default`/`process:allow-restart` + package.json JS packages).
  About page poora state-machine ban gaya: checking → up-to-date /
  available (version + Download&Install) → installing → installed
  (Restart now). Tauri ke baghair `pnpm dev` mein releases page khulta hai.
  **CRITICAL: `tauri.conf.json` ka `pubkey` abhi
  `REPLACE_WITH_YOUR_OWN_GENERATED_PUBLIC_KEY` hai** — user ki uploaded
  file mein Jadoo project ki real pubkey thi, wo copy NAHI ki (kisi aur ki
  security key reuse karna galat hota — verification kabhi match nahi
  karti). User ko `pnpm tauri signer generate` khud chalana hoga
  (`RELEASES.md` mein poora process).
- **`.github/workflows/release.yml`** naya — reference `release.yml`
  (Jadoo se, ffmpeg/ffprobe sidecar fetch karta tha) se adapt kiya: ffmpeg
  wala hissa hata diya (hamare paas nahi hai), uski jagah `pnpm fetch:node`
  (hamara apna Node-sidecar script) — 4-platform matrix (win/linux/macos
  intel+arm) waisa hi rakha.
- **`download-widget.html`** naya — reference widget (Jadoo/jadoo.bond ke
  liye) ko Manzil branding + GitHub `dashingmza/manzil` ke liye adapt kiya.
  GitHub Releases API se khud latest version + OS-specific download button.
- **`RELEASES.md`** naya — signing-key setup steps, release-cutting
  process, aur v1.0.0 changelog entry.
- **Root `.gitignore`** user ki di hui file se merge kiya
  (`*.tsbuildinfo`, `Thumbs.db`, `.env*` add hue).
- **3 platforms ka honest assessment user ko diya:** Windows/macOS/Linux
  teeno par architecture-wise kaam karega (sidecar naming, tray, context
  menu, window config sab Tauri APIs se cross-platform hain, Windows-only
  manifest code properly OS-gated hai) — **lekin macOS par code-signing/
  notarization nahi hai** (Apple Developer account nahi diya gaya), is liye
  pehli baar kholne par Gatekeeper warning aayega.
- **Verify NAHI kar saka:** updater plugin ka poora flow (check/download/
  install/relaunch) — na Rust compile hua na asal GitHub release bana. Pehli
  real release ke baad hi pata chalega.

---

## 2026-09-30 — Fixed window size, custom Windows manifest, sidebar collapse, active-item accent color

- **donation.ts:** user ne trimmed list di (ab sirf 7 USDT network entries,
  BTC/BNB/ETH/USDC/TRX hata diye) — as-is replace kiya.
- **Window ab fixed-size hai:** `tauri.conf.json` — 1100x910,
  `minWidth`/`minHeight` 1000/910, `resizable: false`, `maximizable: false`,
  aur **`visible: false`** (user ki di hui config se).
- **`visible: false` ka side-effect handle kiya:** window launch par khud
  nahi dikhti — warna default (dark+green) theme flash hoti phir saved theme
  load hoti. Fix: `ThemeProvider` mein `ready` flag (dono prefs load/fail ho
  chuke) + naya `WindowReveal.tsx` (`@tauri-apps/api/window`'s
  `getCurrentWindow().show()`, `ready` hote hi ya 800ms fallback timeout par).
  **Ye Tauri window-show API ke saath compile/run karke verify nahi ho saka.**
- **Windows manifest:** user ne `windows-app-manifest.xml` di (Common-Controls
  v6 dependency — modern themed native controls ke liye). `build.rs` rewrite
  kiya: MSVC target par `MANIFEST:EMBED` linker arg se custom manifest embed,
  `tauri_build::WindowsAttributes::new_without_app_manifest()` se Tauri ka
  auto-manifest disable. Icon/version-info installer mein already
  `tauri_build::build()` khud handle karta hai (`tauri.conf.json` bundle.icon
  + `Cargo.toml` package fields se) — is liye alag se kuch nahi likha, sirf
  `Cargo.toml` mein `homepage`/`license` add kiye taake installer metadata
  poori ho. **Ye bhi Windows/MSVC par compile karke verify nahi ho saka.**
- **Sidebar active item:** ab `background: var(--accent)` +
  `color: var(--on-accent)` — icon (currentColor se) aur text dono theme ke
  accent color se contrast karte hain jaisa maanga gaya tha.
- **Sidebar collapse/expand (naya feature, pehle nahi tha):** `Sidebar.tsx`
  mein collapse button (chevron) add kiya, state `sidebar_collapsed` pref
  mein persist (generic `loadPref`/`savePref` reuse kiya, koi naya schema
  nahi). Collapsed state mein: sirf icons (labels hide), brand sirf "M" mark,
  status sirf dot. Light/Dark/System toggle collapsed mein **1 cycling
  button** ban jata hai (click par light→dark→system→light), expand par
  wapas 3 alag buttons.
- **Session hiccup:** is turn ke beech mein sandbox container ek dafa reset
  ho gaya tha (sab kaam ho chuka tha, zip banane se pehle) — pichle zip
  (2026-09-26 wala) ko base bana kar sab changes dobara apply kiye. Koi data
  loss nahi hua, bas dohra kaam karna pada.

---

## 2026-09-26 — Hardcoded 20-model catalog, themes, tray, icons, Manzil build names

- **Model catalog ab hardcoded (live fetch hata diya):** `src/lib/models.ts`
  ka `MODEL_CATALOG` = 20 models (user ke `models.zip` ke examples se),
  `proxy.js` ke `MODEL_OVERRIDES` se 1:1 match (script se 20/20 verify).
  Hataya: `catalog.rs`, `fetch_catalog` command, `reqwest` dependency (Cargo.toml
  + Cargo.lock ki self-entry), `useCatalog` hook, db.ts ke catalog-cache
  functions, Settings ka "Refresh catalog" button, 5 locale keys (refresh,
  refreshing, liveHint, seedHint, seedSuffix). SQLite `models` table
  migration edit nahi ki (purani migration kabhi edit nahi karte) — table
  bas unused rehti hai. `agentic`/`category` ab haath se set hain — purani
  substring heuristic ne `llama-3.1-nemotron-safety-guard` (classifier) ko
  galti se "Recommended for Claude Code" mein daal diya tha.
- **models.zip mein badlav:** deepseek ab `deepseek-ai/deepseek-v4.1-flash`
  hai (pehle `v4-flash-0731`) aur uska example bilkul plain hai (koi
  reasoning field nahi, max_tokens 262144) — purani override entry hata kar
  naya `mode: "none"` + `maxTokensCeiling: 262144` add kiya.
- **Per-model params ka faisla:** `maxTokensCeiling` sirf un models ko di
  jinke example ki max_tokens global 16384 se BADI thi (deepseek 262144,
  ising 32768, nano-omni 65536) — sirf upar ki taraf. Chhoti example values
  (512/1024/5) ko hard-limit NAHI maana (sirf demo defaults the, koi error
  evidence nahi — kimi "medium" wala bug isi tarah ki unverified guess se aaya
  tha). `seed: 0` fixed sirf kimi-k3 aur gemma-4-31b-it ke liye (unke example
  mein hai). temperature/top_p/stream Claude Code ki request se pass-through
  hain (Claude Code apne aap set karta hai) — model-wise force nahi kiye.
- **Donate:** user ki asal payment details (`donation.ts`) daal di. 19 crypto
  entries + gumroad/buymeacoffee/paypal.
- **Icons:** user ke `icons.zip` (real Tauri-generated set) se replace.
- **Build artifact names:** Cargo package `zaheerai-proxy` -> `Manzil`
  (Cargo.toml + Cargo.lock) — ab `Manzil.exe/.pdb/.d`. SQLite file
  `zaheerai.db` -> `manzil.db`, temp folder `manzil-proxy`, capabilities scope
  update. **Nateeja:** purane `zaheerai.db` mein saved API key/model naye
  build mein nahi milegi (dobara daalni hogi).
- **Themes:** 10 accent themes + Light/Dark/System (sidebar bottom line ke
  upar, icons ke saath). `globals.css` ke saare hardcoded colors CSS variables
  bane (light mode ke liye). Persist: settings table ke `theme` / `color_mode`
  keys (`loadPref/savePref` in db.ts). Default: dark + green (purani look).
- **Nav icons:** inline SVG (`Icons.tsx`), koi icon library nahi.
  `navItems.tsx` sidebar aur right-click menu dono ka single source.
- **Right-click:** default browser menu band; custom menu (page links + Copy
  jab text selected ho). Input/textarea par native menu barqarar (API key paste).
- **Tray:** `tauri` feature `tray-icon`; window X = hide (proxy chalta
  rehta hai); tray left-click = show, menu Show/Quit; sirf Quit se asal exit
  (proxy kill ke saath). **Tray menu labels English-only hain** (Rust side, i18n
  nahi).
- **Verify NAHI kar saka (sandbox mein Rust/WebView nahi):** tray code
  (`TrayIconBuilder` API, `show_menu_on_left_click`, `default_window_icon`) —
  Cargo.lock mein `tray-icon` crate nahi hai, pehli build par cargo khud add
  karega (network chahiye, `--locked` na lagayein). Light mode + `color-mix()`
  ka visual check nahi hua. Naye locale strings (mode/themes/contextMenu)
  LLM-quality hain. Second instance launch par (window hidden ho tab) doosra
  tray icon + port conflict aa sakta hai — `tauri-plugin-single-instance`
  ek future TODO hai.

---

## 2026-09-24 (2) — CORRECTION: "capping" design galat tha, fixed per-model values par gaye

- **Production mein confirm hua bug:** pichli entry ("capped ceiling" design)
  se live error mila —
  `Unsupported Kimi K3 thinking_effort="medium"; supported values are low, high, and max`.
  Matlab kimi-k3 "medium" accept hi nahi karta. Meri assumption ke sab
  models ek shared 4-level scale (low/medium/high/max) accept karte hain
  **galat thi** — har model ka apna chhota/alag enum ho sakta hai, universal
  scale ka wajood hi nahi.
- **User ka explicit instruction:** "jo models ka code diya tha wahi use
  karo, unke hisab se auto-change ho" — matlab guess/assumption ki jagah
  sirf wahi values use karo jo har model ke apne NVIDIA example mein thin.
- **Fix:** `cappedEffort()`/`EFFORT_ORDER` scale-comparison system poora
  hata diya. Ab har catalogued model ko uski **fixed** value milti hai
  (`reasoningEffortValue: "max"` kimi-k3 ke liye, `"high"` deepseek ke
  liye ho, direct hardcoded chat_template_kwargs mein) — global
  `REASONING_EFFORT` in models tak pahunchti hi nahi, koi scale-comparison
  nahi hoti. Global setting sirf uncatalogued/naye models ke liye matter
  karti hai (purana default path).
- **Test kiya:** wahi 10-case suite, 3 global settings ke saath (medium,
  max, khali) + 1 uncatalogued-model case — confirm kiya ke catalogued
  models ka value global setting se bilkul unaffected hai, sirf apna fixed
  value bhejte hain. Sab pass.
- **Learning for future models:** kisi bhi naye model ki reasoning_effort
  value "doosre model jaisi hogi" assume mat karna — hamesha uske apne
  NVIDIA example se exact value lena, aur agar mumkin ho to ek real request
  se confirm karna (jaisa is bug mein hua).

---

## 2026-09-24 — Fix: har model apna reasoning_effort value use kare (global blindly na thope)

- **Reported issue:** ek hi global `REASONING_EFFORT` (config.rs se, default
  "medium") har model ko as-is bheja ja raha tha — kimi-k3 ke apne example
  mein "max" hai, deepseek ke example mein "high" hai, aur kai models
  (mistral-nemotron, glm-5.3, gpt-oss-20b, vision models, guard models, etc.)
  reasoning_effort samajhte hi nahi — unhe wo field bhejna galat tha.
- **Fix:** naya "capped ceiling" design. Har catalogued reasoning model ka
  apna verified ceiling hai (`reasoningCeiling` ya `chatTemplateKwargs()`
  ke andar `cappedEffort()` call) — global `REASONING_EFFORT` sirf isay
  *neeche* cap kar sakta hai, upar nahi (`cappedEffort()` function, scale:
  low < medium < high < max). 12 non-reasoning models (`mode: "none"`) ko
  ab koi reasoning field milta hi nahi, global setting se bhi nahi.
  Uncatalogued/naye models ke liye purana default behavior chalta hai
  (top-level `reasoning_effort` = global value, jaisa OpenAI o1/o3
  convention hai).
- **Test kiya:** mock server ke against 3 global settings ("medium", "max",
  khali) × har ek mein 3-4 models — total 10 cases, sab pass. Confirm kiya
  ke capping sahi direction mein kaam karta hai (global model ke ceiling se
  upar kabhi nahi jata) aur none-mode models ko field kabhi nahi milta.
- **Abhi bhi guess hai:** har model ka "ceiling" NVIDIA ke ek hi example
  script se liya hai — humein exact accepted-values-set (enum) kisi model
  ke docs se nahi mila (sirf content-safety ka `request_categories` docs se
  verified hai, baaki sab example-inferred hain).

---

## 2026-09-19 — Configurable port, bundled-Node auto-detect, About + Donate pages

- **Port ab configurable hai:** `config.rs` ka `PORT` const `DEFAULT_PORT`
  (3456) ban gaya — sirf fallback hai. Actual port `Settings.port` (SQLite
  mein `port` key) se aata hai, Server page usi se `local_url` banata hai.
  `start_proxy` command ab `port: u16` param leta hai (0/invalid ho to
  `DEFAULT_PORT` par fallback). `RuntimeInfo` se `port`/`local_url` hata
  diye — ab wo per-user settings hai, static config nahi.
- **Bundled Node auto-detect:** naya `bundled_node_info` command (pehle wala
  unused `sidecar_available` bool replace kiya) — platform ke hisaab se
  expected sidecar filename khud compute karta hai
  (`node-x86_64-pc-windows-msvc.exe` jaisa, `fetch-node.mjs` ki naming se
  sync, dono jagah manually match rakhna hoga agar naya platform add ho) aur
  `app.shell().sidecar("node").is_ok()` se check karta hai. Settings page
  ab khud batata hai "✓ Bundled Node found" ya "missing" — user ko manually
  kuch dhoondna nahi padta. **Jaan-boojh kar filesystem resolve nahi kiya**
  (sirf compile-time OS/ARCH constants) — Tauri ke resource-resolver wala
  purana EISDIR bug dobara na aaye is liye.
- **About page** (`/about`): app name/tagline/version (Cargo.toml se
  `env!("CARGO_PKG_VERSION")`), homepage link, "Check for updates" button.
  **Real auto-update nahi hai** — koi signing keys/release feed configure
  nahi hai, button sirf `config::UPDATE_CHECK_URL` (abhi placeholder:
  manzil.bond) ko browser mein kholta hai. Jhooti "up to date" wali baat
  jaan-boojh kar nahi dikhayi — ya to real update-check infra banayein
  (tauri-plugin-updater + signing + release feed), ya isay link-out hi
  rehne dein.
- **Donate page** (`/donate`): `src/lib/donation.ts` mein crypto addresses
  (USDT-TRC20, USDT-BEP20, BTC, BNB, ETH) aur links (Gumroad, Buy Me a
  Coffee, PayPal.me) — **SAB PLACEHOLDER HAIN** (`REPLACE_WITH_...`), user
  ne apni real values nahi di thin (screenshot ek doosri app "Anti-Detect
  Studio" ka tha — uske wallet addresses istemal karna bilkul galat hota,
  donations kisi aur ki wallet mein chali jatin). Jab tak placeholder hai,
  copy/open buttons disabled rehte hain aur "Not set up yet" dikhta hai
  (`isConfigured()` check). **User ko batana hai:** `src/lib/donation.ts`
  mein apni real crypto addresses aur gumroad/buymeacoffee/paypal.me
  usernames daalne hain deployment se pehle.
- Sidebar mein 2 naye nav items: Donate, About. Locale files (sab 5) mein
  in dono pages + port-setting + bundled-node status ke liye keys add kiye
  — parity script se verify kiya (missing/extra dono 0), aur code ke har
  `t()` call ka locale files se match verify kiya (0 missing, 0 unused).

---

## Preferences (user ne bataye standing rules)

- _(abhi khali — jab user koi permanent preference bataye, yahan add karo,
  e.g. "hamesha pnpm istemal karna", "comments Roman Urdu mein")_

## Known constraints (project shuru se)

- `proxy.js` zero-dependency hai — koi npm import nahi. Reason: Tauri bundle
  mein `node_modules` na ghusana pade.
- Settings page sirf API key + model tak mahdood — baaki `config.rs` mein
  hardcoded.
- Frontend static export (`output: "export"`) — koi SSR, koi API route.
- Model grouping logic Rust (`catalog.rs`) aur TS (`models.ts`) dono mein hai,
  duplicate — sync rakhna zaroori.

## Open TODOs

- API key abhi plain SQLite mein hai, encrypted nahi. Agar chahiye to
  `tauri-plugin-stronghold` add karna hoga.
- ESLint config minimal hai — `eslint-config-next` ka Next 16 flat-config
  shape confirm nahi kiya gaya (network/tooling access nahi tha jab likha).
- Rust aur TSX code kabhi actual `cargo check` / `pnpm typecheck` se guzra
  nahi hai (jis environment mein bana wahan Rust toolchain nahi tha) — pehli
  real build par chhoti errors aa sakti hain.

---

## 2026-09-17 — Feature: per-model overrides (7 models) + i18n (5 languages) + Manzil rebrand

- **Per-model overrides (`proxy.js`):** naya `MODEL_OVERRIDES` object add
  kiya — 6 models ke liye jo reasoning/safety ke liye non-standard request
  fields maangte hain (dekhein pichli `2026-09-16` port-change entry ke
  observations): `nvidia/nemotron-3.5-lightning-30b-a3b`,
  `nvidia/nemotron-3-ultra-550b-a55b`,
  `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`,
  `nvidia/nemotron-3.5-content-safety`, `google/diffusiongemma-26b-a4b-it`,
  `deepseek-ai/deepseek-v4-flash-0731`. Default (7th "model" — koi entry na
  ho) top-level `reasoning_effort` bhejta hai jaisa pehle se tha. Response
  side (`openaiToAnthropic` + `pipeStream`) ab `reasoning_content` **aur**
  `reasoning` dono field names check karta hai (deepseek `reasoning` bhejta
  hai). `nemotron-3.5-content-safety` ka `chat_template_kwargs.request_categories: "/categories"`
  NVIDIA ke official docs se web-search karke verify kiya — placeholder
  nahi, real documented value hai.
  **Test kiya:** mock NVIDIA server ke against 8 cases (7 override models +
  1 default) — sab pass. Real NVIDIA API ke against nahi (network nahi tha).
- **i18n (5 languages):** `src/locales/{en,ur,de,ar,hi}.json` — poori app
  translate ki (Server dashboard, Settings, Sidebar, logs, env snippet).
  `src/components/I18nProvider.tsx`: context + `t()` (dot-path lookup) +
  `renderRich()` (locale strings ke andar `**bold**`/`*italic*`/`` `code` ``
  markup) + `interpolate()` (JSX jaisa `<Link>` translated sentence ke beech
  mein daalne ke liye). Locale SQLite `settings` table mein `locale` key ke
  taur par persist hota hai (Settings type se alag rakha — AppShell-level
  global state hai, per-page nahi). Select karte hi turant active hota hai.
  Urdu/Arabic RTL — `<html dir>` auto-set, 2 physical CSS border properties
  logical (`border-inline-*`) bana di.
  **Verify kiya:** sab 5 locale files mein exactly same keys hain (script se
  check kiya), code ke har `t("...")` call ka locale files mein match hai.
  **Verify nahi kar saka:** Urdu/German/Arabic/Hindi translations LLM-quality
  hain, native speaker se review nahi karwaya — production se pehle karwana
  chahiye. `.info-box` ka rounded corner RTL mein bhi physically left hi
  rahega (cosmetic-only, functionality par asar nahi).
- **Rebrand:** app ka naam "Manzil" hai, domain manzil.bond (user ne diya).
  `package.json` (`name: "manzil"`), `tauri.conf.json`
  (`productName: "Manzil"`, `identifier: "bond.manzil.app"`, window title),
  Sidebar brand mark "M"/"Manzil", README/CLAUDE.md headers update kiye.
  **Ahem:** identifier badalne se (purana `com.zaheerahmad.claudeproxy`)
  OS-level data folder path badal gaya — pehle se saved API key/model naye
  build mein nahi milegi, ek dafa dobara Settings mein daalni hogi. Cargo
  internal package name (`zaheerai-proxy`) jaan-boojh kar nahi badla — sirf
  user-facing naam (productName/window title) badle, Rust crate name se
  users ka koi wasta nahi.

---

## 2026-09-17 — Port change: 3000 → 3456

- **Change:** `config.rs` ka `PORT` const 3000 se 3456 kar diya (user ne
  explicitly maanga). Ye single source of truth hai — `RuntimeInfo`,
  `EnvSnippet.tsx`, aur Server dashboard sab isi se dynamically padhte hain,
  is liye kahin aur code change ki zaroorat nahi padi. `README.md` ka
  example snippet bhi sync kar diya.
- **Confirmed working:** user ne bataya bundled Node sidecar
  (`src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`) successfully fetch
  ho chuka hai aur zip mein maujood hai — pichla `fetch:node` fix kaam kar
  gaya.
- **Pending:** user agli chat mein aur NVIDIA model examples bhejega
  (23+ models ka target), phir sab ek saath analyze karna hai ke proxy.js
  ka translation layer un sab ke saath 100% kaam karega ya nahi (kuch models
  ka request/response shape standard se hat kar hai — dekhein neeche).
  Jab tak poori list na aa jaye, tab tak koi translation-layer change nahi
  ki — sirf observe kiya hai.
- **Observation (is batch ke model examples se, action abhi nahi li):**
  - `google/paligemma` alag endpoint use karta hai
    (`https://ai.api.nvidia.com/v1/vlm/...`), `/v1/chat/completions` nahi —
    hamara proxy sirf ek fixed `UPSTREAM_BASE_URL` (chat/completions) par
    forward karta hai, is model ke liye kaam nahi karega jaisa hai.
  - `deepseek-ai/deepseek-v4-flash-0731` reasoning ke liye
    `chat_template_kwargs: {"thinking":true,"reasoning_effort":"high"}` use
    karta hai — hamara proxy top-level `reasoning_effort` field bhejta hai,
    ye alag shape hai.
  - `meta/llama-guard-4-12b` (safety/moderation model) response mein normal
    chat content ke bajaye ek category label deta hai, aur request mein
    extra `conversation` field bhi bhejta hai jo humne translate nahi kiya.
  - Vision models (`llama-3.2-11b/90b-vision-instruct`,
    `google/gemma-4-31b-it` jaisे multimodal) `image_url` content blocks
    already standard OpenAI shape mein hain — proxy ka maujooda image
    handling in sab ke saath compatible lagta hai (verify baad mein karna
    hai).
  - `mistralai/mistral-nemotron`, `meta/muse-glimmer-30b` standard OpenAI SDK
    shape (`openai` package) use karte hain — koi custom field nahi, in ke
    proxy ke saath kaam karne ka imkaan sab se zyada hai.

---

## 2026-09-16 — Bugfix + feature: EISDIR crash → embedded script + bundled Node sidecar

- **Root cause of user-reported crash:** logs showed `Error: EISDIR: illegal
  operation on a directory, lstat 'D:'` on Windows. `start_proxy` was using
  `app.path().resolve("resources/proxy.js", BaseDirectory::Resource)`, which
  resolved to just the drive root (`D:`) in dev mode on this machine —
  Tauri's dev-mode resource resolver quirk, not something we control cleanly.
- **Fix:** `proxy.js` ab compile-time par `include_str!` se Rust binary ke
  andar embed hai (`PROXY_SCRIPT` const in `proxy.rs`), runtime par ek temp
  file (`%TEMP%/zaheerai-proxy/proxy.js`) mein likh kar wahi path use hota
  hai. Tauri resource resolver par ab depend nahi karte — dev aur prod dono
  mein identical behavior.
- **Feature (user request: "har user ko Node install na karna pade"):**
  bundled Node ab Tauri "sidecar" feature se ship hota hai.
  - `scripts/fetch-node.mjs` — nodejs.org se pinned version (22.14.0)
    download kar ke `src-tauri/binaries/node-<target-triple>[.exe]` par
    stage karta hai. `pnpm fetch:node` se manually, ya `pnpm app:build` se
    khud (`tauri.conf.json` ka `beforeBundleCommand`).
  - `tauri.conf.json`: `bundle.externalBin: ["binaries/node"]` add kiya,
    `bundle.resources` hata diya (ab zaroorat nahi, script embed hai).
  - `capabilities/default.json`: `shell:allow-execute` permission (sidecar +
    args) add kiya `binaries/node` ke liye.
  - `proxy.rs`: `ProxyState` ab `RunningProxy` enum hai (`Sidecar` ya
    `System` variant) — dono ko kill/status handle karna hai. `start_proxy`
    pehle sidecar try karta hai (agar `node_path` khali hai), fail/missing ho
    to system Node par fallback. Naya command: `sidecar_available`.
- **Not verified here:** is sandbox mein na network hai na Windows/Rust
  toolchain — `fetch-node.mjs` ka download+extract flow aur
  `tauri_plugin_shell` ka exact sidecar API (`.sidecar()`, `.spawn()` ka
  return shape, `CommandEvent` variants) sirf documentation ki based par
  likhe hain, compile-test nahi ho paye. Pehli real build par API mismatch
  ki wajah se chhoti Rust errors aa sakti hain.
- **Decision:** `node_path` field ab optional override hai — khali chhodne
  par sidecar (agar staged) ya system Node (fallback) khud chunta hai.
  Settings page ka copy update kiya.

---

## 2026-09-16 — Bugfix: Rust E0597 (borrow checker) on window close

- **Fix:** `cargo build` fail ho raha tha (`src\proxy.rs:230`, error E0597,
  "`state` does not live long enough"). Wajah: `kill_if_running()` mein
  `state.0.lock().unwrap().take()` — poora chain ek expression mein tha, is
  liye `MutexGuard` ek anonymous temporary tha jo `if let` block ke andar hi
  drop ho jata, jab ke `state` khud thoda pehle drop hota — Rust ne is
  ordering ko reject kiya. Fix: guard ko named variable (`let mut guard = ...`)
  mein bind kiya, jaisa isi file ke baaki 3 commands (`proxy_status`,
  `start_proxy`, `stop_proxy`) mein pehle se tha.
- **Learning:** is repo mein Mutex lock hamesha named `guard` variable mein
  bind karna — kabhi bhi `state.0.lock().unwrap().<method>()` ko ek hi line
  mein chain na karna, khaaskar jab return value `state` par depend karta ho.

---

## 2026-09-16 — Bugfix: dev build fail + browser crash

- **Fix:** `cargo build` fail ho raha tha — `icons/icon.ico` maujood nahi thi
  (sirf ek README chhoda tha "khud generate kar lena", jo `tauri dev` ke
  liye kaafi nahi tha, wo build-time par khud dhoondta hai). Real icons
  generate kar ke `src-tauri/icons/` mein daal diye (PNG sizes, valid
  `.ico`, valid `.icns` — code se generate kiye, NVIDIA-green "Z" mark).
  `pnpm app:icon ./logo.png` ab bhi kaam karega apna logo lagane ke liye.
- **Fix:** `src/lib/tauri.ts` aur `src/lib/db.ts` mein `isTauri()` guard add
  kiya. Wajah: plain `pnpm dev` (browser mein, Tauri window ke baghair)
  chalane par `window.__TAURI_INTERNALS__` maujood nahi hota, aur
  `listen()`/`invoke()`/`Database.load()` cryptic crash dete the
  (`Cannot read properties of undefined (reading 'transformCallback')`).
  Ab in sab jagah guard hai — commands ek saaf error throw karte hain,
  events silently no-op ho jate hain.
- **Learning:** sahi dev command `pnpm app:dev` hai (Tauri window khulta
  hai), `pnpm dev` sirf Next.js akela chalata hai jahan Tauri APIs kaam
  nahi karti — is guard ke baad `pnpm dev` bhi UI dikhayega (data/commands
  ke baghair) bajaye crash ke.

---

## 2026-09-16 — Project ka pehla version

- Poora Tauri 2 + Next.js 16 project banaya: `zaheerai-proxy/`.
- Architecture: Next.js static-export frontend + Rust Tauri shell +
  zero-dependency Node proxy (`src-tauri/resources/proxy.js`) jo Anthropic
  Messages API ko NVIDIA NIM ke OpenAI-format API se translate karta hai.
- SQLite (`tauri-plugin-sql`) mein 3 tables: `settings`, `models` (catalog
  cache), `model_usage`.
- Rust commands: `runtime_info`, `fetch_catalog`, `check_node`,
  `proxy_status`, `start_proxy`, `stop_proxy` (`config.rs`, `catalog.rs`,
  `proxy.rs`, `main.rs`).
- Frontend: `/` (Server dashboard: start/stop, config summary, env snippet,
  live logs) aur `/settings` (API key, model picker, node path).
- Decision: proxy translation logic (`proxy.js`) mock NVIDIA server ke
  against end-to-end test kiya (streaming, tool round-trip, error mapping) —
  sab pass hua. Ye sirf isolated environment mein tha, real NVIDIA endpoint
  ke against nahi.
- Decision: model "Recommended for Claude Code" group tool-calling family
  pattern-match se banta hai (Kimi, GLM, Qwen3, Nemotron, DeepSeek, Llama
  3.1/3.3/4, Mixtral 8x22B, Devstral) — heuristic hai, 100% guarantee nahi.
- Isi commit mein `CLAUDE.md`, `AGENT.md`, `SKILLS.md`, ye `MEMORY.md` add
  kiye taake future sessions (Claude Code ya koi aur agent) context na
  khoyein.
