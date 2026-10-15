import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { fxAttrs, normalizeFx } from "@/lib/visual-effects";

/** Applies admin visual-effect settings to <html> and reveals public page sections on scroll.
 *  Admin routes are excluded; sections stay visible if this never runs. */
export function VisualEffects() {
  const { data } = usePlatformSettings();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fx = normalizeFx(data?.visual_effects);
  const attrs = fxAttrs(fx);
  const key = JSON.stringify(attrs);

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = document.documentElement;
    if (path.startsWith("/admin") || attrs["data-fx-reveal"] !== "on" || typeof IntersectionObserver === "undefined"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.remove("fx-ready");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("fx-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    let t = 0;
    const scan = () => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>("main section:not(.fx-reveal), main > article:not(.fx-reveal), footer:not(.fx-reveal)").forEach((el) => {
        if (el.closest("dialog") || el.id === "start") return;
        el.classList.add("fx-reveal");
        // Already on screen: show immediately, never hide visible content.
        if (el.getBoundingClientRect().top < vh) el.classList.add("fx-in"); else io.observe(el);
      });
      root.classList.add("fx-ready");
    };
    // Page content may be swapped after data loads; re-scan new nodes (debounced).
    const mo = new MutationObserver(() => { window.clearTimeout(t); t = window.setTimeout(scan, 80); });
    mo.observe(document.body, { childList: true, subtree: true });
    t = window.setTimeout(scan, 60);
    return () => { window.clearTimeout(t); io.disconnect(); mo.disconnect(); };
  }, [path, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
