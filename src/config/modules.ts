export const MODULES = [
  { id: "about", label: "O TNB", paths: ["/o-tnb"] },
  { id: "history", label: "Moja historia", paths: ["/moja-historia"] },
  { id: "articles", label: "Artykuły", paths: ["/artykuly"] },
  { id: "library", label: "Biblioteka", paths: ["/biblioteka", "/materialy-premium"] },
  { id: "voice", label: "Głos TNB", paths: ["/podcast"] },
  { id: "community", label: "Rozmowy społeczności", paths: ["/spolecznosc"] },
  { id: "consult", label: "Rozmowy 1:1", paths: ["/spotkania/rozmowa-1-1"] },
  { id: "meetings", label: "Spotkania", paths: ["/spotkania"] },
  { id: "contact", label: "Kontakt", paths: ["/kontakt"] },
  { id: "newsletter", label: "Newsletter", paths: [] },
] as const;
export type ModuleId = typeof MODULES[number]["id"];
export type ModuleVisibility = Partial<Record<ModuleId, { menu: boolean; page: boolean }>>;
export function moduleForPath(path: string): ModuleId | undefined {
  const clean = path.split(/[?#]/)[0];
  // Specific submodules take precedence over their parent.
  return [...MODULES].sort((a, b) => Math.max(0, ...b.paths.map(p => p.length)) - Math.max(0, ...a.paths.map(p => p.length)))
    .find(m => m.paths.some(p => clean === p || clean?.startsWith(p + "/")))?.id;
}
export function normalizeModuleVisibility(value: unknown): ModuleVisibility {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const normalized: ModuleVisibility = {};
  for (const module of MODULES) {
    const item = raw[module.id];
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.menu === "boolean" || typeof entry.page === "boolean") {
      normalized[module.id] = {
        menu: typeof entry.menu === "boolean" ? entry.menu : true,
        page: typeof entry.page === "boolean" ? entry.page : true,
      };
    }
  }
  return normalized;
}
export function moduleVisible(settings: unknown, id: ModuleId | undefined, surface: "menu" | "page") {
  if (!id || typeof settings !== "object" || settings === null || Array.isArray(settings)) return true;
  const item = (settings as Record<string, unknown>)[id];
  if (typeof item !== "object" || item === null || Array.isArray(item)) return true;
  return (item as Record<string, unknown>)[surface] !== false;
}
