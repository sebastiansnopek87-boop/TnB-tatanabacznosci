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
