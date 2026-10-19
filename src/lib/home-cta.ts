import { isSafeHref } from "./pages";

export const HOME_CTA_DEFAULTS = {
  ctaMode: "session", ctaGuestHref: "/auth?tryb=rejestracja", ctaMemberHref: "/spolecznosc", ctaVisible: "on",
};

// Presentation only; destination routes retain their existing access rules.
export function resolveHomeCta(settings: Record<string, string> | undefined, status: "loading" | "signed-in" | "signed-out") {
  const s = settings ?? {};
  const conditional = s["ctaMode"] !== "fixed";
  const key = status === "signed-in" ? "ctaMemberHref" : "ctaGuestHref";
  const href = (conditional ? s[key] ?? HOME_CTA_DEFAULTS[key] : s["ctaHref"] ?? "").trim();
  return { href, visible: s["ctaVisible"] !== "off" && !!s["ctaLabel"]?.trim() && isSafeHref(href) && !(conditional && status === "loading") };
}