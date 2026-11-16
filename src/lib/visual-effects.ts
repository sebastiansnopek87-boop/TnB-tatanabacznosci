import type { VisualEffects } from "@/lib/platform.types";

export const FX_DEFAULT: VisualEffects = { enabled: true, intensity: "subtle", speed: "standard", reveal: true, interactive: true, panels: true };

export function normalizeFx(v: unknown): VisualEffects {
  const raw = typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
  return {
    enabled: typeof raw["enabled"] === "boolean" ? raw["enabled"] : FX_DEFAULT.enabled,
    intensity: raw["intensity"] === "subtle" || raw["intensity"] === "standard" || raw["intensity"] === "off" ? raw["intensity"] : FX_DEFAULT.intensity,
    speed: raw["speed"] === "fast" || raw["speed"] === "standard" || raw["speed"] === "calm" ? raw["speed"] : FX_DEFAULT.speed,
    reveal: typeof raw["reveal"] === "boolean" ? raw["reveal"] : FX_DEFAULT.reveal,
    interactive: typeof raw["interactive"] === "boolean" ? raw["interactive"] : FX_DEFAULT.interactive,
    panels: typeof raw["panels"] === "boolean" ? raw["panels"] : FX_DEFAULT.panels,
  };
}

/** Data attributes consumed by the CSS in styles.css; works on <html> or a preview wrapper. */
export function fxAttrs(v: VisualEffects): Record<string, string> {
  const on = v.enabled && v.intensity !== "off";
  return {
    "data-fx": on ? "on" : "off",
    "data-fx-intensity": v.intensity,
    "data-fx-speed": v.speed,
    "data-fx-reveal": on && v.reveal ? "on" : "off",
    "data-fx-interactive": on && v.interactive ? "on" : "off",
    "data-fx-panels": on && v.panels ? "on" : "off",
  };
}
