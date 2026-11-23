# Trasy React SPA

Aplikacja działa jako statyczne React SPA z Vite i TanStack Router. Pliki `.tsx` w tym katalogu definiują trasy, a `src/routeTree.gen.ts` jest generowany automatycznie przez plugin TanStack Router.

Nie jest to runtime TanStack Start. Nie dodawaj `createServerFn`, loaderów serwerowych TanStack Start ani importów `@tanstack/react-start` do kodu uruchamianego w przeglądarce. Odczyty i zapisy danych wykonuj przez adaptery w `src/lib/api/`, które komunikują się z Supabase Edge Functions lub dozwolonymi odczytami Supabase.

## Struktura i konwencje

- `__root.tsx` — wspólny shell aplikacji i `<Outlet />`.
- `index.tsx` — strona główna `/`.
- `auth.tsx` — logowanie i rejestracja.
- `biblioteka.index.tsx` — katalog biblioteki.
- `biblioteka.$slug.tsx` — szczegóły materiału.
- `_authenticated/route.tsx` — layout i bramka tras wymagających sesji.
- `_authenticated/admin.*.tsx` — moduły panelu administratora.
- `$token` / `$slug` / `$postId` — parametry dynamiczne.

Przykładowe konwencje TanStack Router:
- `users.index.tsx` → `/users/`
- `users.$id.tsx` → `/users/$id`
- `posts.{-$category}.tsx` → opcjonalny segment, jeśli generator i konfiguracja projektu go obsługują.

## Zasady bezpieczeństwa migracji

1. Nie edytuj ręcznie `routeTree.gen.ts`; zmieniaj pliki tras i uruchamiaj generator/build.
2. Nie przenoś logiki uprzywilejowanej do przeglądarki.
3. Kontrole dostępu w UI są wygodą nawigacyjną; właściwe uprawnienia muszą być egzekwowane przez Edge Function i RLS.
4. Zachowuj istniejące ścieżki URL, parametry, query stringi, przekierowania i metadane SEO.
5. Każda zmiana trasy musi przejść test bezpośredniego wejścia, odświeżenia, nawigacji wstecz/do przodu oraz zachowania sesji.
6. Nie usuwaj modułów legacy, dopóki ich zachowanie nie ma testowanego odpowiednika w SPA/Edge.

`routeTree.gen.ts` jest plikiem generowanym. Nie edytuj go ręcznie.
