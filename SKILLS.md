# SKILLS.md

Is repo mein baar-baar aane wale kaamon ke liye step-by-step patterns. Naya
kaam shuru karne se pehle check karein ke yahan koi matching skill hai —
agar hai to wahi follow karein, naya tareeqa invent na karein.

Har skill ke aakhir mein "Memory" line hai — is se yaad rahega ke `MEMORY.md`
mein kya likhna hai jab skill istemal karein.

---

## Skill: Naya Tauri command add karna

1. Jis module se related hai wahan function likhein (`proxy.rs`, `config.rs`,
   ya naya module banayein agar koi maujooda fit nahi baithta).
2. `#[tauri::command]` attribute lagayein, `Result<T, String>` return karein.
3. `main.rs` ke `invoke_handler(tauri::generate_handler![...])` list mein add
   karein.
4. `src/lib/tauri.ts` mein typed wrapper add karein:
   ```ts
   export const myCommand = (args: X) => invoke<Y>("my_command", args);
   ```
5. Agar naya permission chahiye (fs, dialog, etc.), `src-tauri/capabilities/default.json`
   mein add karein.
6. Component mein seedha `invoke` nahi, `tauri.ts` ke wrapper se call karein.

**Memory:** naya command ka naam, kis file mein, kya karta hai.

---

## Skill: Naya SQLite table / column add karna

1. `main.rs` ke `migrations()` function mein **nayi** `Migration` entry add
   karein, `version` ek badhaein. Purani migration edit mat karein.
2. `src/lib/types.ts` mein matching TS interface add/update karein.
3. `src/lib/db.ts` mein load/save functions likhein — component se seedha
   query na karein.
4. Agar setting user-facing hai, `useSettings.ts` ke `Settings` interface aur
   `KEYS` map mein add karein.

**Memory:** naya table/column, uska purpose, migration version number.

---

## Skill: Naya settings-page field add karna

Pehle confirm karein ke user ne explicitly maanga hai — `CLAUDE.md` ka rule
hai ke settings sirf API key + model tak mahdood rahe.

1. `Settings` interface (`src/lib/types.ts`) mein field add karein.
2. `useSettings.ts` ke `KEYS` map mein DB key add karein.
3. `settings/page.tsx` mein `<Field>` component se UI add karein.
4. Agar proxy ko ye value chahiye, `proxy.rs` ke `start_proxy` command mein
   parameter add karein aur `.env()` call mein pass karein.

**Memory:** naya field, kis maqsad ke liye, user ne kab maanga.

---

## Skill: `proxy.js` mein naya Anthropic↔OpenAI translation case handle karna

`proxy.js` zero-dependency hai — koi import add na karein. Ye Rust binary ke
andar `include_str!` se embed hai (`proxy.rs`) — file edit karne ke baad
Rust rebuild zaroori hai, sirf `.js` file save karna kaafi nahi (koi hot
reload nahi).

1. Request side: `anthropicToOpenAI()` function mein naya block-type case add
   karein.
2. Response side: `openaiToAnthropic()` (non-streaming) aur `pipeStream()`
   (streaming) **dono** ko update karein — inka logic duplicate hai, ek bhool
   jana bug banata hai.
3. Mock upstream server ke against manually test karein (README ka test
   pattern dekhein) — ye sabse aam jagah hai jahan silent breakage hoti hai.

**Memory:** kaunsa naya case, kya edge-case trigger karta hai, test kaise
kiya.

---

## Skill: Naya model add karna (models.ts + proxy.js — DONO)

Model catalog hardcoded hai, live fetch nahi. Naya model **do jagah** add
hota hai aur dono ke ids exactly match hone chahiye:

1. `src-tauri/resources/proxy.js` ke `MODEL_OVERRIDES` mein entry (request
   shape / reasoning fields / `maxTokensCeiling` / `seed`) — dekhein "Model
   overrides table" skill. Sirf NVIDIA ke apne working example se values lein.
2. `src/lib/models.ts` ke `MODEL_CATALOG` mein entry: `category` aur
   `agentic` **haath se** set karein. `agentic: true` sirf tab jab model tool
   calling support karta ho (safety classifiers / vision-only models `false`).
3. Match verify karein: dono files ke ids ka diff nikalein (pichle session mein
   ek chhota node script se 20/20 match check kiya tha).

Jo models `/v1/chat/completions` use hi nahi karte (jaise paligemma,
kumo-relational) unhe add na karein — proxy se kaam nahi karenge.

**Memory:** naya model id, agentic true/false ka reason, example ka source.

---

## Skill: Naya theme add karna

1. `src/app/globals.css` mein `:root[data-theme="naam"] { --accent; --accent-hover; --on-accent }`
   line add karein (`--on-accent` = accent ke upar text ka rang — bright accent par
   dark, gehre accent par white).
2. `src/lib/theme.ts` ke `THEMES` mein `{ id, swatch }` add karein.
3. **Har** locale file (`en/ur/de/ar/hi.json`) ke `themes` object mein `naam` ka
   translation add karein.

**Memory:** naya theme id aur accent hex.

---

## Skill: Naya UI text add/badalna (i18n)

Is app mein har UI string translated hai — koi bhi naya text hardcode na
karein, `t()` se laayein.

1. `src/locales/en.json` mein naya key add karein (dot-path nested object,
   jaisa `settings.newField`).
2. **Foran** baaki 4 files (`ur.json`, `de.json`, `ar.json`, `hi.json`) mein
   bhi wahi key add karein — inka structure hamesha English ke saath 100%
   match hona chahiye (koi missing/extra key nahi). Naya locale add karna ho
   to `src/locales/index.ts` ke `locales` object aur `LOCALE_NAMES` mein bhi
   add karein; RTL script ho to `RTL_LOCALES` set mein bhi.
3. Component mein `const { t } = useI18n();` (`@/components/I18nProvider`
   se) le kar `t("group.key")` use karein.
4. Bold/italic/code chahiye ho to locale string mein hi
   `**bold**` / `*italic*` / `` `code` `` likhein aur component mein
   `renderRich(t("..."))` se render karein — har translation apni jagah
   emphasis khud carry karti hai, JSX todne ki zaroorat nahi.
5. Kisi JSX element (jaisa `<Link>`) ko translated sentence ke beech mein
   daalna ho to locale string mein `{tokenName}` rakhein aur
   `interpolate(t("..."), { tokenName: <Link>...</Link> })` use karein
   (dekhein `page.tsx` ka `setupWarning`).
6. Number/string values inject karni hon (jaisa model count) to
   `fmt(t("..."), { count: n })` use karein — `{count}` token replace ho
   jayega.

**Memory:** naya key kahan add kiya, kaunse 5 (ya zyada) locales update kiye.

---

## Skill: Model overrides table (proxy.js) mein naya model add karna

Jab koi naya NVIDIA model non-standard request/response shape maange
(reasoning ke liye alag field, ya safety-model jaisa feature-config), usay
`proxy.js` ke `MODEL_OVERRIDES` object mein add karein — code translation
logic (`anthropicToOpenAI`) ko chhedne ki zaroorat nahi.

**Zaroori sabaq (production bug se):** kabhi bhi ek model ki reasoning_effort
value doosre model par "guess" na karein, chahe dono similar lagein. Kimi K3
sirf `low`/`high`/`max` accept karta hai (`medium` par `400` deta hai) — koi
universal scale nahi hai jise assume kiya ja sake. Har model ki value uske
**apne** NVIDIA example se lein, hardcoded/fixed rakhein — global setting se
in models ko bilkul unaffected rehna chahiye.

1. NVIDIA ke official code example se exact fields confirm karein (docs se
   bhi verify karein agar mumkin ho — sirf example code par bharosa na karein,
   kabhi kabhi placeholder values hoti hain).
2. **Pehle decide karein: model reasoning support karta hai ya nahi?**
   - Nahi karta (example mein koi reasoning field kahin nahi hai) →
     `{ mode: "none" }`. Global `REASONING_EFFORT` bhi is model tak nahi
     pahunchni chahiye.
   - Top-level `reasoning_effort` string leta hai → `reasoningEffortValue:
     "max"` (ya jo bhi exact value NVIDIA ke example mein hai) — **fixed**,
     global setting se koi lena dena nahi.
   - Nested `chat_template_kwargs` mein effort chahiye → wahan bhi seedha
     wahi fixed value likhein (`reasoning_effort: "high"` jaisa), koi
     `REASONING_EFFORT` reference nahi.
3. `MODEL_OVERRIDES["model/id"]` mein baaki entries add karein:
   - `dropTopLevelReasoningEffort: true` — top-level field hata do (jab
     `chatTemplateKwargs`/`reasoningBudget` route use ho raha ho)
   - `chatTemplateKwargs: () => ({...})` — `chat_template_kwargs` mein
     merge karne wali fields
   - `reasoningBudget: true` — top-level `reasoning_budget` bhejna ho
     (`REASONING_BUDGET` env var se)
4. Agar response ka reasoning field alag naam se aata ho (jaisa `reasoning`
   bajaye `reasoning_content`), `openaiToAnthropic()` aur `pipeStream()`
   dono jagah check karein — dono independently parse karte hain.
5. Mock upstream server ke against test karein: kam se kam 2-3 alag global
   `REASONING_EFFORT` values ke saath (taake confirm ho model ki fixed
   value in sab mein SAME rehti hai, global se change nahi hoti) — dekhein
   is session ka test pattern (10 cases, 4 global settings, sab pass hue).
   **Agar mumkin ho to ek real NVIDIA API call se bhi confirm karein** —
   ye bug pehli baar sirf real request se pakda gaya tha, mock test se
   nahi (mock sirf shape verify karta hai, value ki validity nahi).

**Memory:** naya model, `mode: "none"` ya `reasoningEffortValue` kya di,
docs/real-request se verify kiya ya sirf example code se assume kiya.

---

## Skill: Icons generate karna (build se pehle)

```bash
pnpm app:icon ./logo.png
```

Koi bhi square PNG (512px+). `src-tauri/icons/` mein saare sizes ban jayenge.
Ye har baar chalayein jab logo badle.

**Memory:** logo kab/kyun badla (agar badla).
