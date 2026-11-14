# TNB jako SPA w modelu PureLife

## Jak działa PureLife (sprawdzone w kodzie)
- Klasyczny szablon Lovable: Vite + React + TypeScript, `index.html` + `src/main.tsx` + `src/App.tsx`, React Router (`react-router-dom`, ok. 100 plików), strony w `src/pages`.
- `vite build` -> statyczny `dist/` (plus `version.json`), brak SSR, Nitro, TanStack Start.
- Cała logika serwerowa w 137 Supabase Edge Functions (`supabase/functions/*`, wspólne `_shared`), wywoływanych z przeglądarki przez `supabase.functions.invoke`. Sekrety i service role tylko w funkcjach.
- Przeglądarka używa wyłącznie klucza publishable + sesji użytkownika; RLS w bazie.

## Dlaczego nie da się tego zrobić w tym projekcie
Ten projekt jest na szablonie TanStack Start. Platforma blokuje w nim tworzenie Edge Functions (sprawdzone wcześniej: zapis `supabase/functions/*` odrzucony). Bez nich 204 operacje serwerowe (admin, zamówienia, płatności, webhooki, AI, media, e-mail, cron) nie mają gdzie działać. Szablonu istniejącego projektu nie da się zmienić.

## Plan: nowy projekt Lovable w modelu PureLife
1. Utworzenie nowego projektu Lovable (szablon Vite + React, jak PureLife) z włączonym Lovable Cloud.
2. Etap F1 — frontend: przeniesienie komponentów, stylów, assetów 1:1; `src/routes/*` -> `src/pages/*` + tabela tras React Router z tymi samymi URL-ami, parametrami i query; guardy `_authenticated`/admin jako komponenty; `head()` -> ustawianie tytułu/meta w komponencie; 404; `.htaccess` fallback.
3. Etap B1 — backend: 217 `createServerFn` -> Edge Functions pogrupowane domenowo (wg klasyfikacji C1.1.4: 12 bezpośrednio przez RLS, 1 RPC, 28 public/user, 176 admin), każda z weryfikacją JWT + `has_role` i logowaniem `admin_events`. 13 tras `api/public/*` (webhooki płatności, callback Instagram, cron, proxy mediów) -> publiczne Edge Functions z weryfikacją podpisu/sekretu.
4. Etap D1 — baza: odtworzenie schematu z 59 migracji w nowym Cloud; przeniesienie danych (CSV eksport/import tabel, pliki z 6 prywatnych bucketów). Konta użytkowników: wymagają ponownej rejestracji lub resetu hasła (hashy haseł nie da się przenieść tą drogą) — do decyzji.
5. Etap S1 — sekrety: ponowne dodanie w nowym projekcie (AI działa automatycznie; YouTube, Instagram, płatności, Google/Apple OAuth podaje właściciel).
6. Etap T1 — testy: każda trasa po odświeżeniu, logowanie/reset/OAuth, role i panel admina, zamówienie testowe (`is_test`), webhook testowy, skan `dist/` na sekrety, porównanie zrzutów ekranu ze starym projektem.
7. Przełączenie: ten projekt zostaje nietknięty jako rollback do czasu akceptacji nowego.

## Zachowane zasady
Bez sekretów w przeglądarce; ostatni superadmin chroniony; testowe zamówienia poza statystykami; brak prawdziwej poczty i produkcji bez zgody; moderator Sebastian bez zmian.

## Do decyzji właściciela
- Zgoda na nowy projekt (to jedyna droga do modelu PureLife).
- Sposób przeniesienia kont użytkowników (reset haseł / ponowna rejestracja).
- Kolejność: najpierw frontend z backendem domena po domenie, czy całość naraz.
