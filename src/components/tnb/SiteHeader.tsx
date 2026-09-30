import { useState } from "react";
import { Menu, Search, UserRound, X } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import logo from "@/assets/logo.png.asset.json";

const NAV = [
  { label: "O TNB", to: "/o-tnb" },
  { label: "Moja historia", to: "/moja-historia" },
  { label: "Biblioteka", to: "/biblioteka" },
  { label: "Podcast", to: "/podcast" },
  { label: "Społeczność", to: "/spolecznosc" },
  { label: "Spotkania", to: "/spotkania" },
  { label: "Materiały premium", to: "/materialy-premium" },
] as const;

const ACTIVE = "nav-link relative pb-1 text-gold after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-gold";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (st) => st.location.pathname });
  const isActive = (to: string) => to !== "/" && (path === to || path.startsWith(to + "/"));

  return (
    <header className="relative z-30 bg-surface-deep">
      <div className="flex h-[86px] items-center gap-6 px-5 lg:px-10">
        <Link to="/" aria-label="Tata Na Baczności — strona główna" className="flex min-w-0 items-center gap-3 lg:gap-4">
          <img
            src={logo.url}
            alt="Tata Na Baczności"
            className="h-[74px] w-[74px] rounded-full object-cover lg:h-[92px] lg:w-[92px] lg:-mb-6"
          />
          <span className="block [@media(min-width:1280px)_and_(max-width:1599px)]:hidden">
            <span className="block truncate font-display text-[1.05rem] font-semibold uppercase tracking-[0.1em] text-foreground sm:text-[1.45rem] sm:tracking-[0.12em]">
              Tata Na Baczności
            </span>
            <span className="eyebrow mt-1 block text-gold/80">Ojcostwo to służba</span>
          </span>
        </Link>

        <nav className="ml-4 hidden min-w-0 flex-1 flex-nowrap items-center justify-center gap-5 2xl:gap-6 whitespace-nowrap xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              
              className={isActive(item.to) ? ACTIVE : "nav-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:gap-5">
          <button
            aria-label="Szukaj"
            className="hidden text-foreground transition-colors hover:text-gold sm:block"
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <Link
            to="/auth"
            className="hidden whitespace-nowrap border border-gold/70 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-gold/10 lg:block"
          >
            Zaloguj się
          </Link>
          <Link
            to="/auth"
            search={{ tryb: "rejestracja" }}
            className="hidden items-center gap-2 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-gold-bright lg:flex"
          >
            <UserRound className="h-4 w-4" strokeWidth={1.75} />
            Dołącz
          </Link>
          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="text-foreground xl:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface-deep px-5 pb-6 xl:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
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
          <div className="mt-5 flex gap-3">
            <Link
              to="/auth"
              className="flex-1 border border-gold/70 py-3 text-center text-[0.72rem] uppercase tracking-[0.14em]"
            >
              Zaloguj się
            </Link>
            <Link
              to="/auth"
              search={{ tryb: "rejestracja" }}
              className="flex-1 bg-gold py-3 text-center text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground"
            >
              Dołącz
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
