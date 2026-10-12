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
- Brand images use the shared logo asset pointer; the favicon and embedded PDF watermark are resized exports of the same owner-supplied source. Why: preserve one consistent logo without runtime PDF asset downloads.
- Client sign-in state: only via useAuth() (src/hooks/use-auth.ts, one onAuthStateChange store); no per-component getUser/getSession copies for UI state. Why: header/pages stay consistent.
- E-mail notifications: every send goes through dispatch() in src/lib/notifications.server.ts (registry src/lib/notify/, overrides in email_templates/notification_rules, history in email_notification_log with idempotency_key); live delivery only via the deliver() adapter. Why: one engine, test mode and retries without touching templates.

- AI features call Lovable AI Gateway only from *.server.ts helpers (src/lib/ai/), streamed and consumed server-side; why: key stays on server, one place for model/error handling.
- Test orders are marked with library_orders.is_test; every sales/revenue statistic must filter is_test=false, and is_test never affects access. Why: keep test documentation without skewing revenue.
- Guest article comments: created only by server fn (src/lib/guest-comments.functions.ts) as pending_email; guest PII + SHA-256 token hash live in server-only article_comment_guests; publish only after a valid single-use token. Why: nothing public before e-mail confirmation, no plaintext tokens.

- Library catalogue: Biblioteka TNB is the single catalogue for free, members-only and paid materials; filters live in the URL (dostep/format/kategoria/sort/q) and /materialy-premium redirects to ?dostep=premium. Why: one catalogue, no duplicate premium module.
- Biblioteka materials follow the editorial standard in src/config/editorial.ts, shown read-only at /admin/standardy; why: static content needs no table and is versioned with code.
- Library PDFs: new uploads go through src/lib/library/pdf.server.ts (original in originals/, only the watermarked copy becomes file_path; failed -> no file served); free-material delivery modes (direct/form_download/email) + every download/request logged in library_requests (admin-only reads, 12-month retention). Why: no unmarked file ever served, one register.
- Editorial AI assistant (/admin/asystent-ai): superadmin-only (assertSuperadmin + RLS on ai_* tables); context retrieval over approved sources per run, no model training; model calls only on explicit admin click; community analysis off until admin records a decision. Why: privacy and cost control.
- TNB Visual Builder (/admin/strony → "Edytuj wizualnie"): the one visual editing layer; renders the real public components (PageView in an iframe portal), edits the same site_pages row via a draft column, publishes through a strictly validated server fn, keeps site_page_versions; new areas join only via the builder registry (src/components/pages/builder/registry.tsx) with an explicit editability scope, unsupported areas stay functional and are marked. Why: one editor, no duplicated business logic, nothing goes public without approval.
- AI assistant materials: full drafts live in ai_materials with append-only ai_material_versions (superadmin-only); text formats hand off only as an ARTICLE draft (podcast scripts -> podcast_episodes; never the Library); provenance in admin-only article_ai_origin. Why: no second CMS, AI never publishes.


- Głos TNB social media (YouTube videos, Instagram media) come only from one admin-connected source each, synced server-side (youtube.server.ts / instagram.server.ts, official OAuth for Instagram) when >30 min old or manually; keys/tokens stay server-only, no manual entries or placeholders. Why: no duplicate catalogue, secrets never reach the browser.