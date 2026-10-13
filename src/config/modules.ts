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
export function moduleVisible(settings: ModuleVisibility | undefined, id: ModuleId | undefined, surface: "menu" | "page") {
  return !id || settings?.[id]?.[surface] !== false;
}