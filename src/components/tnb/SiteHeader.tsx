import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, Search, UserRound, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo-384.webp.asset.json";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { brandSrc, getBrandSlogan, useBrand } from "@/hooks/use-brand-settings";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/account/UserAvatar";
import { HeaderSearch } from "./HeaderSearch";
import { isSafeHref, type PageSection } from "@/lib/pages";
import { RichText } from "@/components/pages/RichText";

const HEADER_SIZES: Record<string, string> = {
  small: "h-12 w-12 shrink-0 object-contain",
  medium: "h-[74px] w-[74px] shrink-0 object-contain lg:h-[92px] lg:w-[92px] lg:-mb-6",
  large: "h-[92px] w-[92px] shrink-0 object-contain lg:h-[112px] lg:w-[112px] lg:-mb-8",
  very_large: "h-[110px] w-[110px] shrink-0 object-contain lg:h-[132px] lg:w-[132px] lg:-mb-10",
};
const DEFAULT_HEADER = HEADER_SIZES["medium"];

const NAV = [
  { label: "O TNB", to: "/o-tnb" },
  { label: "Moja historia", to: "/moja-historia" },
  { label: "Artykuły", to: "/artykuly" },
  { label: "Biblioteka", to: "/biblioteka" },
  { label: "Głos TNB", to: "/podcast" },
  { label: "Rozmowy", to: "/spolecznosc" },
  { label: "Spotkania", to: "/spotkania" },
] as const;

export function SiteHeader({ homeSection, editing = false }: { homeSection?: PageSection; editing?: boolean } = {}) {
  const { visiblePath } = useModuleVisibility();
  const brand = useBrand();
  const slogan = getBrandSlogan(brand);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      menuRef.current?.focus({ preventScroll: true });
    };
  }, [open, mounted]);
  const path = useRouterState({ select: (st) => st.location.pathname });
  useEffect(() => { setOpen(false); setSearchOpen(false); }, [path]);
  useEffect(() => {
    if (!open && !searchOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (searchOpen) searchRef.current?.focus(); else menuRef.current?.focus();
      setOpen(false); setSearchOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, searchOpen]);
  const isActive = (to: string) => to !== "/" && (path === to || path.startsWith(to + "/"));
  const auth = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const imgSrc = (brand?.header_image && brandSrc(brand.header_image)) || (brand?.logo && brandSrc(brand.logo)) || logo.url;
  const imgCls = brand?.header_size ? HEADER_SIZES[brand.header_size] ?? DEFAULT_HEADER : DEFAULT_HEADER;
  async function signOut() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await navigate({ to: "/", replace: true });
    await supabase.auth.signOut();
  }
  const outline = "border border-gold/70 text-[0.72rem] uppercase tracking-[0.14em] transition-colors hover:bg-gold/10";
  const solid = "bg-gold text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-gold-bright";
  const homeNav = homeSection?.items.map((item, i) => ({ label: item.title, to: item.href ?? "/", hidden: item.hidden, i }));
  const loginButton = homeSection?.buttons[0];
  const joinButton = homeSection?.buttons[1];

  return (
    <div className={homeSection ? "shrink-0" : "h-[86px] shrink-0"}>
    <header className={homeSection ? `home-header z-40 ${editing ? "relative" : "sticky top-0"}` : "fixed inset-x-0 top-0 z-40 bg-surface-deep/60 backdrop-blur-md"}>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-4 sm:px-5 lg:flex lg:px-8 ${homeSection ? "min-h-[76px] py-2" : "h-[86px]"}`}>
        <Link to="/" aria-label="Tata Na Baczności — strona główna" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-4">
          <img
            src={imgSrc}
            alt="Tata Na Baczności"
            className={`${imgCls} max-h-[74px] max-w-[56px] sm:max-h-none sm:max-w-none lg:!mb-0`}
          />
          <span className="block min-w-0">
            <span className="text-copper block break-words font-display text-sm font-bold uppercase leading-tight sm:text-[1.45rem]">
              {brand?.site_name || "Tata Na Baczności"}
            </span>
            {slogan && <span data-brand-slogan className="mt-1 block max-w-[40ch] break-words text-[0.6rem] uppercase leading-tight text-gold/70 sm:text-xs">{slogan}</span>}
          </span>
        </Link>

        {homeNav && <nav aria-label="Nawigacja strony głównej" className="home-header-nav hidden xl:flex" style={{ gap: homeSection?.appearance?.gap ?? 22 }}>{homeNav.filter(item => (editing || !item.hidden) && (editing || visiblePath(item.to, "menu"))).map(item => <a key={item.i} data-el={editing ? `item-${item.i}-title` : undefined} href={isSafeHref(item.to) ? item.to : undefined} className={`nav-link ${item.hidden ? "opacity-40" : ""}`}><RichText format={homeSection?.textFormats?.[`item-${item.i}-title`]} fallback={item.label} inline /></a>)}</nav>}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 lg:gap-4">
          <Button ref={searchRef} variant="ghost" size="icon" type="button"
            aria-label="Szukaj"
            aria-expanded={searchOpen} aria-controls="tnb-header-search" title="Szukaj"
            onClick={() => { setSearchOpen(v => !v); setOpen(false); }}
            className="text-foreground hover:text-gold [&_svg]:size-5"
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </Button>
          {auth.status === "loading" && <span aria-hidden className="hidden h-[42px] w-[230px] lg:block" />}
          {(auth.status === "signed-out" || editing) && (<>
             {(!loginButton?.hidden || editing) && <a data-el={editing ? "button-0" : undefined} href={loginButton && isSafeHref(loginButton.href) ? loginButton.href : "/auth"} className={`hidden whitespace-nowrap px-4 py-3 text-foreground lg:block ${homeSection ? `home-cta home-cta-${loginButton?.variant ?? "outline"}` : outline}`}><RichText format={homeSection?.textFormats?.["button-0"]} fallback={loginButton?.label ?? "Zaloguj się"} inline /></a>}
             {(!joinButton?.hidden || editing) && <a data-el={editing ? "button-1" : undefined} href={joinButton && isSafeHref(joinButton.href) ? joinButton.href : "/auth?tryb=rejestracja"} className={`hidden items-center gap-2 px-4 py-3 lg:flex ${homeSection ? `home-cta home-cta-${joinButton?.variant ?? "solid"}` : solid}`}>
              <UserRound className="h-4 w-4" strokeWidth={1.75} />
               <RichText format={homeSection?.textFormats?.["button-1"]} fallback={joinButton?.label ?? "Dołącz"} inline />
             </a>}
          </>)}
          {auth.status === "signed-in" && !editing && (<>
            <Button variant="ghost" type="button" onClick={signOut} className={`hidden h-auto rounded-none whitespace-nowrap px-6 py-3 text-foreground lg:block ${outline}`}>Wyloguj</Button>
            <Link to="/moje-tnb" aria-label="Moje TNB" className="flex items-center gap-2 whitespace-nowrap text-gold">
              <UserAvatar own name={auth.user?.user_metadata?.['first_name'] ?? ""} className="size-9" />
              <span className="hidden lg:inline">Moje TNB</span>
            </Link>
          </>)}
          <Button ref={menuRef} variant="ghost" size="icon" type="button"
            aria-label="Menu"
            aria-expanded={open} aria-controls="tnb-header-menu" title="Menu"
            onClick={() => { setOpen((v) => !v); setSearchOpen(false); }}
             className={`text-foreground [&_svg]:size-6 ${homeNav ? "xl:hidden" : ""}`}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {mounted && open && createPortal(
        <dialog ref={dialogRef} id="tnb-header-menu" aria-labelledby="tnb-menu-title"
          onCancel={(event) => { event.preventDefault(); setOpen(false); }}
          className="tnb-menu fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-menu-background p-0 text-foreground motion-reduce:[&_*]:transition-none motion-reduce:[&_*]:animate-none motion-reduce:scroll-auto">
          <div className="mx-auto flex min-h-full max-w-[1440px] flex-col px-5 sm:px-10 lg:px-16">
            <div className="grid min-h-[100px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-menu-gold/20 sm:min-h-[120px]">
              <Link to="/" onClick={() => setOpen(false)} aria-label="Tata Na Baczności — strona główna" className="flex min-w-0 items-center gap-3">
                <img src={imgSrc} alt="Tata Na Baczności" className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
                <span className="text-copper min-w-0 break-words font-display text-base font-bold uppercase leading-tight sm:text-2xl">{brand?.site_name || "Tata Na Baczności"}</span>
              </Link>
              <Button autoFocus variant="ghost" size="icon" aria-label="Zamknij menu" title="Zamknij menu" onClick={() => setOpen(false)} className="size-11 shrink-0 text-menu-gold hover:text-foreground focus-visible:ring-menu-gold"><X className="size-6" strokeWidth={1.5} /></Button>
            </div>
            <div className="flex flex-1 flex-col justify-center py-6 sm:py-8">
              <p id="tnb-menu-title" className="mb-4 text-[10px] uppercase text-menu-gold/75 sm:mb-5">Odkryj TNB</p>
              <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_210px] lg:gap-12">
                <nav aria-label="Menu główne" className="grid min-w-0 content-start gap-x-8 sm:grid-cols-2">
                  {(homeNav ?? NAV).filter(item => !("hidden" in item && item.hidden) && visiblePath(item.to, "menu")).map((item, index) => (
                    <a key={item.label} href={item.to} onClick={() => setOpen(false)} aria-current={isActive(item.to) ? "page" : undefined}
                      className={`group grid min-h-[56px] min-w-0 grid-cols-[24px_minmax(0,1fr)_20px] items-center gap-3 border-b border-menu-gold/20 py-3 transition-colors hover:bg-menu-gold/5 hover:text-menu-gold focus-visible:bg-menu-gold/5 focus-visible:outline-2 focus-visible:outline-menu-gold focus-visible:outline-offset-4 sm:min-h-[72px] ${isActive(item.to) ? "text-menu-gold" : "text-foreground"}`}>
                      <span aria-hidden="true" className="font-sans text-xs text-menu-gold/70 lg:text-[13px]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 break-words font-display text-2xl font-normal leading-tight tracking-normal sm:text-[28px] lg:text-[32px]">{item.label}</span>
                      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-menu-gold/50 transition-colors group-hover:text-menu-gold group-focus-visible:text-menu-gold" strokeWidth={1.25} />
                    </a>
                  ))}
                </nav>
                <section aria-labelledby="tnb-account-title" className="min-w-0 border-t border-menu-gold/20 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-3">
                  {auth.user ? <UserAvatar own name={auth.user.user_metadata?.['first_name'] ?? ""} className="mb-3 size-10" /> : <UserRound aria-hidden="true" className="mb-3 size-5 text-menu-gold" strokeWidth={1.25} />}
                  <h2 id="tnb-account-title" className="mb-4 font-display text-2xl font-normal">Moje TNB</h2>
                  <div className="flex flex-col items-stretch gap-2">
                    {auth.status === "loading" && <p role="status" className="text-sm text-muted-foreground">Ładowanie…</p>}
                    {auth.status === "signed-out" && (<>
                      <Link to="/auth" onClick={() => setOpen(false)} className="border-b border-menu-gold/30 py-3 text-sm transition-colors hover:text-menu-gold focus-visible:outline-2 focus-visible:outline-menu-gold">Zaloguj się <ArrowUpRight aria-hidden="true" className="float-right size-4 text-menu-gold" /></Link>
                      <Link to="/auth" search={{ tryb: "rejestracja" }} onClick={() => setOpen(false)} className="border-b border-menu-gold/30 py-3 text-sm text-menu-gold transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-menu-gold">Dołącz <ArrowUpRight aria-hidden="true" className="float-right size-4" /></Link>
                    </>)}
                    {auth.status === "signed-in" && (<>
                      <Link to="/moje-tnb" onClick={() => setOpen(false)} className="border-b border-menu-gold/30 py-3 text-sm text-menu-gold transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-menu-gold">Moje TNB <ArrowUpRight aria-hidden="true" className="float-right size-4" /></Link>
                      <Button variant="ghost" type="button" onClick={signOut} className="h-auto justify-start rounded-none px-0 py-3 text-sm text-muted-foreground hover:bg-transparent hover:text-menu-gold">Wyloguj</Button>
                    </>)}
                  </div>
                </section>
              </div>
            </div>
            {slogan && <div data-brand-slogan className="break-words border-t border-menu-gold/20 py-4 text-[11px] uppercase text-menu-gold/60">{slogan}</div>}
          </div>
        </dialog>, document.body
      )}
      {searchOpen && <div id="tnb-header-search" className="max-h-[calc(100dvh-86px)] overflow-y-auto border-t border-border bg-surface-deep/95"><HeaderSearch onClose={() => setSearchOpen(false)} /></div>}
    </header>
    </div>
  );
}
