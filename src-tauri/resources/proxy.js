#!/usr/bin/env node
/**
 * ZaheerAI proxy  —  Anthropic Messages API  <->  NVIDIA NIM (OpenAI format)
 *
 * ZERO dependencies. Node >= 20 required (uses built-in fetch + http).
 * Ye file akeli chalti hai — na npm install, na node_modules.
 *
 *   Claude Code --(Anthropic /v1/messages)--> THIS --(OpenAI /v1/chat/completions)--> NVIDIA
 *   Claude Code <--(Anthropic SSE)---------- THIS <--(OpenAI SSE)------------------- NVIDIA
 *
 * Config env vars se aati hai. Agar saath mein .env file ho to wo bhi parse
 * ho jati hai (env vars ki priority zyada hai).
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// ======================================================
// .env (optional)
// ======================================================

(function loadDotenv() {
    const file = process.env.ENV_FILE || path.join(process.cwd(), ".env");
    if (!fs.existsSync(file)) return;
    try {
        for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const i = line.indexOf("=");
            if (i === -1) continue;
            const k = line.slice(0, i).trim();
            let v = line.slice(i + 1).trim();
            if (
                (v.startsWith('"') && v.endsWith('"')) ||
                (v.startsWith("'") && v.endsWith("'"))
            ) {
                v = v.slice(1, -1);
            }
            if (!(k in process.env)) process.env[k] = v;
        }
    } catch {
        /* ignore */
    }
})();

// ======================================================
// CONFIG
// ======================================================

const PORT = Number(process.env.PORT || 3000);

const UPSTREAM_BASE_URL = (
    process.env.UPSTREAM_BASE_URL || "https://integrate.api.nvidia.com/v1"
).replace(/\/+$/, "");

const UPSTREAM_API_KEY = process.env.UPSTREAM_API_KEY || "";

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "moonshotai/kimi-k3";
const SMALL_MODEL = process.env.SMALL_MODEL || DEFAULT_MODEL;

const FORCE_DEFAULT_MODEL =
    String(process.env.FORCE_DEFAULT_MODEL || "true") === "true";

const MAX_TOKENS_LIMIT = Number(process.env.MAX_TOKENS_LIMIT || 16384);
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT || 600000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const TEMPERATURE =
    process.env.TEMPERATURE === undefined || process.env.TEMPERATURE === ""
        ? null
        : Number(process.env.TEMPERATURE);

const REASONING_EFFORT = process.env.REASONING_EFFORT || "";

// Kuch models (jaisa "reasoning" family ke naam wale) top-level
// `reasoning_effort` ke bajaye `reasoning_budget` (token count) maangte hain.
// Dekhein MODEL_OVERRIDES neeche.
const REASONING_BUDGET = Number(process.env.REASONING_BUDGET || 16384);

const INCLUDE_REASONING =
    String(process.env.INCLUDE_REASONING || "false") === "true";

const PROXY_SECRET = process.env.PROXY_SECRET || "";
const DEBUG = String(process.env.DEBUG || "false") === "true";

const VERSION = "3.0.0";

// ======================================================
// PER-MODEL REASONING CONFIG
// ======================================================
//
// ASAL MASLA #1 (fixed pehle): `reasoning_effort` ki ek hi global value
// har model ko bheji ja rahi thi, jabke har model alag field/shape
// maangta hai — kuch top-level, kuch nested `chat_template_kwargs` mein.
//
// ASAL MASLA #2 (is fix mein): maine socha tha sab models ek shared
// 4-level scale (low/medium/high/max) accept karte hain aur global
// setting se "cap" kiya ja sakta hai. **Ye galat nikla** — production mein
// confirm hua:
//
//   Unsupported Kimi K3 thinking_effort="medium";
//   supported values are low, high, and max
//
// Matlab Kimi K3 "medium" accept hi nahi karta. Har model ka apna alag,
// chhota enum ho sakta hai — koi universal scale nahi hai jise assume
// kiya ja sake.
//
// **Naya (safe) design:** koi scale, koi capping nahi. Har catalogued
// model ko sirf wahi value milti hai jo NVIDIA ke apne working code
// example mein thi — fixed, hardcoded, global `REASONING_EFFORT` se
// bilkul unaffected. Global setting ab sirf un models ke liye matter
// karti hai jo is table mein catalogued hi nahi (naye/unknown models,
// jahan hamare paas model-specific verified value nahi hai — wahan
// best-effort default hi chal sakta hai).
//
// Models jo reasoning support hi nahi karte (`mode: "none"`) — unhe koi
// reasoning field bilkul nahi milega.
//
// Naya model add karte waqt: NVIDIA ke example mein jo exact value ho
// wahi yahan likhein — kisi doosre model ki value "similar hogi" jaisa
// guess na karein (Kimi K3 wala bug isi guess se aaya tha).

const MODEL_OVERRIDES = {
    // ---- top-level reasoning_effort — NVIDIA ke apne example ki fixed value ----
    // Confirmed error se: "medium" invalid hai, sirf low/high/max chalte
    // hain. Example khud "max" use karta hai, isay fixed rakha hai.
    // seed:0 bhi example mein hai — harmless (reproducibility ke liye),
    // fixed rakha.
    "moonshotai/kimi-k3": {
        reasoningEffortValue: "max",
        seed: 0,
        maxTokensCeiling: 16384,
    },

    // deepseek-v4.1-flash — v4-flash-0731 ki jagah naya model id. Naya
    // NVIDIA example bilkul plain hai (koi reasoning field nahi, sirf
    // temperature/top_p/max_tokens/stream) — is liye "none" mode, lekin
    // capacity bohot zyada hai (262144) is liye maxTokensCeiling upar
    // rakhi.
    "deepseek-ai/deepseek-v4.1-flash": {
        mode: "none",
        maxTokensCeiling: 262144,
    },

    // ---- chat_template_kwargs: {enable_thinking: true} — boolean hai, ----
    // ---- effort scale involved nahi, koi budget bhi nahi ----
    "google/diffusiongemma-26b-a4b-it": {
        dropTopLevelReasoningEffort: true,
        chatTemplateKwargs: () => ({ enable_thinking: true }),
    },
    "nvidia/nemotron-3-ultra-550b-a55b": {
        dropTopLevelReasoningEffort: true,
        chatTemplateKwargs: () => ({ enable_thinking: true }),
    },

    // ---- reasoning_budget (top-level) + chat_template_kwargs.enable_thinking ----
    "nvidia/nemotron-3.5-lightning-30b-a3b": {
        dropTopLevelReasoningEffort: true,
        reasoningBudget: true,
        chatTemplateKwargs: () => ({ enable_thinking: true }),
    },

    // ---- sirf reasoning_budget (top-level) ----
    // Example mein max_tokens 65536 hai — global default (16384) se
    // zyada, is liye ceiling upar rakhi.
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": {
        dropTopLevelReasoningEffort: true,
        reasoningBudget: true,
        maxTokensCeiling: 65536,
    },

    // ---- Safety/moderation classifier — reasoning nahi, feature-config ----
    // hai: `request_categories: "/categories"` se detailed category
    // breakdown milta hai (NVIDIA docs se verified), warna sirf verdict.
    "nvidia/nemotron-3.5-content-safety": {
        dropTopLevelReasoningEffort: true,
        chatTemplateKwargs: () => ({
            enable_thinking: true,
            request_categories: "/categories",
        }),
    },

    // ---- Non-reasoning models — NVIDIA ke inke apne example mein koi ----
    // reasoning field kahin nahi hai. Global REASONING_EFFORT bhi in tak
    // nahi pahunchni chahiye. maxTokensCeiling sirf wahan di hai jahan
    // example ki value global default (16384) se zyada thi — chhoti
    // example values (512, 1024, 5) ko hard-limit nahi maana, wo sirf
    // demo ke liye task-appropriate default thi, capacity ka proof nahi.
    "mistralai/mistral-nemotron": { mode: "none" },
    "meta/muse-glimmer-30b": { mode: "none" },
    "poolside/laguna-xs-2.1": { mode: "none" },
    "z-ai/glm-5.3": { mode: "none" },
    "z-ai/glm-5.3-flash": { mode: "none" },
    "nvidia/nemotron-3-super-120b-a12b": { mode: "none" },
    "nvidia/llama-3.1-nemotron-safety-guard-8b-v3": { mode: "none" },
    "meta/llama-guard-4-12b": { mode: "none" },
    "meta/llama-3.2-11b-vision-instruct": { mode: "none" },
    "meta/llama-3.2-90b-vision-instruct": { mode: "none" },
    // gemma example seed:0 use karta hai — fixed rakha, harmless.
    "google/gemma-4-31b-it": { mode: "none", seed: 0 },
    // example max_tokens 32768 hai, global se zyada.
    "nvidia/ising-calibration-1.5-31b": { mode: "none", maxTokensCeiling: 32768 },
    // gpt-oss-20b hamesha reasoning_content deta hai bina kisi request
    // field ke — ise chhedne ki zaroorat hi nahi.
    "openai/gpt-oss-20b": { mode: "none" },
};

function applyModelOverrides(payload) {
    const cfg = MODEL_OVERRIDES[payload.model];
    if (!cfg) return payload; // uncatalogued model: purana default (global top-level effort)

    if (cfg.mode === "none" || cfg.dropTopLevelReasoningEffort) {
        delete payload.reasoning_effort;
    }

    if (cfg.reasoningEffortValue) payload.reasoning_effort = cfg.reasoningEffortValue;

    if (cfg.chatTemplateKwargs) {
        payload.chat_template_kwargs = {
            ...(payload.chat_template_kwargs || {}),
            ...cfg.chatTemplateKwargs(),
        };
    }

    if (cfg.reasoningBudget) payload.reasoning_budget = REASONING_BUDGET;

    if (typeof cfg.seed === "number") payload.seed = cfg.seed;

    return payload;
}

// ======================================================
// LOGGING  (Tauri UI ye lines parse kar ke colour karta hai)
// ======================================================

function stamp() {
    return new Date().toTimeString().slice(0, 8);
}
const info = (...a) => console.log(`[${stamp()}] INFO  ${a.join(" ")}`);
const warn = (...a) => console.log(`[${stamp()}] WARN  ${a.join(" ")}`);
const fail = (...a) => console.log(`[${stamp()}] ERROR ${a.join(" ")}`);
const dbg = (...a) => {
    if (DEBUG) console.log(`[${stamp()}] DEBUG ${a.join(" ")}`);
};

// ======================================================
// HELPERS
// ======================================================

let TOTAL = 0;
let OK = 0;
let ERR = 0;
const STARTED = Date.now();

const rid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickModel(requested) {
    if (FORCE_DEFAULT_MODEL) return DEFAULT_MODEL;
    if (!requested) return DEFAULT_MODEL;
    if (/haiku|small|fast/i.test(requested)) return SMALL_MODEL;
    if (requested.includes("/")) return requested;
    return DEFAULT_MODEL;
}

// ======================================================
// ANTHROPIC -> OPENAI
// ======================================================

function systemToText(system) {
    if (!system) return "";
    if (typeof system === "string") return system;
    if (Array.isArray(system)) {
        return system
            .filter(b => b && b.type === "text" && b.text)
            .map(b => b.text)
            .join("\n\n");
    }
    return "";
}

function toolResultToText(content) {
    if (content == null) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map(b => {
                if (typeof b === "string") return b;
                if (b.type === "text") return b.text || "";
                if (b.type === "image") return "[image omitted]";
                return JSON.stringify(b);
            })
            .filter(Boolean)
            .join("\n");
    }
    return JSON.stringify(content);
}

/** Claude Code draft-07 schemas bhejta hai; kuch keys NIM reject karta hai. */
function cleanSchema(schema) {
    if (schema == null || typeof schema !== "object") return schema;
    if (Array.isArray(schema)) return schema.map(cleanSchema);

    const out = {};
    for (const [k, v] of Object.entries(schema)) {
        if (k === "$schema" || k === "$id" || k === "additionalProperties") continue;
        out[k] = cleanSchema(v);
    }
    if (out.type === "object" && !out.properties) out.properties = {};
    return out;
}

function anthropicToOpenAI(body) {
    const messages = [];

    const sys = systemToText(body.system);
    if (sys.trim()) messages.push({ role: "system", content: sys });

    for (const msg of body.messages || []) {
        const role = msg.role === "assistant" ? "assistant" : "user";

        if (typeof msg.content === "string") {
            if (msg.content) messages.push({ role, content: msg.content });
            continue;
        }

        const blocks = Array.isArray(msg.content) ? msg.content : [];

        if (role === "user") {
            // tool_result -> apne alag `tool` messages, baaki content se pehle
            for (const b of blocks) {
                if (b.type !== "tool_result") continue;
                messages.push({
                    role: "tool",
                    tool_call_id: b.tool_use_id,
                    content: toolResultToText(b.content) || "(no output)"
                });
            }

            const parts = [];
            for (const b of blocks) {
                if (b.type === "text" && b.text) {
                    parts.push({ type: "text", text: b.text });
                } else if (b.type === "image" && b.source) {
                    const url =
                        b.source.type === "base64"
                            ? `data:${b.source.media_type};base64,${b.source.data}`
                            : b.source.url;
                    if (url) parts.push({ type: "image_url", image_url: { url } });
                }
            }

            if (parts.length) {
                const allText = parts.every(p => p.type === "text");
                messages.push({
                    role: "user",
                    content: allText ? parts.map(p => p.text).join("\n") : parts
                });
            }
            continue;
        }

        let text = "";
        const toolCalls = [];
        for (const b of blocks) {
            if (b.type === "text") text += b.text || "";
            else if (b.type === "tool_use") {
                toolCalls.push({
                    id: b.id,
                    type: "function",
                    function: {
                        name: b.name,
                        arguments: JSON.stringify(b.input || {})
                    }
                });
            }
            // thinking / redacted_thinking -> drop
        }

        const m = { role: "assistant", content: text || null };
        if (toolCalls.length) m.tool_calls = toolCalls;
        if (m.content || m.tool_calls) messages.push(m);
    }

    const resolvedModel = pickModel(body.model);
    // Zyadatar models ke liye global MAX_TOKENS_LIMIT hi ceiling hai. Kuch
    // models (jaisa deepseek-v4.1-flash, 262144 tak) ki apni bataayi hui
    // capacity global default se kahin zyada hai — unke liye
    // MODEL_OVERRIDES.maxTokensCeiling use hoti hai (sirf UPAR — kabhi
    // neeche clamp nahi karte chhoti example values se, wo sirf
    // NVIDIA ke demo ka default tha, hard limit nahi).
    const modelCeiling = Math.max(
        MAX_TOKENS_LIMIT,
        MODEL_OVERRIDES[resolvedModel]?.maxTokensCeiling || 0
    );

    const out = {
        model: resolvedModel,
        messages,
        max_tokens: Math.min(Number(body.max_tokens) || modelCeiling, modelCeiling)
    };

    if (typeof body.temperature === "number") out.temperature = body.temperature;
    else if (TEMPERATURE !== null && !Number.isNaN(TEMPERATURE))
        out.temperature = TEMPERATURE;

    if (typeof body.top_p === "number") out.top_p = body.top_p;

    if (Array.isArray(body.stop_sequences) && body.stop_sequences.length)
        out.stop = body.stop_sequences;

    if (REASONING_EFFORT) out.reasoning_effort = REASONING_EFFORT;

    // Anthropic ke server-side tools (web_search_*) mein input_schema nahi hota
    const tools = (body.tools || []).filter(t => t && t.name && t.input_schema);
    if (tools.length) {
        out.tools = tools.map(t => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description || "",
                parameters: cleanSchema(t.input_schema)
            }
        }));

        const tc = body.tool_choice;
        if (tc) {
            if (tc.type === "auto") out.tool_choice = "auto";
            else if (tc.type === "any") out.tool_choice = "required";
            else if (tc.type === "none") out.tool_choice = "none";
            else if (tc.type === "tool" && tc.name)
                out.tool_choice = { type: "function", function: { name: tc.name } };
        }
    }

    return applyModelOverrides(out);
}

// ======================================================
// OPENAI -> ANTHROPIC
// ======================================================

function mapStopReason(finishReason, hasToolCalls) {
    if (hasToolCalls) return "tool_use";
    if (finishReason === "length") return "max_tokens";
    if (finishReason === "tool_calls" || finishReason === "function_call")
        return "tool_use";
    return "end_turn";
}

function openaiToAnthropic(data, requestedModel) {
    const choice = (data.choices && data.choices[0]) || {};
    const msg = choice.message || {};
    const content = [];

    // Zyadatar models `reasoning_content` bhejte hain, lekin kuch
    // (deepseek-v4-flash) `reasoning` — dono check karo.
    const reasoningText = msg.reasoning_content || msg.reasoning;
    if (INCLUDE_REASONING && reasoningText)
        content.push({ type: "text", text: reasoningText });
    if (msg.content) content.push({ type: "text", text: msg.content });

    const toolCalls = msg.tool_calls || [];
    for (const tc of toolCalls) {
        let input = {};
        try {
            input = JSON.parse(tc.function?.arguments || "{}");
        } catch {
            input = {};
        }
        content.push({
            type: "tool_use",
            id: tc.id || `toolu_${rid()}`,
            name: tc.function?.name || "unknown",
            input
        });
    }

    if (!content.length) content.push({ type: "text", text: "" });

    return {
        id: `msg_${String(data.id || rid()).replace(/[^a-zA-Z0-9_-]/g, "")}`,
        type: "message",
        role: "assistant",
        model: requestedModel || data.model || DEFAULT_MODEL,
        content,
        stop_reason: mapStopReason(choice.finish_reason, toolCalls.length > 0),
        stop_sequence: null,
        usage: {
            input_tokens: data.usage?.prompt_tokens || 0,
            output_tokens: data.usage?.completion_tokens || 0
        }
    };
}

// ======================================================
// UPSTREAM
// ======================================================

async function callUpstream(payload, signal) {
    let lastErr;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const timer = new AbortController();
        const onAbort = () => timer.abort();
        signal?.addEventListener("abort", onAbort, { once: true });
        const t = setTimeout(() => timer.abort(), REQUEST_TIMEOUT);

        try {
            info(
                `-> upstream ${attempt}/${MAX_RETRIES}  model=${payload.model}  stream=${!!payload.stream}  msgs=${payload.messages.length}  tools=${payload.tools?.length || 0}`
            );

            const res = await fetch(`${UPSTREAM_BASE_URL}/chat/completions`, {
                method: "POST",
                signal: timer.signal,
                headers: {
                    Authorization: `Bearer ${UPSTREAM_API_KEY}`,
                    "Content-Type": "application/json",
                    Accept: payload.stream ? "text/event-stream" : "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                clearTimeout(t);
                signal?.removeEventListener("abort", onAbort);
                return res;
            }

            const text = await res.text().catch(() => "");
            const err = new Error(text || `HTTP ${res.status}`);
            err.status = res.status;
            err.bodyText = text;

            warn(`upstream HTTP ${res.status}`);
            dbg(text.slice(0, 1500));

            if (!RETRY_STATUS.has(res.status) || attempt === MAX_RETRIES) throw err;

            const ra = Number(res.headers.get("retry-after"));
            const delay = ra ? ra * 1000 : Math.min(2 ** attempt * 1000, 20000);
            info(`retrying in ${delay / 1000}s`);
            lastErr = err;
            await sleep(delay);
        } catch (e) {
            lastErr = e;
            if (e.status && RETRY_STATUS.has(e.status) && attempt < MAX_RETRIES) {
                continue;
            }
            throw e;
        } finally {
            clearTimeout(t);
            signal?.removeEventListener("abort", onAbort);
        }
    }

    throw lastErr;
}

// ======================================================
// STREAM TRANSLATION
// ======================================================

async function pipeStream(upstreamRes, res, requestedModel) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
    });

    const sse = (type, payload) =>
        res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);

    sse("message_start", {
        type: "message_start",
        message: {
            id: `msg_${rid()}`,
            type: "message",
            role: "assistant",
            model: requestedModel || DEFAULT_MODEL,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
        }
    });

    let blockIndex = -1;
    let textOpen = false;
    let finishReason = null;
    let usage = null;
    const toolBuf = new Map();

    const ping = setInterval(() => sse("ping", { type: "ping" }), 15000);

    const openText = () => {
        if (textOpen) return;
        blockIndex++;
        textOpen = true;
        sse("content_block_start", {
            type: "content_block_start",
            index: blockIndex,
            content_block: { type: "text", text: "" }
        });
    };

    const emitText = text => {
        openText();
        sse("content_block_delta", {
            type: "content_block_delta",
            index: blockIndex,
            delta: { type: "text_delta", text }
        });
    };

    try {
        const reader = upstreamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop();

            for (const ev of events) {
                const line = ev.split("\n").find(l => l.startsWith("data:"));
                if (!line) continue;

                const raw = line.slice(5).trim();
                if (!raw || raw === "[DONE]") continue;

                let parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    continue;
                }

                if (parsed.usage) usage = parsed.usage;

                for (const choice of parsed.choices || []) {
                    const delta = choice.delta || {};
                    if (choice.finish_reason) finishReason = choice.finish_reason;

                    const reasoningDelta = delta.reasoning_content || delta.reasoning;
                    if (INCLUDE_REASONING && reasoningDelta) emitText(reasoningDelta);
                    if (delta.content) emitText(delta.content);

                    for (const tc of delta.tool_calls || []) {
                        const i = tc.index ?? 0;
                        if (!toolBuf.has(i))
                            toolBuf.set(i, { id: "", name: "", args: "" });
                        const slot = toolBuf.get(i);
                        if (tc.id) slot.id = tc.id;
                        if (tc.function?.name) slot.name += tc.function.name;
                        if (tc.function?.arguments) slot.args += tc.function.arguments;
                    }
                }
            }
        }
    } catch (e) {
        fail("stream aborted:", e.message);
    }

    clearInterval(ping);

    if (textOpen)
        sse("content_block_stop", { type: "content_block_stop", index: blockIndex });

    const tools = [...toolBuf.entries()].sort((a, b) => a[0] - b[0]);

    for (const [, slot] of tools) {
        blockIndex++;
        sse("content_block_start", {
            type: "content_block_start",
            index: blockIndex,
            content_block: {
                type: "tool_use",
                id: slot.id || `toolu_${rid()}`,
                name: slot.name || "unknown",
                input: {}
            }
        });

        let args = slot.args.trim() || "{}";
        try {
            args = JSON.stringify(JSON.parse(args));
        } catch {
            warn(`tool "${slot.name}" ne invalid JSON args diye, {} bhej raha hoon`);
            dbg(args.slice(0, 500));
            args = "{}";
        }

        sse("content_block_delta", {
            type: "content_block_delta",
            index: blockIndex,
            delta: { type: "input_json_delta", partial_json: args }
        });
        sse("content_block_stop", { type: "content_block_stop", index: blockIndex });
    }

    if (blockIndex === -1) {
        sse("content_block_start", {
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" }
        });
        sse("content_block_stop", { type: "content_block_stop", index: 0 });
    }

    sse("message_delta", {
        type: "message_delta",
        delta: {
            stop_reason: mapStopReason(finishReason, tools.length > 0),
            stop_sequence: null
        },
        usage: { output_tokens: usage?.completion_tokens || 0 }
    });
    sse("message_stop", { type: "message_stop" });
    res.end();

    info(
        `<- done  text=${textOpen ? "yes" : "no"}  tools=${tools.length}  out_tokens=${usage?.completion_tokens || 0}`
    );
}

// ======================================================
// HTTP PLUMBING
// ======================================================

function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
    });
    res.end(body);
}

function sendError(res, status, type, message) {
    sendJson(res, status, {
        type: "error",
        error: { type, message: String(message).slice(0, 2000) }
    });
}

const ERROR_TYPES = {
    400: "invalid_request_error",
    401: "authentication_error",
    403: "permission_error",
    404: "not_found_error",
    413: "invalid_request_error",
    422: "invalid_request_error",
    429: "rate_limit_error",
    500: "api_error",
    502: "api_error",
    503: "overloaded_error",
    504: "api_error"
};

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", c => {
            size += c.length;
            if (size > 200 * 1024 * 1024) {
                reject(new Error("body too large"));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error("invalid JSON body"));
            }
        });
        req.on("error", reject);
    });
}

function statusPayload() {
    return {
        status: "ok",
        provider: "ZaheerAI -> NVIDIA NIM",
        version: VERSION,
        upstream: UPSTREAM_BASE_URL,
        model: DEFAULT_MODEL,
        small_model: SMALL_MODEL,
        force_model: FORCE_DEFAULT_MODEL,
        max_tokens_limit: MAX_TOKENS_LIMIT,
        reasoning_effort: REASONING_EFFORT || null,
        uptime_seconds: Math.floor((Date.now() - STARTED) / 1000),
        requests: TOTAL,
        success: OK,
        errors: ERR
    };
}

function countTokens(body) {
    let chars = systemToText(body.system).length;
    for (const m of body.messages || []) {
        if (typeof m.content === "string") chars += m.content.length;
        else
            for (const b of m.content || []) {
                if (b.type === "text") chars += (b.text || "").length;
                else if (b.type === "tool_use")
                    chars += JSON.stringify(b.input || {}).length;
                else if (b.type === "tool_result")
                    chars += toolResultToText(b.content).length;
                else if (b.type === "image") chars += 6000;
            }
    }
    for (const t of body.tools || []) chars += JSON.stringify(t).length;
    return Math.ceil(chars / 3.6);
}

const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, "http://localhost");
    const route = url.pathname.replace(/\/+$/, "") || "/";

    TOTAL++;
    res.on("finish", () => {
        if (res.statusCode < 400) OK++;
        else ERR++;
        if (route !== "/health")
            info(
                `[${res.statusCode}] ${req.method} ${route} ${Date.now() - started}ms`
            );
    });

    // CORS (kuch tools preflight bhejte hain)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    if (req.method === "GET") {
        if (route === "/" || route === "/health" || route === "/metrics")
            return sendJson(res, 200, statusPayload());

        if (route === "/v1/models") {
            const ids = [...new Set([DEFAULT_MODEL, SMALL_MODEL])];
            return sendJson(res, 200, {
                object: "list",
                data: ids.map(id => ({
                    id,
                    type: "model",
                    display_name: id,
                    created_at: new Date(0).toISOString()
                }))
            });
        }
    }

    // auth (sirf tab jab PROXY_SECRET set ho)
    if (PROXY_SECRET && route.startsWith("/v1")) {
        const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        const key = req.headers["x-api-key"] || "";
        if (bearer !== PROXY_SECRET && key !== PROXY_SECRET)
            return sendError(res, 401, "authentication_error", "Invalid token");
    }

    if (req.method === "POST" && route === "/v1/messages/count_tokens") {
        try {
            const body = await readBody(req);
            return sendJson(res, 200, { input_tokens: countTokens(body) });
        } catch (e) {
            return sendError(res, 400, "invalid_request_error", e.message);
        }
    }

    if (req.method === "POST" && route === "/v1/messages") {
        let body;
        try {
            body = await readBody(req);
        } catch (e) {
            return sendError(res, 400, "invalid_request_error", e.message);
        }

        if (!UPSTREAM_API_KEY)
            return sendError(
                res,
                401,
                "authentication_error",
                "UPSTREAM_API_KEY set nahi hai"
            );

        const wantsStream = body.stream === true;
        const ac = new AbortController();
        req.on("close", () => ac.abort());

        try {
            const payload = anthropicToOpenAI(body);

            info("──────────────────────────────────────────");
            info(`requested: ${body.model || "(none)"}   ->   upstream: ${payload.model}`);
            info(
                `stream=${wantsStream}  tools=${payload.tools?.length || 0}  max_tokens=${payload.max_tokens}`
            );
            if (MODEL_OVERRIDES[payload.model]) {
                info(`model override applied: ${payload.model}`);
            }
            dbg(JSON.stringify(payload).slice(0, 3000));

            if (wantsStream) {
                payload.stream = true;
                payload.stream_options = { include_usage: true };
                const upstream = await callUpstream(payload, ac.signal);
                return await pipeStream(upstream, res, body.model);
            }

            const upstream = await callUpstream(payload, ac.signal);
            const data = await upstream.json();
            return sendJson(res, 200, openaiToAnthropic(data, body.model));
        } catch (err) {
            const status = err.status || 500;

            let detail = err.bodyText || err.message;
            try {
                const j = JSON.parse(err.bodyText || "");
                detail = j.detail || j.error?.message || j.message || detail;
                if (typeof detail === "object") detail = JSON.stringify(detail);
            } catch {
                /* plain text */
            }

            fail(`${status}  ${String(detail).slice(0, 400)}`);

            if (res.headersSent) return res.end();
            return sendError(
                res,
                status,
                ERROR_TYPES[status] || "api_error",
                detail
            );
        }
    }

    return sendError(res, 404, "not_found_error", `No route for ${req.method} ${route}`);
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 120000;

server.on("error", e => {
    if (e.code === "EADDRINUSE")
        fail(`Port ${PORT} pehle se istemal mein hai. Koi aur port chunein.`);
    else fail(e.message);
    process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[${stamp()}] INFO  ════════════════════════════════════════`);
    info(`ZaheerAI proxy v${VERSION}  (node ${process.version})`);
    info(`listening      http://127.0.0.1:${PORT}`);
    info(`upstream       ${UPSTREAM_BASE_URL}`);
    info(`model          ${DEFAULT_MODEL}`);
    info(`small model    ${SMALL_MODEL}`);
    info(`force model    ${FORCE_DEFAULT_MODEL}`);
    info(`max tokens     ${MAX_TOKENS_LIMIT}`);
    info(`reasoning      ${REASONING_EFFORT || "(not sent)"}  (budget for override models: ${REASONING_BUDGET})`);
    info(`model overrides ${Object.keys(MODEL_OVERRIDES).length} models`);
    info(`api key        ${UPSTREAM_API_KEY ? "set" : "MISSING"}`);
    console.log(`[${stamp()}] INFO  ════════════════════════════════════════`);
});

function shutdown() {
    info("shutting down...");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
