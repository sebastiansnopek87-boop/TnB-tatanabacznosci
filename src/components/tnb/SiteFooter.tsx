import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail, Phone } from "lucide-react";
import logo from "@/assets/logo-384.webp.asset.json";
import { byOrder, getSiteSettings, type SocialLink } from "@/config/site-settings";
import { SocialIcon } from "./SocialIcon";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import type { PageSection } from "@/lib/pages";
import { brandSrc, getBrandSlogan, useBrand } from "@/hooks/use-brand-settings";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "text-[0.85rem] text-muted-foreground transition-colors hover:text-gold";
  if (href.startsWith("/") && !href.includes("#")) {
    return (
      <Link to={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}

// Optional home-only override (Visual Builder "Stopka strony głównej"); empty fields keep the global footer.
export function SiteFooter({ home, sel }: { home?: PageSection | undefined; sel?: string | null | undefined } = {}) {
  const a = (el: string) => sel === undefined ? {} : { "data-el": el, ...(sel === el ? { "data-on": "" } : {}) };
  const { visiblePath } = useModuleVisibility();
  const brand = useBrand();
  const slogan = getBrandSlogan(brand);
  const s = getSiteSettings();
  const { data: ps } = usePlatformSettings();
  // Social icons come from platform settings (single source); static list stays a fallback-free empty default.
  const social: SocialLink[] = ([
    { platform: "youtube", label: "YouTube", url: ps?.social_youtube },
    { platform: "spotify", label: "Spotify", url: ps?.social_spotify },
    { platform: "tiktok", label: "TikTok", url: ps?.social_tiktok },
    { platform: "instagram", label: "Instagram", url: ps?.social_instagram },
  ] as { platform: SocialLink["platform"]; label: string; url: string | null | undefined }[])
    .filter((x) => !!x.url)
    .map((x, i) => ({ platform: x.platform, label: x.label, url: x.url!, order: i + 1, visible: true }));
  const phone = ps?.contact_phone ?? s.contact.phone;
  const email = ps?.contact_email ?? s.contact.email;
  const showInFooter = ps?.footer_show_contact ?? s.contact.showInFooter;
  const hasContactColumn = showInFooter && (!!email || !!phone || social.length > 0);
  const year = new Date().getFullYear();
  const owner = ps?.company_legal_name || s.organization.legalName || ps?.platform_name || s.organization.name;
  const description = home?.body || (ps?.footer_description ?? s.footer.brandDescription);
  const copyright = home?.caption || (ps?.footer_copyright ?? s.footer.copyrightText);
  const homeAbout = home?.buttons[0];
  const about = homeAbout ? { label: homeAbout.label, href: homeAbout.href, visible: !homeAbout.hidden } : s.footer.aboutLink;
  const columns = home && home.items.length
    ? home.items.filter((c) => !c.hidden).map((c, i) => ({ id: `h${i}`, i, title: c.title, links: c.body.split("\n").map((l, k) => { const [label, href] = l.split("|").map((x) => x.trim()); return { id: `${i}-${k}`, label: label ?? "", href: href || "/" }; }).filter((l) => l.label) }))
    : byOrder(s.footer.columns).map((c) => ({ id: c.id, i: -1, title: c.title, links: byOrder(c.links) }));
  const contactTitle = home?.eyebrow || s.footer.contactColumnTitle;
  const registry = [
    ps?.company_legal_form,
    ps?.company_nip ? `NIP: ${ps.company_nip}` : null,
    ps?.company_regon ? `REGON: ${ps.company_regon}` : null,
    ps?.company_krs ? `KRS: ${ps.company_krs}` : null,
  ].filter(Boolean) as string[];
  const address = [ps?.company_address_street, [ps?.company_address_postal, ps?.company_address_city].filter(Boolean).join(" ") || null, ps?.company_address_country].filter(Boolean) as string[];

  return (
    <footer className="border-t border-border/60 bg-surface-deep">
      <div className="grid gap-12 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10 lg:px-14 lg:py-20">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <img src={brand?.logo && brandSrc(brand.logo) ? brandSrc(brand.logo)! : logo.url} loading="lazy" decoding="async" alt="Tata Na Baczności" className="h-14 w-14 shrink-0 object-contain" />
            <span>
              <span className="block font-display text-[1.15rem] font-semibold uppercase tracking-[0.1em] text-foreground">
                Tata Na Baczności
              </span>
              {slogan && <span data-brand-slogan className="mt-1 block max-w-[40ch] break-words text-xs uppercase leading-relaxed text-gold/80">{slogan}</span>}
            </span>
          </Link>
          {description && (
            <p {...a("body")} className="mt-6 max-w-xs text-[0.85rem] leading-[1.75] text-muted-foreground">
              {description}
            </p>
          )}
          {about.visible && visiblePath(about.href, "page") && (
            <a {...a("button-0")}
              href={about.href}
              className="mt-5 inline-flex items-center gap-3 text-[0.75rem] uppercase tracking-[0.16em] text-gold transition-colors hover:text-gold-bright"
            >
              {about.label}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </a>
          )}
        </div>

        {columns.map((col) => (
          <div key={col.id} {...(col.i >= 0 ? a(`item-${col.i}`) : {})}>
            <h3 className="eyebrow text-gold">{col.title}</h3>
            <ul className="mt-6 flex flex-col gap-3">
              {col.links.filter(l => visiblePath(l.href, "page")).map((l) => (
                <li key={l.id}>
                  <FooterLink href={l.href}>{l.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {hasContactColumn && (
          <div>
            <h3 {...a("eyebrow")} className="eyebrow text-gold">{contactTitle}</h3>
            <ul className="mt-6 flex flex-col gap-3">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-3 text-[0.85rem] text-muted-foreground hover:text-gold">
                    <Mail className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-3 text-[0.85rem] text-muted-foreground hover:text-gold">
                    <Phone className="h-4 w-4 text-gold" strokeWidth={1.5} />
                    {phone}
                  </a>
                </li>
              )}
            </ul>
            {social.length > 0 && (
              <div className="mt-6 flex gap-3">
                {social.map((x) => (
                  <a
                    key={x.platform}
                    href={x.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={x.label}
                    className="flex h-10 w-10 items-center justify-center border border-border text-foreground transition-colors hover:border-gold hover:text-gold"
                  >
                    <SocialIcon platform={x.platform} className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-border/60 px-5 py-6 text-[0.75rem] text-muted-foreground lg:px-14">
        <p {...a("caption")}>© {year} {owner ?? "Tata Na Baczności"}. {copyright}</p>
        {(registry.length > 0 || address.length > 0) && (
          <p className="mt-2 leading-relaxed">
            {address.length > 0 && <span>{address.join(", ")}</span>}
            {address.length > 0 && registry.length > 0 && <span> · </span>}
            {registry.length > 0 && <span>{registry.join(" · ")}</span>}
          </p>
        )}
      </div>
    </footer>
  );
}
