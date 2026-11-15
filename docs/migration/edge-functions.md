# TNB Supabase Edge Functions

This folder contains the backend endpoints for the static React SPA migration. The previous TanStack Start server functions and API routes are being moved here module by module.

## Deployed functions

- `tnb-health`: authenticated health endpoint for the TNB Edge runtime.
- `tnb-users`: authenticated admin API for listing accounts, reading account details and changing roles.

## tnb-users contract

All requests use `POST` JSON and require a Supabase Auth access token in the `Authorization` header.

```json
{ "action": "listUsers", "q": "", "role": "", "status": "", "page": 0 }
{ "action": "getUserDetail", "id": "<uuid>" }
{ "action": "setUserRole", "id": "<uuid>", "role": "admin", "grant": true }
```

The function verifies the access token through Supabase Auth, checks the caller's role, uses the service-role client only after those checks, and sends role mutations to the atomic `public.admin_set_user_role` procedure. An actor ID is derived from the verified session and is never accepted from the request body.

CORS allows the TNB production origins and local Vite development origin. The browser invokes the function through `supabase.functions.invoke`; the shared Supabase client supplies the publishable key and user session.

## Migration files

The SQL files `0059`–`0062` mirror migrations already applied to the selected target project. They are kept here so the repository records the actual deployed database state. Do not run them blindly against a database that already has these migrations.

## tnb-platform

The authenticated `tnb-platform` endpoint handles admin settings and security status:

- `getPlatformSettings`: private admin settings, including billing fields, returned only after an admin role check.
- `updatePlatformSettings`: superadmin-only platform settings update, including maintenance mode and billing fields.
- `setVisualEffects`: superadmin-only visual effects configuration.
- `setModuleVisibility`: superadmin-only module visibility configuration with a server-side module allowlist.
- `setPodcastLayout`: admin-only podcast layout update.
- `getSecurityStatus`: admin-only security status and recent denied/failed events.

Public non-billing settings are read directly by the browser through the database column allowlist. The four billing columns are not granted to `anon` or `authenticated`; they are read only by this Edge Function after authorization.

