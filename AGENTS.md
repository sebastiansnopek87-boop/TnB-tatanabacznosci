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

- Admin panel under /admin (src/routes/_authenticated/admin*); every admin server fn calls assertAdmin from src/lib/admin-auth.server.ts and logs via logEvent to admin_events; RLS repeats the rule — defense in depth.
- Signup open (email+confirmation, Google, Apple) -> /moje-tnb; roles granted only manually in user_roles.
- Private buckets only; public media served via /api/public/* routes after access checks. Module rules: src/lib/AGENTS.md.
- Roles: user_roles enum (superadmin, admin, moderator, editor, support, premium); panel access = admin; only superadmin changes roles (src/lib/users.functions.ts), last superadmin protected; why: reuse existing has_role/RLS.
- Platform settings: singleton platform_settings (public read of safe columns); writes only via server fn after assertSuperadmin; maintenance screen is a UI gate in __root, /admin and /auth exempt. Why: config editable, admins never locked out.
- Client sign-in state: only via useAuth() (src/hooks/use-auth.ts, one onAuthStateChange store); no per-component getUser/getSession copies for UI state. Why: header/pages stay consistent.
- E-mail notifications: every send goes through dispatch() in src/lib/notifications.server.ts (registry src/lib/notify/, overrides in email_templates/notification_rules, history in email_notification_log with idempotency_key); live delivery only via the deliver() adapter. Why: one engine, test mode and retries without touching templates.

- AI features call Lovable AI Gateway only from *.server.ts helpers (src/lib/ai/), streamed and consumed server-side; why: key stays on server, one place for model/error handling.
