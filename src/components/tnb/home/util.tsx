import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { PageSection } from "@/lib/pages";

// Shared helpers for home-page blocks: same markup for the public page and the Visual Builder preview.
export type A = (el: string) => Record<string, string>;
export const noA: A = () => ({});
export type HomeBlockProps = { s: PageSection; a?: A | undefined; imageSrc?: ((file: string) => string | undefined) | undefined };

export const setting = (s: PageSection, key: string) => s.settings?.[key] ?? "";

// "*słowo*" renders gold; everything else stays plain text (no HTML).
export function Gold({ t, cls = "text-gold" }: { t: string; cls?: string }) {
  return <>{t.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <span key={i} className={cls}>{p.slice(1, -1)}</span> : p))}</>;
}

// Internal links use the router; external ones open in a new tab.
export function SmartLink({ href, className, children, ...rest }: { href: string; className?: string; children: ReactNode } & Record<string, unknown>) {
  if (href.startsWith("/") && !href.includes("?") && !href.includes("#")) return <Link to={href as "/"} className={className} {...rest}>{children}</Link>;
  return <a href={href} className={className} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>{children}</a>;
}
