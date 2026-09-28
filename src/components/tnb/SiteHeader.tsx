import { useState } from "react";
import { Menu, Search, UserRound, X } from "lucide-react";
import logo from "@/assets/logo.png.asset.json";

const NAV = [
  { label: "Start", href: "#start" },
  { label: "O TNB", href: "#o-tnb" },
  { label: "Moja historia", href: "#moja-historia" },
  { label: "Biblioteka", href: "#biblioteka" },
  { label: "Podcast", href: "#podcast" },
  { label: "Społeczność", href: "#spolecznosc" },
  { label: "Spotkania", href: "#spotkania" },
  { label: "Sklep", href: "#sklep" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-30 bg-surface-deep">
      <div className="flex h-[86px] items-center gap-6 px-5 lg:px-10">
        <a href="#start" className="flex shrink-0 items-center gap-4">
          <img
            src={logo.url}
            alt="Tata Na Baczności"
            className="h-[74px] w-[74px] rounded-full object-cover lg:h-[92px] lg:w-[92px] lg:-mb-6"
          />
          <span className="block">
            <span className="block font-display text-[1.05rem] sm:text-[1.45rem] font-semibold uppercase tracking-[0.12em] text-foreground">
              Tata Na Baczności
            </span>
            <span className="eyebrow mt-1 block text-gold/80">Ojcostwo to służba</span>
          </span>
        </a>

        <nav className="ml-6 hidden flex-1 flex-nowrap items-center gap-6 whitespace-nowrap xl:flex">
          {NAV.map((item, i) => (
            <a
              key={item.label}
              href={item.href}
              className={
                i === 0
                  ? "nav-link relative pb-1 text-gold after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-gold"
                  : "nav-link"
              }
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:gap-5">
          <button
            aria-label="Szukaj"
            className="hidden text-foreground transition-colors hover:text-gold sm:block"
          >
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <a
            href="#logowanie"
            className="hidden whitespace-nowrap border border-gold/70 px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-gold/10 lg:block"
          >
            Zaloguj się
          </a>
          <a
            href="#dolacz"
            className="hidden items-center gap-2 bg-gold px-6 py-3 text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-gold-bright lg:flex"
          >
            <UserRound className="h-4 w-4" strokeWidth={1.75} />
            Dołącz
          </a>
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
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="nav-link border-b border-border/60 py-4"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-5 flex gap-3">
            <a
              href="#logowanie"
              className="flex-1 border border-gold/70 py-3 text-center text-[0.72rem] uppercase tracking-[0.14em]"
            >
              Zaloguj się
            </a>
            <a
              href="#dolacz"
              className="flex-1 bg-gold py-3 text-center text-[0.72rem] uppercase tracking-[0.14em] text-primary-foreground"
            >
              Dołącz
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
