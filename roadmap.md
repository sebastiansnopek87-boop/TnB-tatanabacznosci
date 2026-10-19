# Roadmap
- [ ] Przycisk społeczności w filmowym HERO: konfiguracja sesyjna/stała i widoczność w CMS, testy tras oraz trwałego zapisu szkicu, bez publikacji.
- [x] Jawne zatwierdzanie dokumentów prawnych: checkbox dla konkretnej treści, SHA-256 + wersja publish + zweryfikowany dziennik, warunkowy zapis updated_at; 28 testów CMS i 19 regresji PASS, build OK; podgląd potwierdza blokadę/reset checkboxa i 5 tras HTTP 200 bez błędów. Zatwierdzenie/publikacja tylko w pamięci testów — żadnych zapisów i publikacji rzeczywistych dokumentów, bez migracji.
- [x] Strony prawne: istniejący CMS i Visual Builder, stałe adresy, ostrzeżenia i serwerowa blokada publikacji bez treści/zatwierdzenia; 15 testów w pamięci PASS, 19 testów regresji PASS, odczytowy podgląd 5 tras i formularza PASS; bez migracji, zapisów dokumentów i publikacji. Zapis/odczyt prawdziwego dokumentu pozostaje nieprzetestowany — treści i zatwierdzenie to osobny etap.
- [x] Centrum kontroli 360°: parametr record (UUID) otwiera istniejące szczegóły zamówienia/konta; tytuły i slugi materiałów; e-mail related_id + trzeci offset historii. 19 testów PASS i zalogowane E2E tylko odczytowe PASS; bez zmian bazy i publikacji.
- [x] Centrum kontroli Etap 3: historia dokładnych obiektów oddzielona od aktora, jawne błędy/limity, powiązania user_id/e-mail, wspólny hasAccess, slugi i pełne nazwisko, istniejące linki; 8 testów PASS, E2E odczytowe PASS, zamówienie 1010 niezmienione, bez zmian bazy; raport Etap-3-Centrum-kontroli-TNB.md.
- [x] Moje TNB: ograniczony audyt 0057 i aktualnych zabezpieczeń; regresja tylko do odczytu 1280/390 px, 9 testów PASS i raport; wykryto nadmiarowe ACL (TRUNCATE), bez zmian bazy i danych
- [ ] Moje TNB: ograniczenie nadmiarowych uprawnień user_avatars — wymaga osobnej zgody właściciela; audyt nie wprowadza napraw
- [ ] Moje TNB: pełny zapis/odczyt profilu oraz avatary wpisu i komentarza — potrzebne uzgodnione konto testowe i izolowane środowisko; brak zgody na zmianę rzeczywistych danych
- [x] Moje TNB: analiza istniejących funkcji, avatarów i uprawnień; minimalny plan oraz SQL przygotowane — wdrożenie czeka na osobną zgodę na bazę
- [x] Moje TNB: powitanie, cztery szybkie akcje, uporządkowana przestrzeń oraz osobne ustawienia konta
- [x] Moje TNB: bezpieczne własne avatary, wspólny widok w nagłówku i społeczności, skróty zgodne z faktycznym dostępem
- [x] Moje TNB: avatar dodanie/podgląd/zapis/odświeżenie/zmiana/usunięcie, SVG i fałszywy WebP, obcy identyfikator, walidacja profilu/hasła, skróty, superadmin i desktop/390 px; 9 testów automatycznych PASS
- [ ] Moje TNB: pełne E2E zwykłego konta, moderatora i administratora — potrzebne wskazanie istniejących kont oraz zgoda na sesje
- [ ] Moje TNB: skuteczna zmiana hasła — wymaga istniejącego konta testowego i uzgodnienia; hasła właściciela nie zmieniano
- [x] Slogan marki: diagnoza, zaakceptowany minimalny plan i finalny SQL aktualizacji walidacji
- [x] Slogan marki: migracja 0055, pola panelu, wspólny odczyt; E2E zapisu/odświeżenia/edycji/ukrycia/pustego tekstu w nagłówku, menu, stopce, logowaniu i rejestracji 1280/390 px; logi potwierdzone, próbny tekst przywrócony
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

## Centralne ustawienia danych firmy (2026-10-18) — ZROBIONE
- Migracja 0058: platform_settings +18 kolumn (firma, kontakt, faktury, stopka)
- /admin/ustawienia: sekcje firma/faktury/stopka; SiteFooter i /kontakt podpięte pod ustawienia
- Testy: platform.test.ts 5/5 PASS; E2E PASS

- [x] Strona główna w Visual Builderze: wspólny renderer, 7 edytowalnych sekcji, przełącznik Niezalogowany/Zalogowany, szkic bez publikacji.
- [ ] Nagłówek, menu i stopka w edytorze wizualnym (globalne) — osobny etap.
- [x] Filmowa sekcja „pięć etapów życia”: jeden blok na początku istniejącego szkicu home, pięć obrazów i edytowalne pola; 33 testy stron i 19 regresji PASS, build OK, zapis/odczyt i przywrócenie próbnego nagłówka PASS; 7 dotychczasowych sekcji oraz publiczna / niezmienione, bez publikacji. Przesyłanie nowych zdjęć w tym etapie nie było testowane.
