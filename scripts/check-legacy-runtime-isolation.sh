#!/usr/bin/env bash
set -euo pipefail

node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = "src";
const violations = [];
const legacyFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\\.tsx?$/.test(file)) continue;
    if (/\\.(functions|server)\\.ts$/.test(file)) { legacyFiles.push(file); continue; }
    if (/\\.(test|spec)\\.tsx?$/.test(file) || /\\/auth-(middleware|attacher)\\.ts$/.test(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const imports = /\\bfrom\\s*["']([^"']+)["']|\\bimport\\s*\\(\\s*["']([^"']+)["']\\s*\\)/g;
    for (const match of source.matchAll(imports)) {
      const specifier = match[1] || match[2] || "";
      if (/\\.(functions|server)(\\.ts)?$/.test(specifier) || specifier.startsWith("@tanstack/react-start")) {
        violations.push(file + ": " + specifier);
      }
    }
    if (/client\\.server|supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY/.test(source)) {
      violations.push(file + ": server-only Supabase client/credential reference");
    }
  }
}
walk(root);
if (violations.length) {
  console.error("Legacy runtime imports or server-only references found in production source:");
  for (const item of violations) console.error(" - " + item);
  process.exit(1);
}
console.log("OK: production UI is isolated from TanStack Start; " + legacyFiles.length + " legacy source files remain for test migration and deletion.");
NODE
