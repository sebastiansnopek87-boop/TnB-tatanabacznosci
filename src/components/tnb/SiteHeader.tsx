import { useEffect, useRef, useState } from "react";
import { Menu, Search, UserRound, X } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png.asset.json";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { brandSrc, useBrand } from "@/hooks/use-brand-settings";
import { Button } from "@/components/ui/button";
import { HeaderSearch } from "./HeaderSearch";

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

const ACTIVE = "nav-link relative pb-1 text-gold after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-gold";

export function SiteHeader() {
  const { visiblePath } = useModuleVisibility();
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
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

  return (
    <div className="h-[86px] shrink-0">
    <header className="fixed inset-x-0 top-0 z-40 bg-surface-deep/60 backdrop-blur-md">
      <div className="flex h-[86px] items-center gap-2 px-3 sm:gap-6 sm:px-5 lg:px-10">
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
            <span className="mt-1 block text-[0.6rem] uppercase text-gold/70 sm:eyebrow">Ojcostwo to służba</span>
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3 lg:gap-5">
          <Button ref={searchRef} variant="ghost" size="icon" type="button"
            aria-label="Szukaj"
            aria-expanded={searchOpen} aria-controls="tnb-header-search" title="Szukaj"
            onClick={() => { setSearchOpen(v => !v); setOpen(false); }}
            className="text-foreground hover:text-gold [&_svg]:size-5"
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </Button>
          {auth.status === "loading" && <span aria-hidden className="hidden h-[42px] w-[230px] lg:block" />}
          {auth.status === "signed-out" && (<>
            <Link to="/auth" className={`hidden whitespace-nowrap px-6 py-3 text-foreground lg:block ${outline}`}>Zaloguj się</Link>
            <Link to="/auth" search={{ tryb: "rejestracja" }} className={`hidden items-center gap-2 px-6 py-3 lg:flex ${solid}`}>
              <UserRound className="h-4 w-4" strokeWidth={1.75} />
              Dołącz
            </Link>
          </>)}
          {auth.status === "signed-in" && (<>
            <Button variant="ghost" type="button" onClick={signOut} className={`hidden h-auto rounded-none whitespace-nowrap px-6 py-3 text-foreground lg:block ${outline}`}>Wyloguj</Button>
            <Link to="/moje-tnb" className={`hidden items-center gap-2 whitespace-nowrap px-6 py-3 lg:flex ${solid}`}>
              <UserRound className="h-4 w-4" strokeWidth={1.75} />
              Moje TNB
            </Link>
          </>)}
          <Button ref={menuRef} variant="ghost" size="icon" type="button"
            aria-label="Menu"
            aria-expanded={open} aria-controls="tnb-header-menu" title="Menu"
            onClick={() => { setOpen((v) => !v); setSearchOpen(false); }}
            className="text-foreground [&_svg]:size-6"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {open && (
        <div id="tnb-header-menu" className="max-h-[calc(100dvh-86px)] overflow-y-auto border-t border-border bg-surface-deep/95 px-5 pb-6">
          <nav aria-label="Menu główne" className="ml-auto flex max-w-xl flex-col">
            {NAV.filter(item => visiblePath(item.to, "menu")).map((item) => (
              <Link
                key={item.label}
                to={item.to}
                
                onClick={() => setOpen(false)}
                className={`nav-link border-b border-border/60 py-4 ${isActive(item.to) ? "text-gold" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto mt-5 flex max-w-xl gap-3 lg:hidden">
            {auth.status === "signed-out" && (<>
              <Link to="/auth" onClick={() => setOpen(false)} className={`flex-1 py-3 text-center ${outline}`}>Zaloguj się</Link>
              <Link to="/auth" search={{ tryb: "rejestracja" }} onClick={() => setOpen(false)} className={`flex-1 py-3 text-center ${solid}`}>Dołącz</Link>
            </>)}
            {auth.status === "signed-in" && (<>
              <Button variant="ghost" type="button" onClick={signOut} className={`h-auto flex-1 rounded-none py-3 text-center ${outline}`}>Wyloguj</Button>
              <Link to="/moje-tnb" onClick={() => setOpen(false)} className={`flex-1 py-3 text-center ${solid}`}>Moje TNB</Link>
            </>)}
          </div>
        </div>
      )}
      {searchOpen && <div id="tnb-header-search" className="max-h-[calc(100dvh-86px)] overflow-y-auto border-t border-border bg-surface-deep/95"><HeaderSearch onClose={() => setSearchOpen(false)} /></div>}
    </header>
    </div>
  );
}
