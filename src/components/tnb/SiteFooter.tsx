import { Link } from "@tanstack/react-router";
import { ArrowRight, Mail, Phone } from "lucide-react";
import logo from "@/assets/logo.png.asset.json";
import { byOrder, getSiteSettings, visibleSocial } from "@/config/site-settings";
import { SocialIcon } from "./SocialIcon";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { useModuleVisibility } from "@/hooks/use-module-visibility";

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

export function SiteFooter() {
  const { visiblePath } = useModuleVisibility();
  const s = getSiteSettings();
  const social = visibleSocial(s);
  const { data: ps } = usePlatformSettings();
  const { phone, showInFooter } = s.contact;
  const email = ps?.contact_email ?? s.contact.email;
  const hasContactColumn = showInFooter && (!!email || !!phone || social.length > 0);
  const year = new Date().getFullYear();
  const owner = s.organization.legalName || ps?.platform_name || s.organization.name;

  return (
    <footer className="border-t border-border/60 bg-surface-deep">
      <div className="grid gap-12 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10 lg:px-14 lg:py-20">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <img src={logo.url} alt="Tata Na Baczności" className="h-14 w-14 shrink-0 object-contain" />
            <span>
              <span className="block font-display text-[1.15rem] font-semibold uppercase tracking-[0.1em] text-foreground">
                Tata Na Baczności
              </span>
              <span className="eyebrow mt-1 block text-gold/80">Ojcostwo to służba</span>
            </span>
          </Link>
          {s.footer.brandDescription && (
            <p className="mt-6 max-w-xs text-[0.85rem] leading-[1.75] text-muted-foreground">
              {s.footer.brandDescription}
            </p>
          )}
          {s.footer.aboutLink.visible && visiblePath(s.footer.aboutLink.href, "menu") && (
            <a
              href={s.footer.aboutLink.href}
              className="mt-5 inline-flex items-center gap-3 text-[0.75rem] uppercase tracking-[0.16em] text-gold transition-colors hover:text-gold-bright"
            >
              {s.footer.aboutLink.label}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </a>
          )}
        </div>

        {byOrder(s.footer.columns).map((col) => (
          <div key={col.id}>
            <h3 className="eyebrow text-gold">{col.title}</h3>
            <ul className="mt-6 flex flex-col gap-3">
              {byOrder(col.links).filter(l => visiblePath(l.href, "menu")).map((l) => (
                <li key={l.id}>
                  <FooterLink href={l.href}>{l.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {hasContactColumn && (
          <div>
            <h3 className="eyebrow text-gold">{s.footer.contactColumnTitle}</h3>
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
        © {year} {owner ?? "Tata Na Baczności"}. {s.footer.copyrightText}
      </div>
    </footer>
  );
}
