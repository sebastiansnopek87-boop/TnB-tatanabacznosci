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

## tnb-brand

The `tnb-brand` Edge Function replaces server-side branding operations and the dynamic public brand-image route.

- Admin POST actions: `getBrandSettings`, `createBrandUpload`, `finalizeBrandUpload`, and `saveBrandSettings`.
- Public GET action: `?file=<uuid>.<ext>` returns an image only when the exact file path is currently referenced by one of the public brand image fields.
- Branding assets remain in the private `media` bucket. Upload URLs are signed, upload metadata is checked after transfer, and unreferenced replaced files are removed.
- Platform settings mutations require a verified Supabase session and the superadmin role. The public image GET requires no session but cannot enumerate or read arbitrary storage objects.
- Gateway JWT verification is disabled only because public image requests from `<img>` cannot send an Authorization header. Every administrative POST independently verifies the user's access token with Supabase Auth and checks roles before accessing the service-role client.

## tnb-pages

The authenticated CMS API and public read endpoints live in `tnb-pages`.

- Public page reads return only rows with `status = 'published'`.
- Legal pages receive `legal_approved = true` only when the published content digest matches a stored publish snapshot and matching `legal_document_approved` audit event.
- Admin CMS actions require a valid Supabase access token and an `admin` role before the service-role client is used.
- It supports page list/detail, slug checks, content saves, status changes, signed upload and preview URLs, drafts, publication, version history, restoration and home-page draft initialization.
- Public page images are served only when the page is published and the requested filename is currently referenced by that page.
- Shared CMS validation files are stored in the function's `_shared` directory.

## tnb-templates

The authenticated `tnb-templates` API provides CRUD, duplication, insertion and signed image previews for Visual Builder templates. It copies image assets into each template directory and copies them into a page when inserted. Template images and page images remain independent; deleting a template does not delete images already inserted into pages.

Both functions have platform JWT verification disabled because they share public read or browser image requests. Every administrative POST validates the bearer token with Supabase Auth and checks the caller's admin role before using service-role access.

