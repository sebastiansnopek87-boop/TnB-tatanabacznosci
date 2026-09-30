# Etap 15 — Użytkownicy i role (propozycja przed wykonaniem)

## Stan obecny
- Role w bazie: tylko `admin` i `premium` (osobna tabela ról, nadawane ręcznie).
- `admin` otwiera cały panel; wszystkie zabezpieczenia bazy sprawdzają właśnie tę rolę.
- `premium` odblokowuje odcinki premium w Podcaście.
- Konta: tatanabacznosci@gmail.com (admin), sebastiansnopek87@gmail.com (brak ról).

## Proponowany model ról (minimalna migracja)
Dodaję do istniejącej listy ról 4 nowe wartości — bez nowych tabel, bez zmiany istniejących zabezpieczeń:

| Rola | Co daje w tym etapie |
|---|---|
| Superadministrator | wszystko, co admin + jako jedyny zarządza rolami |
| Administrator (istniejąca) | cały panel, jak dotąd |
| Moderator, Redaktor, Obsługa użytkowników | zapisywane i widoczne na liście; dostęp do konkretnych zakładek dojdzie w osobnym etapie |
| Użytkownik | brak dodatkowej roli (stan domyślny) |
| Premium (istniejąca) | bez zmian |

Wpływ: żadne istniejące konto nie traci ani nie zyskuje uprawnień. Nikt nie dostaje roli automatycznie.

**Pierwszy superadministrator:** ktoś musi nim zostać, inaczej nikt nie zarządzi rolami. Proponuję nadać tę rolę kontu tatanabacznosci@gmail.com jednorazowo, dopiero po Twojej akceptacji tego planu.

## Ekran „Użytkownicy” (grupa Zarządzanie)
- Lista kont po 25 na stronę: e-mail, imię i nazwisko / nick (jeśli są), data rejestracji, potwierdzenie e-maila, ostatnie logowanie, role.
- Wyszukiwanie po e-mailu, imieniu, nazwisku, nicku; filtr roli i statusu (potwierdzony / niepotwierdzony).
- Szczegóły konta: dane profilu, sposób logowania, role. Bez haseł i tokenów.
- Nadawanie/odbieranie ról z oknem potwierdzenia; każda zmiana i każda odmowa trafia do Dziennika zdarzeń.
- Blokady po stronie serwera: tylko superadministrator zmienia role; nie da się odebrać ostatniego superadministratora (ani sobie, ani komuś innemu).
- Karta „Użytkownicy” na pulpicie prowadzi do listy.

## Poza zakresem
- Dezaktywacja i usuwanie kont (brak bezpiecznego mechanizmu w obecnej aplikacji bez dodatkowych zmian).
- Rzeczywiste ograniczenie zakładek dla Moderatora / Redaktora / Obsługi.

## Zakładka „Treści strony”
To tylko zapowiedź — ukrywam ją w menu, kod zostaje.

## Testy
Wszystkie 10 punktów ze specyfikacji w przeglądarce (admin i konto bez uprawnień, komputer i telefon), raport tylko z faktycznie wykonanych testów.

## Szczegóły techniczne
- Migracja: `ALTER TYPE app_role ADD VALUE` ×4 (superadmin, moderator, editor, support). `has_role`, RLS bez zmian.
- `assertSuperadmin` w admin-auth.server.ts; nowe `src/lib/users.functions.ts` (listUsers przez auth admin API z paginacją, getUser, setUserRole); zapisy ról przez service role dopiero po weryfikacji; blokada ostatniego superadmina liczona w bazie przed usunięciem.
- Nowa trasa `admin.uzytkownicy.tsx`, wpisy w events.ts (role_granted, role_revoked).
