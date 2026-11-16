# Przełączenie zadań cyklicznych TNB na Supabase Edge

Przed opublikowaniem statycznego SPA trzeba zmienić dwa zadania w panelu Cyberfolks. Stare adresy `/api/public/cron/*` będą zwracały HTTP 410, więc nie mogą pozostać w harmonogramie.

W projekcie Supabase `pmdfiipontreuclfumdh` dodaj sekret Edge o nazwie `TNB_CRON_SECRET`. Wygeneruj nową, losową wartość w menedżerze haseł. Ustaw dokładnie tę samą wartość w nagłówku `Authorization` obu zadań Cyberfolks. Nie umieszczaj sekretu w repozytorium, plikach `.env` wysyłanych na hosting ani wiadomościach.

Oba zadania wykonuj metodą POST z nagłówkami:
- `Authorization: Bearer <wartość TNB_CRON_SECRET>`
- `Content-Type: application/json`

Adresy i treści:
- Konsultacje (przypomnienia 24 godziny przed terminem): `https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-consult`, body `{"action":"processReminders"}`.
- Instagram (synchronizacja, gdy ostatnia jest starsza niż 30 minut): `https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-voice`, body `{"action":"cronInstagramSync"}`.

Po zapisaniu ustawień uruchom oba zadania ręcznie i potwierdź HTTP 200. Brak lub błędny sekret daje HTTP 401; brak konfiguracji sekretu w Supabase daje HTTP 503.

Płatności: obecny checkout tworzy powiadomienia operatorów bezpośrednio przez `tnb-orders` i `tnb-payments`. Stare ścieżki P24/PayU/Tpay w aplikacji są wycofane. Meta OAuth zachowuje dotychczasową ścieżkę callback `/api/public/instagram/callback`, ale jej obsługa jest już trasą React SPA.