# Zlecenie nr 0 — końcowy audyt gotowości (wyłącznie odczyt)

Bez zmian kodu, bazy, sekretów, konfiguracji, gałęzi i publikacji. Bez płatności i e-maili.

## Kroki
1. Zapis stanu startowego: commit i `git status --short`.
2. Lektura: AGENTS.md, src/lib/AGENTS.md, package.json, konfiguracje Vite/TanStack/Supabase, migracje, dokumentacja.
3. A. Build/stabilność: `tsgo --noEmit`, lint (jeśli skrypt istnieje), wszystkie istniejące konfiguracje Vitest oraz `bunx vitest run`; logi build/konsoli/runtime; dokładne polecenia i kody wyjścia.
4. B. Auth/role: konfiguracja auth, ochrona tras /admin i funkcji serwerowych, linter RLS, wyniki skanu bezpieczeństwa, wyszukanie kluczy w kodzie klienta; E2E zalogowany vs niezalogowany.
5. C. Płatności: payments.functions.ts, config/payments.ts, orders.server.ts, webhooki (podpisy, idempotencja, środowisko), ręczne potwierdzanie przelewu, blokady przy brakujących danych; odczyt payment_providers.
6. D. Poczta: notifications.server/functions, deliver(), tryb, nadawca, stan domeny nadawczej, log wysyłek, rozdział marketing/transakcje.
7. E. Konfiguracja: PUBLIC_SITE_URL, adresy podglądu w kodzie, domena/HTTPS, obecność sekretów (bez wartości).
8. F. Baza/pliki: zgodność migracji, RLS, buckety prywatne, trasy /api/public/* pobierania.
9. G. Cron/integracje: zaplanowane zadania, zabezpieczenie endpointów, YouTube/Instagram.
10. H. Bezpieczeństwo: walidacja wejścia, limity nadużyć, logi, skan zależności.
11. Testy funkcjonalne bezpiecznych ścieżek w przeglądarce (bez skutków zewnętrznych).
12. Ponowny `git status` i commit — potwierdzenie braku zmian.

## Wynik
Raport w czacie i plik /mnt/documents/TNB-audyt-gotowosci-produkcyjnej.md: status PASS / FAIL / NIEZWERYFIKOWANE dla każdego obszaru, problemy P0–P2 z lokalizacją, dowodem, skutkiem i minimalną naprawą; rozdzielenie: przetestowane / tylko kod / nieprzetestowane. Bez napraw.
