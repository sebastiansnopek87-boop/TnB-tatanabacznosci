# TNB — potwierdzenie wdrożenia indeksów FK

Data: 2026-11-22  
Projekt Supabase: `pmdfiipontreuclfumdh`

Migracja `20261122194610_add_foreign_key_support_indexes` została:
- odtworzona od pustej bazy w GitHub Actions — PASS;
- zastosowana na produkcyjnym Supabase — PASS;
- zapisana w historii migracji pod wersją `20261122194610`.

Live query potwierdziło istnienie siedmiu indeksów:
- `ai_materials_proposal_id_idx`
- `ai_proposals_analysis_id_idx`
- `article_ai_origin_material_id_idx`
- `article_saves_article_id_idx`
- `articles_category_idx`
- `library_items_category_idx`
- `library_orders_item_id_idx`

Live query potwierdziło również, że usunięty został `library_orders_provider_ref`, a `library_orders_provider_ref_uq` pozostał. Reguła UNIQUE na `(provider, provider_ref)` z warunkiem `provider_ref IS NOT NULL` jest nadal utrzymana.

Po wdrożeniu Performance Advisor nie zgłasza już brakujących indeksów kluczy obcych. Pozostały:
- 94 ostrzeżenia auth-initplan w politykach RLS;
- 10 tabel z wieloma permissive policies;
- 30 indeksów oznaczonych jako nieużywane (w tym nowe indeksy, które naturalnie nie miały jeszcze odczytów).

Nie zmieniono danych, RLS, funkcji Edge, płatności, SMTP ani trybu przedpremierowego.
