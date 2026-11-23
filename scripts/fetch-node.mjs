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

import { createWriteStream, existsSync, mkdirSync, chmodSync, copyFileSync, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

// LTS version — proxy.js sirf Node 24+ ka built-in `fetch` maangta hai, is
// se zyada kuch nahi. Badalna ho to bas ye string badal dein.
const NODE_VERSION = "26.13.1";

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

// Kis target ke liye Node chahiye? Host machine ke hisaab se NAHI, balke
// build target ke hisaab se. Farq tab padta hai jab host aur target alag hon:
// GitHub ka `macos-latest` runner Apple Silicon (arm64) hai, lekin
// `--target x86_64-apple-darwin` wali leg ko Intel ka Node chahiye. Host
// ke hisaab se chunte to us leg ko `node-aarch64-apple-darwin` mil jata aur
// Tauri `binaries/node-x86_64-apple-darwin` na milne par build.rs mein hi
// ruk jata ("resource path ... doesn't exist").
//
// Priority: `--target <triple>` arg > TARGET_TRIPLE env > TAURI_ENV_TARGET_TRIPLE
// env (Tauri CLI apne hooks mein khud set karta hai) > host machine.
function requestedTriple() {
  const i = process.argv.indexOf("--target");
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env.TARGET_TRIPLE || process.env.TAURI_ENV_TARGET_TRIPLE || null;
}

const hostKey = `${process.platform}-${process.arch}`;
const wantedTriple = requestedTriple();

const target = wantedTriple
  ? Object.values(PLATFORM_MAP).find((t) => t.triple === wantedTriple)
  : PLATFORM_MAP[hostKey];

if (!target) {
  console.error(
    wantedTriple
      ? `Target "${wantedTriple}" is script mein mapped nahi hai.\n`
      : `Ye platform (${hostKey}) is script mein mapped nahi hai.\n`,
  );
  console.error(
    "scripts/fetch-node.mjs ke PLATFORM_MAP mein naya entry add karein — " +
      "Tauri ke target-triple naming convention ke hisaab se " +
      "(https://tauri.app/develop/sidecar/ dekhein).",
  );
  process.exit(1);
}

console.log(`Target: ${target.triple}  (host: ${hostKey})`);

const isWindows = target.triple.includes("windows"); // target Windows hai (.exe naam)
const hostIsWindows = process.platform === "win32"; // host Windows hai (tar.exe/PowerShell)
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

const tmpDir = path.join(os.tmpdir(), `manzil-node-fetch-${Date.now()}`);
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

// Windows par PATH mein pehle Git ka GNU tar aa sakta hai (Git Bash install
// ho to). GNU tar do cheezon mein fail hota hai: (1) "C:\\..." ko "host:path"
// (remote) samajh leta hai ("Cannot connect to C: resolve failed"), aur
// (2) .zip extract kar hi nahi sakta. Is liye Windows par seedha system ka
// bsdtar (`System32\\tar.exe`) use karte hain, aur archive ka sirf naam dete
// hain (cwd = tmpDir) taake koi drive-letter wala path tar tak pahunche hi nahi.
function tarCommand() {
  if (hostIsWindows) {
    const sysTar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
    if (existsSync(sysTar)) return sysTar;
  }
  return "tar";
}

function extractWithPowerShell() {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Expand-Archive -LiteralPath $env:MANZIL_ARCHIVE -DestinationPath $env:MANZIL_DEST -Force",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, MANZIL_ARCHIVE: archivePath, MANZIL_DEST: tmpDir },
    },
  );
}

try {
  execFileSync(tarCommand(), ["-xf", archiveName], { stdio: "inherit", cwd: tmpDir });
} catch (e) {
  if (hostIsWindows) {
    console.warn("tar fail hua — PowerShell Expand-Archive se try kar raha hoon...");
    try {
      extractWithPowerShell();
    } catch (e2) {
      console.error(
        "Extract nahi ho saka. Manually extract kar ke, node.exe ko yahan copy\n" +
          `kar dein: ${outPath}`,
      );
      throw e2;
    }
  } else {
    console.error(
      "`tar` command chalane mein masla hua. Manually extract kar ke, node binary ko yahan copy\n" +
        `kar dein: ${outPath}`,
    );
    throw e;
  }
}

const extractedDir = path.join(tmpDir, `node-v${NODE_VERSION}-${target.dist}`);
const srcExe = path.join(extractedDir, target.exeInArchive);

if (!existsSync(srcExe)) {
  console.error(`Extracted binary nahi mili: ${srcExe}\nArchive layout badal gaya ho sakta hai.`);
  process.exit(1);
}

// rename NAHI — temp dir (jaise C:) aur repo (jaise D:) alag drive par ho
// to renameSync "EXDEV: cross-device link not permitted" se fail hota hai
// (GitHub Windows runner par yahi hua). copy + temp dir cleanup har
// platform par kaam karta hai.
copyFileSync(srcExe, outPath);
if (!hostIsWindows) chmodSync(outPath, 0o755);

rmSync(tmpDir, { recursive: true, force: true });

console.log(`Staged: ${outPath}`);
console.log("Ab `pnpm app:build` is Node ko app ke andar bundle kar dega.");
