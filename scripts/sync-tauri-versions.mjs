#!/usr/bin/env node
/**
 * Rust crates ke versions ko NPM ke ASAL install hue versions ke saath align
 * karta hai.
 *
 * Kyun: `tauri build`/`tauri dev` sabse pehle check karta hai ke har Tauri
 * plugin ka Rust crate aur uska NPM package same major.minor par hon, warna
 * "Found version mismatched Tauri packages" ke saath ruk jata hai. Dono
 * alag registries (crates.io aur npm) hain aur alag waqt par latest
 * dikhati hain; `Cargo.lock` repo mein nahi hai aur NPM side `^` range se
 * float karti hai — to dono ka alag alag latest uthana aam baat hai (CI par
 * npm 2.6 aur crate 2.7 mil gaye the). Haath se pin karna kaam nahi karta,
 * kyunki NPM ka resolved version khud badalta rehta hai.
 *
 * Is script ka tareeqa: `node_modules/@tauri-apps/*` mein jo version asal mein
 * install hua hai wahi padho, aur `src-tauri/Cargo.toml` ke matching crate
 * ko `~MAJOR.MINOR` par set kar do (e.g. npm plugin-fs 2.7.0 -> crate
 * `~2.7`). Naam ka mapping:
 *
 *   @tauri-apps/api            ->  tauri
 *   @tauri-apps/plugin-<name>  ->  tauri-plugin-<name>
 *   (cli ka crate nahi hota — skip)
 *
 * Kab chalana hai: `pnpm install` ke BAAD, build/dev se pehle. `pnpm
 * app:build` / `app:dev` khud chalate hain, aur release.yml mein alag step
 * hai. Haath se: `pnpm sync:tauri`.
 *
 * Koi crate jiska NPM package nahi (jaise `tauri-plugin-single-instance`)
 * ya Cargo.toml mein na ho, usay chheda nahi jata.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const scopeDir = path.join(root, "node_modules", "@tauri-apps");
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");

if (!existsSync(scopeDir)) {
  console.error(
    "node_modules/@tauri-apps nahi mila — pehle `pnpm install` chalayein, phir ye script.",
  );
  process.exit(1);
}

function crateFor(npmName) {
  if (npmName === "api") return "tauri";
  if (npmName.startsWith("plugin-")) return `tauri-plugin-${npmName.slice("plugin-".length)}`;
  return null; // cli wagera — Rust crate nahi
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let cargo = readFileSync(cargoPath, "utf8");
const original = cargo;
const lines = [];

for (const entry of readdirSync(scopeDir).sort()) {
  const crate = crateFor(entry);
  if (!crate) continue;

  const pkgJson = path.join(scopeDir, entry, "package.json");
  if (!existsSync(pkgJson)) continue;

  const installed = JSON.parse(readFileSync(pkgJson, "utf8")).version;
  const [major, minor] = String(installed).split(".");
  if (major === undefined || minor === undefined) continue;
  const req = `~${major}.${minor}`;

  const name = escapeRegExp(crate);
  // `crate = "x"`  ya  `crate = { version = "x", ... }`
  const simple = new RegExp(`^(${name}\\s*=\\s*)"[^"]*"`, "m");
  const table = new RegExp(`^(${name}\\s*=\\s*\\{[^}]*?\\bversion\\s*=\\s*)"[^"]*"`, "m");

  if (simple.test(cargo)) {
    cargo = cargo.replace(simple, `$1"${req}"`);
  } else if (table.test(cargo)) {
    cargo = cargo.replace(table, `$1"${req}"`);
  } else {
    continue; // Cargo.toml mein ye crate hai hi nahi
  }

  lines.push(`  ${crate.padEnd(34)} ${req.padEnd(7)} (npm @tauri-apps/${entry} ${installed})`);
}

if (cargo !== original) {
  writeFileSync(cargoPath, cargo);
  console.log("Cargo.toml update hui:");
} else {
  console.log("Cargo.toml pehle se NPM versions ke saath aligned hai:");
}
console.log(lines.join("\n"));
