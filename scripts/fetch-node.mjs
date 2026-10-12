#!/usr/bin/env node
/**
 * Node ka ek portable copy download kar ke Tauri "sidecar" binary ke taur
 * par `src-tauri/binaries/` mein stage karta hai — taake end users ko khud
 * Node install na karna pade. App runtime par isi bundled Node se
 * `proxy.js` chalata hai (dekhein `src-tauri/src/proxy.rs`).
 *
 * `pnpm app:build` se pehle khud chal jata hai (`tauri.conf.json` ka
 * `beforeBundleCommand`). Manually chalane ke liye: `pnpm fetch:node`
 *
 * Agar sidecar staged na ho (ye script kabhi na chalayein), app system
 * PATH ke `node` par fallback kar leta hai — dev ke liye kaafi hai, lekin
 * distribution ke liye ye script chalana zaroori hai.
 */

import { createWriteStream, existsSync, mkdirSync, chmodSync, renameSync, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

// LTS version — proxy.js sirf Node 20+ ka built-in `fetch` maangta hai, is
// se zyada kuch nahi. Badalna ho to bas ye string badal dein.
const NODE_VERSION = "24.19.0";

const PLATFORM_MAP = {
  "win32-x64": {
    triple: "x86_64-pc-windows-msvc",
    dist: "win-x64",
    archiveExt: "zip",
    exeInArchive: "node.exe",
  },
  "darwin-x64": {
    triple: "x86_64-apple-darwin",
    dist: "darwin-x64",
    archiveExt: "tar.gz",
    exeInArchive: "bin/node",
  },
  "darwin-arm64": {
    triple: "aarch64-apple-darwin",
    dist: "darwin-arm64",
    archiveExt: "tar.gz",
    exeInArchive: "bin/node",
  },
  "linux-x64": {
    triple: "x86_64-unknown-linux-gnu",
    dist: "linux-x64",
    archiveExt: "tar.gz",
    exeInArchive: "bin/node",
  },
  "linux-arm64": {
    triple: "aarch64-unknown-linux-gnu",
    dist: "linux-arm64",
    archiveExt: "tar.gz",
    exeInArchive: "bin/node",
  },
};

const key = `${process.platform}-${process.arch}`;
const target = PLATFORM_MAP[key];

if (!target) {
  console.error(
    `Ye platform (${key}) is script mein mapped nahi hai.\n` +
      `scripts/fetch-node.mjs ke PLATFORM_MAP mein naya entry add karein — ` +
      `Tauri ke target-triple naming convention ke hisaab se ` +
      `(https://tauri.app/develop/sidecar/ dekhein).`,
  );
  process.exit(1);
}

const isWindows = target.triple.includes("windows");
const outDir = path.join(process.cwd(), "src-tauri", "binaries");
mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, `node-${target.triple}${isWindows ? ".exe" : ""}`);

if (existsSync(outPath)) {
  console.log(`Pehle se staged hai: ${outPath}`);
  console.log("Dobara fetch karna ho (naya version) to pehle ye file delete kar dein.");
  process.exit(0);
}

const archiveName = `node-v${NODE_VERSION}-${target.dist}.${target.archiveExt}`;
const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}`;

const tmpDir = path.join(os.tmpdir(), `zaheerai-node-fetch-${Date.now()}`);
mkdirSync(tmpDir, { recursive: true });
const archivePath = path.join(tmpDir, archiveName);

console.log(`Downloading ${url}`);

const res = await fetch(url);
if (!res.ok) {
  console.error(`Download fail: HTTP ${res.status} — URL check karein ya NODE_VERSION.`);
  process.exit(1);
}
await pipeline(res.body, createWriteStream(archivePath));

console.log("Extracting...");
// System `tar` cross-platform kaam karta hai: macOS/Linux par native, aur
// Windows 10 (1803+) ke bundled bsdtar `.zip` bhi extract kar sakta hai —
// is liye koi extra npm dependency nahi chahiye.
try {
  execFileSync("tar", ["-xf", archivePath, "-C", tmpDir], { stdio: "inherit" });
} catch (e) {
  console.error(
    "`tar` command chalane mein masla hua. Windows par ye sirf 1803+ mein\n" +
      "built-in hota hai. Manually extract kar ke, node.exe ko yahan copy\n" +
      `kar dein: ${outPath}`,
  );
  throw e;
}

const extractedDir = path.join(tmpDir, `node-v${NODE_VERSION}-${target.dist}`);
const srcExe = path.join(extractedDir, target.exeInArchive);

if (!existsSync(srcExe)) {
  console.error(`Extracted binary nahi mili: ${srcExe}\nArchive layout badal gaya ho sakta hai.`);
  process.exit(1);
}

renameSync(srcExe, outPath);
if (!isWindows) chmodSync(outPath, 0o755);

rmSync(tmpDir, { recursive: true, force: true });

console.log(`Staged: ${outPath}`);
console.log("Ab `pnpm app:build` is Node ko app ke andar bundle kar dega.");
