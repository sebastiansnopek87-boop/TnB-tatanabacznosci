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
- Admin accounts are created manually (public signup disabled); roles live only in user_roles.
