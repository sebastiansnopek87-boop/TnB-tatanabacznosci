# TNB jako SPA w tym projekcie (wzór: PureLife)

## Fakty
- PureLife: Vite + React + React Router, statyczny `dist/`, logika serwerowa w 137 Edge Functions wywoływanych `supabase.functions.invoke`.
- Dokumentacja TanStack Start ma tryb SPA (`spa: { enabled: true }`): build daje statyczny `index.html` + assety. Zastrzeżenie z tej samej dokumentacji: `createServerFn` i trasy `api/*` dalej wymagają działającego serwera — na zwykłym FTP nie zadziałają. Dlatego 217 funkcji serwerowych musi trafić do Edge Functions, jak w PureLife.

## Etapy (w tym projekcie, każdy z punktem cofnięcia)
1. **Frontend SPA**: usunięcie `@tanstack/react-start`, Nitro i `@lovable.dev/vite-tanstack-config`; zwykły `vite.config.ts` (`@vitejs/plugin-react`), `index.html`, `src/main.tsx`. Router: React Router jak PureLife — 72 trasy z tymi samymi URL-ami, parametrami i query; guardy logowania/admina jako komponenty; `head()` -> ustawianie title/meta w komponencie; 404; `.htaccess` fallback (już jest). Wygląd i komponenty bez zmian.
2. **Backend w Edge Functions**: ponowna próba utworzenia `supabase/functions/*` po zmianie szablonu na Vite. Każda z 204 operacji (wg C1.1.4) -> funkcja z weryfikacją JWT, `has_role`, logiem `admin_events`; 13 tras `api/public/*` (webhooki, callback Instagram, cron, proxy mediów) -> publiczne funkcje z weryfikacją podpisu. Warstwa `src/lib/api/*` przełączana domena po domenie, więc UI się nie zmienia.
3. **Sekrety**: tylko w Edge Functions; skan `dist/` (`scripts/scan-dist-secrets.sh`).
4. **Testy**: każda trasa po odświeżeniu na `vite preview`, logowanie/reset/OAuth, panel admina i role, zamówienie testowe, webhook testowy, porównanie ekranów.

## Ryzyko krytyczne
Jeśli platforma po etapie 1 nadal zablokuje tworzenie Edge Functions, zatrzymuję się i raportuję — nie zastępuję funkcji kodem w przeglądarce ani atrapami. Baza, dane i RLS bez zmian.

## Zasady bez zmian
Bez sekretów w przeglądarce, ostatni superadmin chroniony, `is_test` poza statystykami, bez prawdziwej poczty i produkcji bez zgody.
