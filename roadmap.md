# Roadmap
- [ ] Slogan marki: diagnoza i minimalny plan; wdrożenie czeka na osobną zgodę na wymaganą migrację walidacji
- [x] Logo logowania/rejestracji z useBrand → brand_settings.logo; E2E 1280/390 px: proporcje, niezmienione pola/przyciski/teksty, przełączanie ekranów, brak przepełnienia i błędów; bez zmian bazy
- [x] Menu premium: istniejące linki i logowanie, nieprzezroczysta nakładka, blokada tła, klawiatura i zamykanie
- [x] E2E menu 1280/1206/768/390/320 px: 7 tras, logowanie/rejestracja, zalogowane Moje TNB i wylogowanie, X/Escape, focus i blokada tła; Hero 320 px/tablet bez przepełnienia; 3 testy widoczności PASS, bez migracji
- [x] Nagłówek: nazwa widoczna, menu pod trzema kreskami, przezroczysty stały pasek i lupa; E2E 1440/1920/390 px, wyszukanie i otwarcie artykułu, zalogowane menu, bez przepełnienia i błędów
- [x] Edytor tekstu w istniejącym CMS: formatowanie, czcionki, wyrównanie, położenie, bez migracji
- [x] E2E: czcionka Arial, 24 px, pogrubienie, justowanie, szerokość 80%, położenie centralne; zapis szkicu, odczyt po przeładowaniu, wyczyszczenie próbnego formatowania; mobile 390 px bez przepełnienia

- [x] Finalny SQL jednej migracji brand_settings — zatwierdzony i wykonany (0054)
- [x] Ustawienia marki jak na nagraniu — zakończone, bez dalszej rozbudowy

- [x] Podmiana logo TNB: strona, logowanie, favicon i znak wodny nowych PDF
- [x] Przełączniki widoczności modułów w menu i na stronie — zapis, odczyt po odświeżeniu, ukrycie i przywrócenie Głosu TNB w E2E; mobile bez przepełnienia

- [x] Głos TNB: trwałe ręczne metadane YouTube + raport synchronizacji
- [x] Głos TNB: zunifikowana lista materiałów, najnowszy materiał, filtry tylko dla realnych źródeł
- [x] Głos TNB: migracja external_url + youtube_id opcjonalne (0052, zaakceptowana)
- [x] Głos TNB: panel admina — edycja, archiwizacja, wyróżnienie, kolejność, dodawanie ręczne, raport synchronizacji
- [x] Głos TNB: testy E2E + tabela wyników

## ETAP — Ustawienia marki (brand_settings) — ZAKOŃCZONY 2026-10-14
- [x] Migracja brand_settings (walidacja publicznych danych, CHECK, GRANT SELECT) — wykonana za zgodą
- [x] Panel: logo, favicon, obraz udostępowania, obraz w nagłówku + rozmiar, SEO strony głównej, publiczny adres witryny
- [x] Serwer: createBrandUpload / finalizeBrandUpload / saveBrandSettings (superadmin, logowanie, usuwanie zastąpionych plików)
- [x] Serwowanie prywatnych plików marki przez /api/public/brand/$file po sprawdzeniu referencji
- [x] Nagłówek/stopka używają logo marki; favicon/og:image/SEO strony głównej z ustawień
- [x] E2E: przesyłanie, zapis, serwowanie 200/404, favicon+og+tytuł, sprzątanie, mobile 390px, dziennik zdarzeń
