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

- Admin server functions use assertAdmin and logEvent; RLS repeats access rules. Why: defense in depth.
- Signup open (email+confirmation, Google, Apple) -> /moje-tnb; roles granted only manually in user_roles.
- Private buckets only; public media served via /api/public/* after access checks. Read subdirectory AGENTS.md before changing files there; module rules: src/lib/AGENTS.md.
- Roles: user_roles enum (superadmin, admin, moderator, editor, support, premium); panel access = admin; only superadmin changes roles (src/lib/users.functions.ts), last superadmin protected; why: reuse existing has_role/RLS.
- Platform settings: singleton platform_settings (public read of safe columns); writes only via server fn after assertSuperadmin; maintenance screen is a UI gate in __root, /admin and /auth exempt. Why: config editable, admins never locked out.
- Module presentation flags live in platform_settings.module_visibility and use src/config/modules.ts for path matching; public menu/home sections and ModuleGate consume the same flags, never admin navigation or purchase delivery. Why: one visibility source without changing entitlements or deleting content.
- Site/AuthShell branding uses useBrand/brandSrc and getBrandSlogan; hidden/empty slogans render no spacing. PDF watermark stays bundled. Why: one admin-controlled source, no runtime PDF downloads.
- Client sign-in state: only via useAuth() (src/hooks/use-auth.ts, one onAuthStateChange store); no per-component getUser/getSession copies for UI state. Why: header/pages stay consistent.
- HeaderSearch reuses published reads and visibility; why: one catalogue. Main NAV uses a native modal dialog portaled to body with unchanged NAV/useAuth/visibility; why: top-layer isolation and focus containment.
- E-mail notifications: every send goes through dispatch() in src/lib/notifications.server.ts (registry src/lib/notify/, overrides in email_templates/notification_rules, history in email_notification_log with idempotency_key); live delivery only via the deliver() adapter. Why: one engine, test mode and retries without touching templates.

- AI features call Lovable AI Gateway only from *.server.ts helpers (src/lib/ai/), streamed and consumed server-side; why: key stays on server, one place for model/error handling.
- Test orders are marked with library_orders.is_test; every sales/revenue statistic must filter is_test=false, and is_test never affects access. Why: keep test documentation without skewing revenue.
- Guest article comments: created only by server fn (src/lib/guest-comments.functions.ts) as pending_email; guest PII + SHA-256 token hash live in server-only article_comment_guests; publish only after a valid single-use token. Why: nothing public before e-mail confirmation, no plaintext tokens.

- Editorial AI assistant (/admin/asystent-ai): superadmin-only (assertSuperadmin + RLS on ai_* tables); context retrieval over approved sources per run, no model training; model calls only on explicit admin click; community analysis off until admin records a decision. Why: privacy and cost control.
- Visual Builder reuses CMS drafts/versions; legal publication requires exact-content confirmation, snapshot/event proof and conditional updated_at write (details in src/lib/AGENTS.md). Why: no stale approval.
- CMS rich text: validated Tiptap JSON + synced plain fields and shared renderer. Home uses existing CMS drafts/versions for scenes/nav/values, published-only with legacy fallback; lower sections remain. Details: src/lib/AGENTS.md. Why: one editor, explicit publication.
- AI assistant materials: full drafts live in ai_materials with append-only ai_material_versions (superadmin-only); text formats hand off only as an ARTICLE draft (podcast scripts -> podcast_episodes; never the Library); provenance in admin-only article_ai_origin. Why: no second CMS, AI never publishes.

- Głos TNB social media (YouTube videos, Instagram media) come only from one admin-connected source each, synced server-side (youtube.server.ts / instagram.server.ts, official OAuth for Instagram) when >30 min old or manually; keys/tokens stay server-only, no manual entries or placeholders. Why: no duplicate catalogue, secrets never reach the browser.
- Visual effects: platform_settings.visual_effects (public flags) -> data-fx-* attributes on <html> via VisualEffects in __root + CSS in styles.css; content visible unless JS adds fx-ready, reduced-motion always wins. Why: one source, no animation library, no hidden content on failure.

- Account forms stay on a protected settings route; Moje TNB reuses collections and bookings. Why: separate maintenance without changing access.
- Avatars use owner-scoped server functions, private media and user_avatars; shared UserAvatar serves own or visible-community context; media usage protects referenced avatars. Why: one view without external URLs or public account IDs.
- Admin order/user deep links validate optional UUID `record` and open existing details; why: exact navigation without a second editor.

