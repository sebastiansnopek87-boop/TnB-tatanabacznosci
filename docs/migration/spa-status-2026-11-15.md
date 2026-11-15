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

- Added `src/lib/api/client.ts`, a shared `supabase.functions.invoke` client that uses the active browser session and converts Edge Function error payloads into typed application errors. It contains no privileged credentials.
- Migrated the user administration page to `tnb-users`: list, detail, and role update. The page no longer imports `useServerFn`. Role changes use the deployed function and atomic `admin_set_user_role` database procedure.
- Migrated the platform settings operations to `tnb-platform`: administrative settings read/update, module visibility, visual effects, podcast layout, and security status. Public settings are now read directly through Supabase using the verified public-column allowlist and existing SELECT RLS policy. Billing columns and update metadata remain unavailable to browser roles.
- Migrated the branding settings and upload flow to `tnb-brand`: read/save settings, signed upload creation, and server-side upload verification.
- Snapshotted all six deployed Edge Functions and their Deno configuration into `supabase/functions/*`: `tnb-health` v1, `tnb-users` v4, `tnb-platform` v1, `tnb-brand` v1, `tnb-pages` v1, and `tnb-templates` v2. All 17 saved files were compared byte-for-byte with the current deployed snapshots.
- Added `verify_jwt` settings for all six functions to `supabase/config.toml`. These values match the active Supabase configuration.

## Remaining blockers before static hosting

- The app is still built with TanStack Start/Nitro. The current `vite.config.ts` imports `@lovable.dev/vite-tanstack-config`; there is no root `index.html` or `src/main.tsx`. The presence of `public/.htaccess` alone does not make the app a static SPA.
- The route tree contains 72 route entries, including 13 server-only `/api/public/*` handlers. They still need client/server separation and replacement Edge Functions.
- Most `src/lib/api/*` adapters still re-export `createServerFn` modules. Only the user administration and platform-settings operations listed above are switched to direct Edge Function calls.
- The six currently deployed Edge Functions are now tracked. The 64 SQL migrations are still not present under `supabase/migrations/*`; restore their exact SQL history or create a reviewed baseline from the live schema before treating GitHub as the complete database source of truth.
- No successful production build or end-to-end verification has been recorded for this branch yet. Do not merge or deploy until typecheck/build, direct endpoint tests, deep-link refresh, authentication, admin roles, and the critical payment/webhook flows pass.

## Next implementation order

1. Migrate the remaining operations that already have deployed Edge Function counterparts, preserving current UI behavior and response contracts.
2. Port remaining server functions and the 13 public HTTP handlers to Edge Functions; preserve webhook signature checks, OAuth state validation, JWT/role checks, and admin event logging.
3. Restore versioned SQL migration and Edge Function source files to GitHub from the verified live state. Keep migrations additive and do not alter production data without a reviewed migration.
4. Convert the frontend/router to the agreed static SPA architecture, preserving all 72 public and authenticated URLs.
5. Add automated build, secret scanning, route-refresh, auth/role, and payment/webhook checks. Deploy to Cyberfolks only after acceptance.

## Safety constraints

No service-role key, provider secret, or webhook secret may enter browser code or `dist/`. Do not change RLS or role rules as a shortcut. Do not send real mail, charge real payments, or alter production content during migration tests.
