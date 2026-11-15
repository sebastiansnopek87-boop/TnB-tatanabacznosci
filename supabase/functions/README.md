# Deployed Supabase Edge Functions

Source snapshot exported from Supabase project `pmdfiipontreuclfumdh` on 2026-11-15.

| Function | Deployed version | JWT verification |
|---|---:|---|
| `tnb-health` | 1 | enabled |
| `tnb-users` | 3 | enabled |
| `tnb-platform` | 1 | enabled |
| `tnb-brand` | 1 | disabled; handler performs its own request authentication/authorization |
| `tnb-pages` | 1 | disabled; handler performs its own request authentication/authorization |
| `tnb-templates` | 2 | disabled; handler performs its own request authentication/authorization |

The function entrypoints, per-function `deno.json` import maps, and relative shared modules are stored under each function directory. This snapshot does not deploy functions or change the database.
