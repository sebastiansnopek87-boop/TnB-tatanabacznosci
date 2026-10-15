import type { VisualEffects } from "@/lib/platform.functions";

export const FX_DEFAULT: VisualEffects = { enabled: true, intensity: "subtle", speed: "standard", reveal: true, interactive: true, panels: true };

export function normalizeFx(v: Partial<VisualEffects> | null | undefined): VisualEffects {
  return { ...FX_DEFAULT, ...(v ?? {}) };
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
