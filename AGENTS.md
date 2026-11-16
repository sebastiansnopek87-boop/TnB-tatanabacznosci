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

- Admin functions use assertAdmin/logEvent; RLS repeats access rules for defense in depth.
- Open signup (confirmed email, Google, Apple) -> /moje-tnb; user_roles granted manually.
- Frontend produkcyjny to statyczny Vite CSR: `index.html` → `src/main.tsx` → `src/router.tsx`; nie przywracać TanStack Start SSR ani endpointów `/api/*`. Głębokie trasy obsługuje `public/.htaccess`, a callback Meta przekazuje do `tnb-voice`. TanStack Start pozostaje wyłącznie jako zależność developerska dla nieprzeniesionych testów legacy; nie może wrócić do ścieżki produkcyjnej.
- Private buckets only; public media served by existing Supabase Edge Functions (`tnb-assets`, `tnb-articles`, `tnb-brand`, `tnb-media`, `tnb-pages` and module-specific functions) after access/reference checks. Read subdirectory AGENTS.md before changing files there; module rules: src/lib/AGENTS.md.
- Roles: user_roles enum (superadmin, admin, moderator, editor, support, premium); panel access = admin; only superadmin changes roles (src/lib/users.functions.ts), last superadmin protected; why: reuse existing has_role/RLS.
- Platform settings: singleton platform_settings (public read of safe columns); browser operations go through `src/lib/api/platform.ts` to Supabase Edge Functions, with superadmin checks and RLS defense in depth; maintenance screen is a UI gate in `__root`, `/admin` and `/auth` exempt. Why: config editable, admins never locked out.
- Module presentation flags live in platform_settings.module_visibility and use src/config/modules.ts for path matching; public menu/home sections and ModuleGate consume the same flags, never admin navigation or purchase delivery. Why: one visibility source without changing entitlements or deleting content.
- Site/AuthShell branding uses useBrand/brandSrc and getBrandSlogan; hidden/empty slogans render no spacing. PDF watermark stays bundled. Why: one admin-controlled source, no runtime PDF downloads.
- Client sign-in state: only via useAuth() (src/hooks/use-auth.ts, one onAuthStateChange store); no per-component getUser/getSession copies for UI state. Why: header/pages stay consistent.
- HeaderSearch reuses published reads and visibility; why: one catalogue. Main NAV uses a native modal dialog portaled to body with unchanged NAV/useAuth/visibility; why: top-layer isolation and focus containment.
- E-mail notifications: active UI actions call the relevant Supabase Edge Functions; delivery stays server-side, with the existing event/recipient rules, templates and `email_notification_log` idempotency history preserved. Do not send mail directly from the browser. Legacy `notifications.server.ts` remains only for rollback/regression tests until the test migration is complete. Why: one engine, test mode and retries without touching templates.

- AI provider credentials stay server-side in Supabase Edge Functions; the browser uses `src/lib/api/*` adapters and never receives provider keys. Legacy `*.server.ts` helpers are retained only until regression-test migration is complete.
- Test orders are marked with library_orders.is_test; every sales/revenue statistic must filter is_test=false, and is_test never affects access. Why: keep test documentation without skewing revenue.
- Guest article comments: created through `tnb-guest-comments` as `pending_email`; guest PII + SHA-256 token hash live in `article_comment_guests`; publish only after a valid single-use token. Why: nothing public before e-mail confirmation, no plaintext tokens.

- Editorial AI assistant (/admin/asystent-ai): superadmin-only (assertSuperadmin + RLS on ai_* tables); context retrieval over approved sources per run, no model training; model calls only on explicit admin click; community analysis off until admin records a decision. Why: privacy and cost control.
- Visual Builder reuses CMS drafts/versions; legal publication requires exact-content confirmation, snapshot/event proof and conditional updated_at write (details in src/lib/AGENTS.md). Why: no stale approval.
- CMS rich text uses validated Tiptap JSON in optional PageSection.textFormats and a shared React renderer; plain fields stay synchronized. Why: safe formatting, drafts and templates without migrations or raw HTML.
- AI assistant materials: full drafts live in ai_materials with append-only ai_material_versions (superadmin-only); text formats hand off only as an ARTICLE draft (podcast scripts -> podcast_episodes; never the Library); provenance in admin-only article_ai_origin. Why: no second CMS, AI never publishes.

- Głos TNB social media (YouTube videos, Instagram media) come only from one admin-connected source each, synced server-side (youtube.server.ts / instagram.server.ts, official OAuth for Instagram) when >30 min old or manually; keys/tokens stay server-only, no manual entries or placeholders. Why: no duplicate catalogue, secrets never reach the browser.
- Visual effects: platform_settings.visual_effects (public flags) -> data-fx-* attributes on <html> via VisualEffects in __root + CSS in styles.css; content visible unless JS adds fx-ready, reduced-motion always wins. Why: one source, no animation library, no hidden content on failure.

- Protected account settings are separate; Moje TNB reuses collections/bookings without changing access.
- Avatars use owner-scoped `tnb-media` actions, private storage and `user_avatars`; shared UserAvatar serves own or visible-community context; media usage protects referenced avatars. Why: one view without external URLs or public account IDs.
- Admin order/user deep links validate optional UUID `record` and open existing details; why: exact navigation without a second editor.
- Cinematic home blocks are draft-only until explicit CMS publication; why: preserve public home. See src/lib/AGENTS.md.


- Admin UI uses .admin-panel tokens; preserve routes/auth/queries to isolate styling.
- UI imports backend operations only via src/lib/api/* (never *.functions directly); why: SPA migration swaps the implementation in one place.
