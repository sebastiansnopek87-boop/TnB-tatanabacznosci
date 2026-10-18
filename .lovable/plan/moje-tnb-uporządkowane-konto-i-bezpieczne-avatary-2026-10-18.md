# Moje TNB — uporządkowane konto i bezpieczne avatary

## Potwierdzona diagnoza
- Obecne „Moje TNB” ma wszystkie wymagane funkcje, ale pokazuje je jako długi zestaw jednakowych paneli. Profil i zmiana hasła działają na danych własnego konta; materiały, artykuły i rezerwacje mają istniejące źródła.
- W bazie nie ma tabeli `profiles`, pola avatara ani katalogu avatarów. Istnieje `user_identities`, służące stałemu identyfikatorowi i podpisowi. Nie zmieniamy jego przeznaczenia.
- Dostęp do panelu i moderacji wymaga roli `admin`, zarówno na serwerze, jak i w zasadach bazy. Sama rola `moderator` nie daje obecnie takich funkcji. Nie dodamy pozornego skrótu ani nowych uprawnień.

## Zakres po zatwierdzeniu
1. **Moje TNB:** avatar, powitanie z rzeczywistym imieniem (bez imienia: „Witaj”), wskazany tekst i cztery kompaktowe akcje: Biblioteka, Moje materiały, Umów rozmowę, Nadchodzące spotkania.
2. **Moja przestrzeń:** istniejące spotkania, rozmowy, zapisane artykuły i materiały w maksymalnie dwóch kolumnach. Najbliższe terminy jako pierwsze, historia dostępna bez dużych pustych paneli. Przyjazne puste stany z przyciskami do istniejących funkcji.
3. **Ustawienia konta:** osobna chroniona podstrona z powrotem do Moje TNB, wszystkimi obecnymi polami i walidacją, wyborem podpisu, zmianą hasła, avatarem i wylogowaniem. Przeniesienie istniejących formularzy zamiast pisania nowych mechanizmów.
4. **Uprawnienia:** „Panel administracyjny” na samej górze tylko przy potwierdzonym dostępie. Zachować konta zwykłe, moderatorów, administratorów i superadministratorów bez nadawania ról.
5. **Avatar:** wybór obrazu z urządzenia, podgląd przed zapisem, zmiana i usunięcie; domyślnie inicjały lub neutralny znak osoby. Wspólny wygląd na koncie, w ustawieniach, nagłówku i istniejących prezentacjach autorów społeczności. Bez pobierania dowolnych zewnętrznych adresów.

## Minimalna zmiana bazy — do osobnej zgody
Jedna nowa tabela `public.user_avatars`, zawierająca tylko identyfikator właściciela, ścieżkę własnego obrazu i datę zmiany. Bez nowych bucketów, bez zmian istniejących tabel, ról, uprawnień ani danych.

**Finalny proponowany SQL:**
```sql
BEGIN;

CREATE TABLE public.user_avatars (
  user_id uuid PRIMARY KEY,
  object_path text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_avatar_owned_path CHECK (
    object_path ~ ('^avatars/' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
  )
);
GRANT SELECT ON public.user_avatars TO authenticated;
GRANT ALL ON public.user_avatars TO service_role;
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own avatar reference"
  ON public.user_avatars FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.user_avatars IS
  'Own avatar references only. Writes through authenticated server functions using verified caller identity; private images in media. No browser writes or anonymous table reads.';

COMMIT;
```

## Szczegóły techniczne i bezpieczeństwo
- Prywatny istniejący bucket `media`, ścieżki `avatars/<właściciel>/<losowy identyfikator>.webp`. Przesyłanie i zapis wyłącznie przez autoryzowane funkcje serwerowe, właściciel ustalany z sesji, nigdy z przesłanego ID. Brak operacji zmiany avatara innej osoby, także dla admina.
- Proponowany limit wejścia: 5 MB, JPEG/PNG/WebP, maksymalnie 4096×4096; dekodowanie i walidacja rzeczywistego obrazu, normalizacja do 384×384 WebP oraz usunięcie metadanych. Serwer ponownie sprawdza zawartość przed zapisem. SVG i inne typy odrzucane.
- Pliki serwowane przez sprawdzającą dostęp funkcję, nie bezpośrednio z prywatnego magazynu. W społeczności odczyt powiązany z rzeczywiście widocznym wpisem/komentarzem; nie ujawniamy anonimowym odbiorcom UUID autora ani prywatnych danych konta. Usunięcie/replacement unieważnia poprzednią referencję.
- Panel multimediów musi rozpoznawać używane avatary, aby nie usuwał plików w użyciu. Nie otwieramy pozostałych prywatnych plików.
- Ten sam `useAuth` i istniejący serwerowy odczyt uprawnień. Bez zmian OAuth, płatności, dostępu do materiałów i zasad rezerwacji.
- Nowa podstrona dostaje własny tytuł i opis. Logo, pozostałe strony oraz identyfikacja TNB bez zmian.

## Weryfikacja i raport
- Komputer i 390 px: skróty, powrót z ustawień, działające istniejące funkcje, brak przepełnień, fokus i wygodne przyciski.
- Avatar: dodanie, podgląd, zapis i odczyt po odświeżeniu, zmiana, usunięcie, domyślny widok, odrzucenie błędnego obrazu i próby zmiany cudzego avatara.
- Profil: rzeczywisty zapis i odczyt, przywrócenie testowej zmiany. Zmiana hasła: walidacja i błędne obecne hasło; skuteczna zmiana wyłącznie na istniejącym koncie testowym z dostępnym hasłem, nigdy zmiana hasła właściciela bez uzgodnienia.
- Role: testy reguł oraz osobno widoczność i dostęp dla dostępnych kont. Nie tworzymy kont, nie zmieniamy ról i nie dodajemy fikcyjnych rezerwacji tylko do testu. Brakujące stany/konta oznaczymy jako niezweryfikowane; testy danych wypełnionych tylko na istniejących danych.
- Raport wymieni zmienione elementy i wyniki testów, w tym blokady, bez deklarowania nieprzeprowadzonych sprawdzeń.

**Stan:** analiza ukończona; nie zmieniono aplikacji ani bazy. Wdrożenie zatrzymane przed zmianą bazy zgodnie z dokumentami.