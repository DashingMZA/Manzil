# AGENT.md

Generic agent instructions — Claude Code, Cursor, Windsurf, ya koi bhi AI
coding tool jo is repo ko padhta hai, inhe follow kare. `CLAUDE.md` isi file
ko point karta hai aur Claude-specific memory rule add karta hai.

## Naming aur placement rules

| Kis cheez ka | Kahan jaata hai | Naming |
|---|---|---|
| Naya page (route) | `src/app/<route>/page.tsx` | kebab-case folder |
| Shared UI piece | `src/components/<Name>.tsx` | PascalCase |
| Stateful logic (React) | `src/hooks/use<Name>.ts` | camelCase, `use` prefix |
| Pure helper / data layer | `src/lib/<name>.ts` | camelCase |
| Shared TS types | `src/lib/types.ts` | mixed in, mat splitein |
| Rust command | `src-tauri/src/<module>.rs` | module ke hisaab se group karein, sab kuch `main.rs` mein mat dalein |
| Hardcoded runtime config | `src-tauri/src/config.rs` | isi jagah, kahin aur nahi |

Naya module banane se pehle check karein ke koi maujooda file usay accommodate
kar sakti hai — bilaawaja files mat banayein.

## Rust conventions

- Har `#[tauri::command]` apne module mein rahe (`proxy.rs`, `config.rs`,
  etc.), `main.rs` sirf registration aur wiring ke liye hai.
- Errors hamesha `Result<T, String>` — message user-facing aur Roman
  Urdu/English mix mein ho (jaisa comments mein hai), taake UI mein seedha
  dikhaya ja sake.
- Koi bhi naya external process spawn karna ho, `proxy.rs` ka pattern follow
  karein: stdout/stderr alag threads mein pipe karein, `AppHandle::emit` se
  events bhejein, window-destroy par process kill karein.
- Naya SQLite table chahiye? `main.rs` ke `migrations()` mein naya
  `Migration { version: N, ... }` add karein — purani migrations kabhi mat
  edit karein, hamesha nayi version number ke saath aage badhein.

## Frontend conventions

- Client components hi hain (`"use client"`) kyunki static export mein SSR
  nahi hota. Server components ka faida nahi milega, is liye add karne ki
  koshish na karein.
- Tauri commands seedha components mein `invoke()` mat karein — `src/lib/tauri.ts`
  mein typed wrapper add karein, phir wahan se import karein.
- SQLite seedha components se query mat karein — `src/lib/db.ts` mein function
  add karein.
- Naya global state chahiye? Pehle dekhein ke `AppShell.tsx` ka Context
  pattern kaafi hai ya nahi, naya state library mat add karein.
- Styling: plain CSS (`globals.css`), utility classes already defined hain
  (`.card`, `.field`, `.btn`, `.pill`, etc.) — inhi ko reuse karein, naya CSS
  system (Tailwind, styled-components) mat introduce karein.

## Testing / validation (koi test runner nahi hai)

Is repo mein automated test suite nahi hai. Changes verify karne ka tareeqa:

1. `pnpm typecheck` — TypeScript errors
2. `pnpm lint` — ESLint
3. Rust: `cd src-tauri && cargo check`
4. `proxy.js` translation logic badli ho to manually ek mock upstream ke
   against test karein (dekhein `README.md` ka "Proxy kya translate karta
   hai" section) — request/response shape breakage silent hoti hai, warning
   nahi deta.

## Kya NAHI karna

- `proxy.js` mein koi npm dependency add na karein (zero-dependency
  constraint — `CLAUDE.md` dekhein).
- Settings page par naya configurable field na banayein jab tak explicitly na
  kaha jaye — architecture "sirf API key + model" ke around bani hai.
- `next.config.ts` se `output: "export"` na hataayein.
- Purani SQLite migration edit na karein — naya version add karein.
