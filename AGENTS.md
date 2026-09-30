<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Admin e-mail notifications go through src/lib/notifications.server.ts, configured by the single-row email_settings table and logged to email_notification_log — one place for a future admin email panel.
- Newsletter subscribers store consent text/version/time and opt-in method; status is active only when the configured opt-in mechanism is satisfied.
- Admin panel lives under /admin (src/routes/_authenticated/admin*); every admin server fn in src/lib/admin.functions.ts calls assertAdmin (has_role RPC) and RLS admin policies back it up — defense in depth.
- Public signup is open (email+confirmation, Google, Apple) and lands on /moje-tnb; admin role is only granted manually in user_roles.
- Community (/spolecznosc) is a public route: guests read only visibility='public' AND status='published' posts via anon RLS + column grants (no author_id, no comments/reactions); all writes stay authenticated-only — keeps private data out of anon reach.
- Library (/biblioteka): metadata in library_items (anon column grants, published only); protected text/file refs in library_item_content gated by library_can_read(); files in private bucket library-files served via signed URLs (getLibraryFileUrl) and covers via /api/public/library-cover/$id; premium = app_role premium — content never leaks through public queries.
- Library premium access = paid row in library_orders (written only by server/service role after provider confirmation, never from browser); library_can_read checks it — premium role no longer grants library content.
- Premium purchases: order row created server-side with DB price, bank transfer only (Stripe removed; online_p24 placeholder for future Przelewy24); only admins mark paid/delivered via adminSetOrderStatus, recording actor+time; logic in src/lib/orders.server.ts — client can never set paid.
- Meetings (/spotkania, /spotkania/$slug, /spotkania/zgloszenie/$token): public reads via server fns with explicit safe columns (online_link and unpublished location never leave the server); registrations inserted only server-side with honeypot, per-email uniqueness and a DB capacity trigger; images in private bucket meeting-images served via /api/public/meeting-image/$id; admin ops in src/lib/meetings.functions.ts with assertAdmin + RLS.
- Podcast (/podcast, /podcast/$slug): podcast_episodes is admin-only under RLS; public reads via server fns with safe columns; audio/cover in private bucket podcast-files (admin uploads via signed upload URLs); playback URL (signed, 3h) or external link returned by getEpisodeMedia only after access check (members = logged in, premium = app_role premium or admin); covers via /api/public/podcast-cover/$id.
