# CLAUDE.md

Ye file Claude Code ke liye hai jab wo is repo ke andar kaam kare. Yahan diya
har rule **mandatory** hai — request mein na likha ho tab bhi follow karna hai.

## Project ek nazar mein

**Manzil** (domain: manzil.bond) — NVIDIA NIM models ko Claude Code mein chalane ke liye ek
Tauri 2 desktop app.

```
Claude Code --(Anthropic /v1/messages)--> proxy.js --(OpenAI /v1/chat/completions)--> NVIDIA
```

- Frontend: Next.js 16 (App Router, static export), React 19, TypeScript
- Shell: Tauri 2 (Rust)
- Storage: SQLite (`tauri-plugin-sql`)
- Proxy: `src-tauri/resources/proxy.js` — zero-dependency Node script

Poori architecture ke liye `README.md` padhein. Ye file sirf **kaam karne ke
tareeqe** ke baare mein hai.

## MEMORY.md — sab se zaroori rule

**Har baar jab koi cheez banayein, badlein, ya koi faisla lein, `MEMORY.md`
mein turant likh dein.** Kaam khatam hone ka intezaar mat karein — har step ke
baad likhein, warna context window khatam hone par ye jaankari kho jayegi.

Kya likhna hai:
- Naya file/component/module banaya → ek line: kya banaya, kahan, kyun
- Koi architectural faisla liya (e.g. "SQLite ke bajaye JSON file istemal ki
  kyunki X") → faisla + reason
- Koi bug fix kiya jo dobara ho sakta hai → symptom + fix
- Koi cheez jo abhi incomplete/TODO hai → saaf likhein ke kya baaki hai
- User ne koi permanent preference bataya (e.g. "hamesha pnpm istemal karna",
  "comments Roman Urdu mein likhna") → `MEMORY.md` ke "Preferences" section
  mein daal dein

Format: chhota, dated, bullet-point. Poore paragraphs mat likhein — agla
session (chahe Claude Code ho ya koi aur) ise jaldi scan kar sake.

```markdown
### 2026-09-16
- Added a model-catalog hook (ab hata diya gaya — catalog `models.ts` mein hardcoded hai).
- Decision: proxy zero-dependency rakha (no express/axios) taake Tauri
  bundle mein node_modules na ghusana pade.
- TODO: API key abhi plain SQLite mein hai; stronghold plugin add karna
  baaki hai agar encryption chahiye.
```

`MEMORY.md` file-size capped nahi honi chahiye — agar bohot bhaari ho jaye to
purani entries ko summarize kar ke ek "## Archive" section mein condense kar
dein, lekin decisions aur unresolved TODOs kabhi mat hataayein.

## Kaam karne ka tareeqa

1. **Pehle `MEMORY.md` aur `README.md` padhein** — is se pata chalega pichla
   context kya tha, koi decision pehle se liya ja chuka hai ya nahi.
2. **`AGENT.md` ke coding conventions follow karein** (naming, file placement,
   comment style).
3. **`SKILLS.md` check karein** — agar task kisi documented pattern se milta
   hai (e.g. naya Tauri command add karna, naya hook banana) to wahi pattern
   repeat karein, naya invent na karein.
4. Kaam karein.
5. **`MEMORY.md` update karein** — is step ko kabhi skip na karein.
6. Agar user ne koi naya standing rule diya ho ("hamesha X karna"), usay is
   `CLAUDE.md` ya `MEMORY.md` ke Preferences section mein bhi likh dein, taake
   agli baar bhi yaad rahe.

## Hard constraints (badlein nahi, sirf reference se)

- `src-tauri/resources/proxy.js` **zero-dependency** rehni chahiye — koi
  `require()` npm package ka nahi. Agar koi feature add karni ho jisay
  dependency chahiye, pehle `MEMORY.md` mein likhein ke ye constraint tod rahe
  hain aur kyun.
- `proxy.js` Rust binary ke andar `include_str!` se embed hai
  (`src-tauri/src/proxy.rs`), file-path se load nahi hoti — ye jaan-boojh kar
  hai (Tauri ka dev-mode resource resolver Windows par galat path deta tha).
  Isay wapas file-resolve pattern par mat le jana.
- Proxy do tareeqon se chal sakta hai: bundled Node **sidecar**
  (`src-tauri/binaries/`, `pnpm fetch:node` se stage hoti hai) ya system
  Node (fallback). Naya kaam is dono paths ko sync rakhe — `proxy.rs` ke
  `RunningProxy` enum ke dono variants (`Sidecar`, `System`) handle karna
  na bhoolein.
- API key, model, aur port UI se configurable hain (SQLite mein save). Baaki
  settings `src-tauri/src/config.rs` mein hardcoded rehni chahiye — naya
  settings-page field na banayein jab tak explicitly na kaha jaye.
- Frontend `output: "export"` (static) rehna chahiye. Koi API route, koi SSR,
  koi server action add na karein — Tauri Node server nahi chalata.
- **Har delivery ke saath version 3 jagah sync honi chahiye** (user ka
  standing instruction): `package.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml` — teeno mein exactly same version string.
  **Hamesha sirf patch number +1** (1.0.2 → 1.0.3 → 1.0.4 ...) — change
  chhota ho ya bada, minor/major kabhi na badhayein (user ne explicitly
  kaha: 1.0.1 se shuru, har baar 1 aage). `RELEASES.md` changelog mein har
  version ki entry add karna na bhoolein.
- **`src-tauri/Cargo.lock` repo/zip mein NAHI dena** (user ka instruction —
  cargo khud banata hai run/install par). Gitignored hai.
- **Bundle identifier hamesha `com.csofts.manzil`** (`tauri.conf.json`).
  Kabhi badalna nahi.
- **UI ka koi bhi text hardcoded nahi** — har string `src/locales/*.json`
  (5 languages) mein. Tray menu bhi: Rust side `src/locales/*.json` ko
  `include_str!` se embed kar ke `tray.show`/`tray.quit` padhta hai
  (`src-tauri/src/tray.rs`) — alag Rust translation table nahi.
- **Tauri plugins: Rust crate aur NPM package ka major.minor same hona
  chahiye** — `tauri build`/`dev` mismatch par fail hota hai. Cargo.lock nahi
  hai aur NPM side `^` se float karti hai, to dono alag latest utha lete
  hain. **Cargo.toml mein Tauri crate versions haath se pin NA karein** (ek
  baar kiya tha, galat nikla) — `scripts/sync-tauri-versions.mjs` unhein
  `node_modules` ke asal versions se `~X.Y` par set karta hai
  (`app:dev`/`app:build` aur `release.yml` chalate hain; haath se
  `pnpm sync:tauri`). Naya Tauri plugin add karo to NPM package aur Cargo
  crate dono add karo (naam mapping: `@tauri-apps/plugin-X` ->
  `tauri-plugin-X`) — sync script baaki sambhal leta hai.
- **`package.json` user ki di hui file hai** — dependency versions apni
  marzi se na badlein; sirf zaroorat par naye packages add karein.
