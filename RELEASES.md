# Releases

Ye file do cheezon ke liye hai: **release kaise banayein** (process), aur
**ab tak kya release hua** (changelog).

---

## Pehli baar setup (sirf ek dafa)

Auto-update tabhi kaam karega jab aapki apni, real signing keys ho — kisi
aur project se copy ki hui key kaam nahi karegi (verification fail hogi).

### 1. Signing keypair generate karein

```bash
pnpm tauri signer generate -w ~/.tauri/manzil.key
```

Ye do cheezein degi:
- **Private key** (file `~/.tauri/manzil.key` mein) — isay **kisi ke saath
  share na karein**, GitHub par commit bhi na karein.
- **Public key** — terminal par print hoga, isay copy karein.

### 2. Public key `tauri.conf.json` mein daalein

`src-tauri/tauri.conf.json` ke `plugins.updater.pubkey` mein apni asal
public key honi chahiye, `REPLACE_WITH_...` jaisa placeholder nahi (abhi
asli key lagi hui hai). Public key commit karna theek hai, isi liye "public"
hai. Key kabhi badlein to purane release ke users ka auto-update kaam nahi
karega (wo purani key se verify karte hain).

### 3. GitHub repo secrets set karein

Repo → Settings → Secrets and variables → Actions → "New repository secret":

| Secret name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/manzil.key` file ka poora content |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key generate karte waqt diya gaya password |

### 4. GitHub owner/repo confirm karein

Ye 3 jagah same GitHub `owner/repo` hona chahiye:
- `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`
- `download-widget.html` → `GITHUB_OWNER` / `GITHUB_REPO`
- `src-tauri/src/config.rs` → `UPDATE_CHECK_URL` (sirf fallback link ke liye)

Abhi `dashingmza/manzil` par set hain — agar ye sahi nahi hai to teeno jagah
badal dein.

---

## Naya release banane ka tareeqa

```bash
# 1. Version 1 se badhayein (1.0.2 -> 1.0.3) — TEENO jagah exactly same:
#    - package.json                 "version"
#    - src-tauri/Cargo.toml         [package] version
#    - src-tauri/tauri.conf.json    "version"
#    Cargo.lock commit nahi hoti (gitignored) — cargo khud banata hai.

# 2. Commit + tag + push (tag = wahi version, aage "v" ke saath)
git add -A
git commit -m "Release v1.0.3"
git tag v1.0.3
git push origin main --tags
```

### Local build (apni machine par installer banana)

```bash
cp .env.example .env     # phir .env mein apni signing key ka path daalein
pnpm app:build           # dotenv-cli .env load karta hai, phir tauri build
```

`.env` kabhi commit nahi hoti. GitHub Actions `.env` use nahi karta — wo
apne repo Secrets se keys leta hai.

Tag push hote hi `.github/workflows/release.yml` khud chal jata hai:
Windows + macOS (Intel aur Apple Silicon) + Linux — char builds parallel
mein, har ek apna bundled Node khud fetch karta hai
(`scripts/fetch-node.mjs`), phir ek **draft** GitHub Release banta hai sab
installers + `latest.json` (updater manifest) ke saath.

**Draft hai — publish aap khud karte hain.** GitHub par Releases tab mein
jaa kar release notes likhein/check karein, phir "Publish release" dabayein.
Publish hote hi:
- `download-widget.html` wali website par naya version turant dikhne lagega
- App ke andar "Check for updates" (About page) is release ko detect karega

---

## Changelog

Version numbering: **sequential patch bumps** — 1.0.1, 1.0.2, 1.0.3 ... Har
release par teeno files (`package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`) mein version exactly same rakhein aur 1 badhayein.

### v1.0.6 — 2026

- **macOS Intel (`x86_64-apple-darwin`) build fix:** `build.rs` ruk jata tha
  ("resource path `binaries/node-x86_64-apple-darwin` doesn't exist").
  Wajah: `fetch-node.mjs` target host machine se chunta thi, aur GitHub ka
  `macos-latest` runner Apple Silicon hai — to Intel wali leg ko bhi arm64 ka
  Node mil raha tha. Ab script build target se chunti hai (`--target`,
  `TARGET_TRIPLE`, `TAURI_ENV_TARGET_TRIPLE`), aur `release.yml` matrix target
  pass karta hai
- `package.json`, `tauri.conf.json`, `release.yml` aapke edit kiye hue
  versions se liye (naye dependency versions, asli updater pubkey, publisher
  `cSofts`, workflow ki `contents: write` permission)

### v1.0.5 — 2026

- **Crate/npm version mismatch ka asal hal:** pichli dafa Cargo.toml mein
  haath se `~2.4`/`~2.6` pin kiye the — galat tareeqa tha, kyunki NPM side
  khud `^` se float karti hai (aapki lock mein `plugin-fs` 2.7.0 aaya).
  Ab `scripts/sync-tauri-versions.mjs` Cargo.toml ke Tauri crates ko
  `node_modules` ke ASAL install hue versions (`~MAJOR.MINOR`) par khud set
  karta hai. `pnpm app:dev` / `pnpm app:build` isay khud chalate hain, CI mein
  alag step hai, haath se `pnpm sync:tauri`
- Haath se pin wale comments Cargo.toml se hata diye

### v1.0.4 — 2026

- **CI (teeno platforms):** `tauri build` ne Rust crates aur NPM packages ke
  versions mismatch par roka (`tauri-plugin-shell` crate 2.5.0 vs npm 2.4.0,
  `tauri-plugin-fs` crate 2.7.0 vs npm 2.6.0). `Cargo.toml` mein dono crates
  NPM ke minor par pin kiye (`~2.4`, `~2.6`)
- **Windows local build:** `fetch-node.mjs` ab system ka bsdtar
  (`System32\tar.exe`) use karta hai — Git ka GNU tar `C:\...` ko remote
  host samajhta tha ("Cannot connect to C: resolve failed") aur `.zip`
  extract bhi nahi kar sakta. PowerShell `Expand-Archive` fallback bhi hai
- Purani `pnpm-lock.yaml` zip se hata di (aapki `package.json` se match nahi
  karti thi) — apni lockfile repo mein rakhein

### v1.0.3 — 2026

GitHub Actions release build ki teeno platforms par failures theek kin:

- **macOS:** `Sidebar.tsx` mein TypeScript error (`noUncheckedIndexedAccess`
  ki wajah se array index `undefined` ho sakta tha) — fallback add kiya
- **Linux:** `libappindicator3-dev` ko workflow ki apt list se hataya — ye
  `libayatana-appindicator3-dev` se conflict karta hai (Tauri 2 ayatana wala
  use karta hai)
- **Windows:** `scripts/fetch-node.mjs` mein `renameSync` alag drive
  (temp `C:` vs repo `D:`) par `EXDEV` se fail hota tha — ab `copyFileSync`

### v1.0.2 — 2026

- Window ab launch par hamesha turant dikhti hai (Rust side se `setup()`
  mein show) — pehle kabhi kabhi sirf tray mein chali jati thi
- Single-instance: app dobara kholne par (icon/shortcut click) nayi copy
  nahi chalti, pehli wali ki window saamne aa jati hai
- Tray menu ("Show/Quit") ab selected language mein hai aur language badalte
  hi tray bhi badal jata hai (locale files se, koi hardcoded text nahi)
- "Launch at startup" toggle (Settings) — system boot par chup-chaap tray
  mein start hota hai
- Sidebar layout theek kiya: bottom mein mode toggle → status → line →
  collapse button; top par app ka version + line
- Links ab `tauri-plugin-opener` se khulte hain
- Local `pnpm app:build` ab `.env` se signing keys leta hai
  (`.env.example` dekhein)
- Bundle identifier: `com.csofts.manzil`

### v1.0.1 — 2026

Pehla release.

- Claude Code ko NVIDIA NIM models ke saath chalane ke liye local proxy
  (Anthropic Messages API ↔ NVIDIA OpenAI-compatible API translation)
- 20 verified models (hardcoded catalog, per-model reasoning/token overrides)
- Bundled Node sidecar — end user ko Node install karne ki zaroorat nahi
- 5 languages (English, اردو, Deutsch, العربية, हिन्दी) + RTL support
- 10 accent color themes + Light/Dark/System
- Collapsible sidebar, system tray (minimize instead of quit), custom
  right-click menu
- Real auto-update (`tauri-plugin-updater`), About + Donate pages
- GitHub Actions release workflow, `download-widget.html`
- Fixed window size (1100x910, non-resizable), custom Windows manifest
