# TNB — potwierdzenie wdrożenia zabezpieczeń RPC

Data: 2026-11-22  
Supabase: `pmdfiipontreuclfumdh`

## Wdrożenie

Migracja `20261122193543_harden_public_rpc_execute_grants` została:
- odtworzona na pustej, izolowanej bazie w GitHub Actions — PASS;
- zastosowana na produkcyjnym Supabase przez mechanizm migracji — PASS;
- potwierdzona wpisem historii migracji `20261122193543`.

Zmiana dotyczyła wyłącznie uprawnień EXECUTE funkcji RPC. Nie zmieniała definicji funkcji, tabel, rekordów, RLS, sekretów ani ustawień Edge Functions.

## Kontrola po wdrożeniu

Live ACL query potwierdziło:
- żadna z 9 kontrolowanych funkcji nie ma już EXECUTE nadanego roli PUBLIC;
- `article_poll_open`: anon = false, authenticated = true, service_role = true;
- pozostałe publiczne RPC zachowały zamierzony dostęp anon/authenticated/service_role;
- dostęp do publicznych treści nie został odebrany.

Security Advisor po wdrożeniu:
- anon SECURITY DEFINER warning: 8 (wcześniej 9); pozostałe dotyczą zamierzonych publicznych RPC;
- authenticated SECURITY DEFINER warning: 13; te funkcje są wykorzystywane przez RLS lub funkcje profilu i wymagają odrębnego przeglądu;
- 3 tabele RLS bez polityk pozostają bez dostępu anon/authenticated, zgodnie z ACL;
- `pg_net` w schemacie public pozostaje do analizy zależności.

## Pozostałe zadania

- Pełne porównanie wdrożonych źródeł 29 Edge Functions z GitHub.
- Weryfikacja zależności wszystkich rozbieżnych funkcji przed kolejnym deploymentem.
- Testy funkcjonalne i autoryzacyjne RPC na rolach anon/authenticated/admin.
- Oddzielny audyt leaked-password protection, wydajności RLS, indeksów i rozszerzenia pg_net.

Nie wykonano deploymentu Edge Functions ani zmian w ustawieniach poczty i płatności.
