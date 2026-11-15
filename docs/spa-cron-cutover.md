# Przełączenie zadań cyklicznych TNB na Supabase Edge

Przed wdrożeniem statycznego SPA trzeba zmienić dwa zadania w panelu Cyberfolks. W aplikacji stare ścieżki \`/api/public/cron/*\` zostaną zakończone odpowiedzią HTTP 410, aby nie zwracać HTML zamiast wyniku zadania.

W projekcie Supabase \`pmdfiipontreuclfumdh\` dodaj do Edge Function Secrets ten sam sekret, którego obecnie używa Cyberfolks jako \`LOVABLE_CRON_SECRET\`. Nie wklejaj go do repozytorium ani kodu. Edge akceptuje bieżący sekret z \`LOVABLE_CRON_SECRET\` lub \`TNB_CRON_SECRET\`, a do rotacji również warianty \`*_PREVIOUS\`.

Ustaw oba zadania jako POST z nagłówkami:
- \`Authorization: Bearer <ten sam sekret>\`
- \`Content-Type: application/json\`

Nowe adresy:
- Konsultacje (przypomnienia 24 h): \`https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-consult\`, body \`{"action":"processReminders"}\`.
- Instagram (synchronizacja tylko po 30 min nieaktywności): \`https://pmdfiipontreuclfumdh.supabase.co/functions/v1/tnb-voice\`, body \`{"action":"cronInstagramSync"}\`.

Sprawdź oba zadania ręcznym wywołaniem i potwierdź odpowiedź HTTP 200 przed wdrożeniem SPA. Funkcje zwracają 401 przy braku/błędnym tokenie oraz 503, gdy sekret Edge nie został skonfigurowany.

Płatności: nowe powiadomienia operatorów są generowane przez \`tnb-orders\` bezpośrednio na \`/functions/v1/tnb-payments?provider=...\`. Stare ścieżki P24/PayU/Tpay nie są już endpointami aplikacji.
