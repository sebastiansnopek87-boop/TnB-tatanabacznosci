import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const routesRoot = "src/routes";
const treePath = "src/routeTree.gen.ts";
const tree = await readFile(treePath, "utf8");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) files.push(full);
  }
  return files;
}

const files = await walk(routesRoot);
const missing = files.filter((file) => {
  const rel = relative("src", file).split(sep).join("/");
  return !tree.includes(rel.replace(/\.tsx?$/, ""));
});

if (missing.length) {
  console.error("Route files missing from generated TanStack route tree:");
  for (const file of missing) console.error(" - " + file);
  process.exit(1);
}

const root = await readFile(join(routesRoot, "__root.tsx"), "utf8");
for (const text of ["Nie znaleziono strony", "Nie udało się wczytać strony", "Strona główna"]) {
  if (!root.includes(text)) {
    console.error("Global router fallback is not localized: " + text);
    process.exit(1);
  }
}
if (root.includes("Go home")) {
  console.error("Global router fallback contains untranslated English text: Go home");
  process.exit(1);
}

console.log("OK: " + files.length + " route files are represented in the generated route tree; global fallback is Polish.");
