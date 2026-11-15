# SPA migration status — 2026-11-15

Working branch: `migration/react-spa`  
Rollback point: `backup/pre-spa-migration-2026-11-15`  
Production branch: `main` (do not deploy this work branch directly)

## Verified production project

- Supabase project: `pmdfiipontreuclfumdh`, region `eu-west-3`, status `ACTIVE_HEALTHY`.
- `supabase/config.toml` now points to that project.
- The generated `src/integrations/supabase/types.ts` is synchronized with the live schema, including RPC `admin_set_user_role` and PostgREST 14.18.
- The database reports 64 applied migrations, but the matching SQL migration files are not present in this Git repository. Do not run `db reset` or `db push` until reproducible migration history has been restored.
- Secret-bearing tables `instagram_secret`, `youtube_secret`, and `payment_webhook_events` have RLS enabled; `anon` and `authenticated` have no SELECT privilege. This is intentional. Do not add public policies to silence advisor warnings.

## Work completed on this branch

- Added `src/lib/api/client.ts`, a shared `supabase.functions.invoke` client that uses the active browser session and converts Edge Function error payloads into typed application errors. It does not contain privileged credentials.
- Migrated the user administration page to `tnb-users`: list, detail, and role update. The page no longer imports `useServerFn`. Role changes are handled by the deployed function through the atomic `admin_set_user_role` database procedure.
- Migrated platform settings read and update in the platform settings page to `tnb-platform`. The billing fields are still returned only by the authenticated Edge Function; they are not read directly from the browser.
- Existing Edge Functions verified during this stage: `tnb-health`, `tnb-users`, `tnb-platform`, `tnb-brand`, `tnb-pages`, and `tnb-templates`. The UI adapters for domains not yet migrated must not be assumed to call these functions yet.

## Remaining blockers before static hosting

- The app is still built with TanStack Start/Nitro. The current `vite.config.ts` imports `@lovable.dev/vite-tanstack-config`; there is no root `index.html` or `src/main.tsx`. The presence of `public/.htaccess` alone does not make the app a static SPA.
- The route tree contains 72 route entries, including 13 server-only `/api/public/*` handlers. They still need client/server separation and replacement Edge Functions.
- Most `src/lib/api/*` adapters still re-export `createServerFn` modules. Only the user administration and platform-settings operations listed above are switched to direct Edge Function calls.
- Edge Function source files and the 64 SQL migrations are not currently tracked under `supabase/functions/*` and `supabase/migrations/*` in this repository. They must be versioned before the GitHub repository can be the complete source of truth.
- No successful production build or end-to-end verification has been recorded for this branch yet. Do not merge or deploy until typecheck/build, direct endpoint tests, deep-link refresh, authentication, admin roles, and the critical payment/webhook flows pass.

## Next implementation order

1. Migrate the remaining operations that already have deployed Edge Function counterparts, preserving current UI behavior and response contracts.
2. Port remaining server functions and the 13 public HTTP handlers to Edge Functions; preserve webhook signature checks, OAuth state validation, JWT/role checks, and admin event logging.
3. Restore versioned SQL migration and Edge Function source files to GitHub from the verified live state. Keep migrations additive and do not alter production data without a reviewed migration.
4. Convert the frontend/router to the agreed static SPA architecture, preserving all 72 public and authenticated URLs.
5. Add automated build, secret scanning, route-refresh, auth/role, and payment/webhook checks. Deploy to Cyberfolks only after acceptance.

## Safety constraints

No service-role key, provider secret, or webhook secret may enter browser code or `dist/`. Do not change RLS or role rules as a shortcut. Do not send real mail, charge real payments, or alter production content during migration tests.
