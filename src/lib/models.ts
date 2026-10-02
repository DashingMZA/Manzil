import type { CatalogEntry } from "./types";

/**
 * Ye app ka **poora aur sirf** model catalog hai — hardcoded, koi live
 * NVIDIA fetch nahi. Har model NVIDIA ke apne official code example se
 * verified hai (dekhein `src-tauri/resources/proxy.js` ka
 * `MODEL_OVERRIDES` — id yahan aur wahan match hona zaroori hai).
 *
 * Naya model add karna ho: pehle `proxy.js` ke `MODEL_OVERRIDES` mein uska
 * asal request-shape verify/add karein (agar zaroori ho), phir yahan entry
 * add karein. `agentic: true` sirf un models ko dein jo tool/function
 * calling support karte hain — Claude Code ka har kaam (file read/edit,
 * bash) ek tool call hai, is ke baghair model sirf baatein karega.
 *
 * `google/paligemma` aur `nvidia/kumo-relational` jaan-boojh kar yahan
 * NAHI hain — dono `/v1/chat/completions` use hi nahi karte (alag endpoint
 * / alag API shape), is proxy ke architecture se bahar hain (dekhein
 * MEMORY.md).
 */
export const MODEL_CATALOG: CatalogEntry[] = [
  // ---- Recommended for Claude Code (tool-calling capable) ----
  { id: "moonshotai/kimi-k3", category: "Text / General", agentic: true },
  { id: "deepseek-ai/deepseek-v4.1-flash", category: "Text / General", agentic: true },
  { id: "z-ai/glm-5.3", category: "Text / General", agentic: true },
  { id: "z-ai/glm-5.3-flash", category: "Text / General", agentic: true },
  { id: "nvidia/nemotron-3-super-120b-a12b", category: "Text / General", agentic: true },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", category: "Reasoning", agentic: true },
  { id: "nvidia/nemotron-3.5-lightning-30b-a3b", category: "Reasoning", agentic: true },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", category: "Reasoning", agentic: true },
  { id: "openai/gpt-oss-20b", category: "Reasoning", agentic: true },
  { id: "poolside/laguna-xs-2.1", category: "Coding", agentic: true },

  // ---- Text / General (chhote/helper models — tool-calling verified nahi) ----
  { id: "mistralai/mistral-nemotron", category: "Text / General", agentic: false },
  { id: "meta/muse-glimmer-30b", category: "Text / General", agentic: false },
  { id: "google/gemma-4-31b-it", category: "Text / General", agentic: false },

  // ---- Vision / Multimodal ----
  { id: "meta/llama-3.2-11b-vision-instruct", category: "Vision / Multimodal", agentic: false },
  { id: "meta/llama-3.2-90b-vision-instruct", category: "Vision / Multimodal", agentic: false },
  { id: "google/diffusiongemma-26b-a4b-it", category: "Vision / Multimodal", agentic: false },
  { id: "nvidia/ising-calibration-1.5-31b", category: "Vision / Multimodal", agentic: false },

  // ---- Safety / Moderation (classifiers — Claude Code ke liye nahi) ----
  { id: "meta/llama-guard-4-12b", category: "Safety / Moderation", agentic: false },
  {
    id: "nvidia/llama-3.1-nemotron-safety-guard-8b-v3",
    category: "Safety / Moderation",
    agentic: false,
  },
  { id: "nvidia/nemotron-3.5-content-safety", category: "Safety / Moderation", agentic: false },
];

export const RECOMMENDED_GROUP = "Recommended for Claude Code";

const GROUP_ORDER = [
  RECOMMENDED_GROUP,
  "Coding",
  "Reasoning",
  "Text / General",
  "Vision / Multimodal",
  "Safety / Moderation",
];

export interface ModelGroup {
  name: string;
  models: CatalogEntry[];
}

/**
 * Agentic models sab se upar apne group mein, baaki category ke hisaab se.
 * Claude Code ke liye tool calling zaroori hai — is liye wo distinction sab
 * se pehle dikhna chahiye.
 */
export function groupModels(entries: CatalogEntry[]): ModelGroup[] {
  const buckets = new Map<string, CatalogEntry[]>();

  for (const entry of entries) {
    const name = entry.agentic ? RECOMMENDED_GROUP : entry.category;
    const bucket = buckets.get(name);
    if (bucket) bucket.push(entry);
    else buckets.set(name, [entry]);
  }

  const known = GROUP_ORDER.filter((g) => buckets.has(g));
  const rest = [...buckets.keys()].filter((g) => !GROUP_ORDER.includes(g)).sort();

  return [...known, ...rest].map((name) => ({
    name,
    models: (buckets.get(name) ?? []).sort((a, b) => a.id.localeCompare(b.id)),
  }));
}
