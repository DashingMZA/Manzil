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

`src-tauri/tauri.conf.json` ke `plugins.updater.pubkey` mein abhi
`"REPLACE_WITH_YOUR_OWN_GENERATED_PUBLIC_KEY"` likha hai — isay apni asal
public key se badal dein aur commit kar dein (public key share karna theek
hai, isi liye "public" hai).

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
# 1. Version badhayein — DO jagah, dono match honi chahiye:
#    - package.json         "version"
#    - src-tauri/Cargo.toml [package] version
#    - src-tauri/tauri.conf.json "version" (ye bhi match karna chahiye)

# 2. Commit + tag + push
git add -A
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main --tags
```

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

### v1.0.1 — 2026

- Real auto-update (`tauri-plugin-updater` + `tauri-plugin-process`) —
  About page ab check/download/install/restart khud karta hai
- GitHub Actions release workflow (`.github/workflows/release.yml`) —
  tag push par 4-platform (Windows/macOS Intel+Apple Silicon/Linux) build
- `download-widget.html` — manzil.bond ke liye standalone download widget
- Fixed window size (1100x910, non-resizable), custom Windows manifest
  (Common-Controls v6)
- Sidebar collapse/expand, active-page accent color
- Donate page ki real payment details, Tauri-generated icons

### v1.0.0 — 2026

Pehla release.

- Claude Code ko NVIDIA NIM models ke saath chalane ke liye local proxy
  (Anthropic Messages API ↔ NVIDIA OpenAI-compatible API translation)
- 20 verified models (hardcoded catalog, per-model reasoning/token overrides)
- Bundled Node sidecar — end user ko Node install karne ki zaroorat nahi
- 5 languages (English, اردو, Deutsch, العربية, हिन्दी) + RTL support
- 10 accent color themes + Light/Dark/System
- Collapsible sidebar, system tray (minimize instead of quit), custom
  right-click menu
- Donate page, About page with auto-update
