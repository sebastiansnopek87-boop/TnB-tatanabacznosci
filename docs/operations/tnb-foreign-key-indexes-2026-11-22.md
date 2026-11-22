# TNB — brakujące indeksy kluczy obcych

Data: 2026-11-22  
Projekt: `pmdfiipontreuclfumdh`

## Potwierdzone kolumny

Live Performance Advisor wskazał siedem kolumn FK bez indeksu. Odczyt `pg_constraint` potwierdził definicje:

- `ai_materials.proposal_id → ai_proposals.id`
- `ai_proposals.analysis_id → ai_analyses.id`
- `article_ai_origin.material_id → ai_materials.id`
- `article_saves.article_id → articles.id`
- `articles.category → article_categories.slug`
- `library_items.category → library_categories.slug`
- `library_orders.item_id → library_items.id`

Odczyt `pg_indexes` nie wykazał indeksów rozpoczynających się od tych kolumn. Istniejące klucze główne i indeksy z innymi pierwszymi kolumnami nie zastępują indeksów FK.

## Wielkość tabel

W chwili odczytu całkowity rozmiar wskazanych tabel mieścił się w przedziale 8–72 kB. Szacunkowe `reltuples` były równe 0, więc przed odczytem należy traktować te wartości jako nieświeże statystyki, nie dokładną liczbę rekordów.

## Zmiana

Migracja `add_foreign_key_support_indexes` tworzy siedem zwykłych indeksów btree, bez zmiany danych, constraintów, RLS i zachowania aplikacji. Zawiera asercję istnienia wszystkich indeksów. Najpierw wymagany jest replay na czystym lokalnym Supabase w CI; produkcję zmieniamy dopiero po PASS.

Nie usuwamy duplikatu `library_orders_provider_ref` / `library_orders_provider_ref_uq` w tej migracji. Wymaga on osobnego sprawdzenia zależności constraintów i statystyk użycia.

## Dodatkowy duplikat indeksu

Live odczyt `pg_index`, `pg_constraint` i `pg_stat_user_indexes` potwierdził, że:
- `library_orders_provider_ref` i `library_orders_provider_ref_uq` mają identyczną definicję UNIQUE na `(provider, provider_ref)` z warunkiem `provider_ref IS NOT NULL`;
- żaden z nich nie jest indeksem podpierającym constraint;
- oba miały `idx_scan = 0` w chwili odczytu.

Migracja usuwa tylko `library_orders_provider_ref`; pozostawia `library_orders_provider_ref_uq`, który nadal wymusza tę samą unikalność. Nie zmienia to danych ani reguły unikalności.
