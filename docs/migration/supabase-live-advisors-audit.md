# Supabase production advisor audit

Date: 2026-11-19
Project: `pmdfiipontreuclfumdh` (read-only advisor inspection)
Branch: `chore/legacy-runtime-audit`

## Scope and safety

This is a read-only snapshot from Supabase Database Advisors. No SQL, DDL, grants, policies, Auth settings, secrets, or Edge Function deployments were changed. Advisor findings are signals requiring review against actual application contracts; they are not automatic instructions to change production.

## Security findings

- `rls_enabled_no_policy`: 3 tables have RLS enabled and no policies: `instagram_secret`, `payment_webhook_events`, `youtube_secret`. This can be intentional for service-role-only access. Verify all callers and grants before adding policies; do not make these tables client-readable.
- `extension_in_public`: `pg_net` is installed in `public`. Moving an extension requires dependency and cron/net call review.
- `anon_security_definer_function_executable`: 9 SECURITY DEFINER RPC functions are callable by `anon`. Advisor examples include `article_is_public`, `article_poll_open`, `article_stats`, `community_feed`, `community_feed_filtered`, `community_post_stats`, `community_search`, `community_sector_counts`, and `library_can_read`.
- `authenticated_security_definer_function_executable`: 13 SECURITY DEFINER RPC functions are callable by `authenticated`. In addition to several above, findings include `community_post_visible`, `ensure_my_identity`, `has_role`, and `set_my_display_mode`. The overlap between the anon and authenticated sets means the counts must not be summed as unique functions.
- `auth_leaked_password_protection`: Supabase Auth leaked-password protection is disabled.

The SECURITY DEFINER warnings need function-body review (authorization predicates, search_path, data returned, intended public access) before changing EXECUTE grants or security mode. In particular, do not revoke access from `has_role` or public content RPCs without checking every caller and expected public behaviour.

## Performance findings

- `auth_rls_initplan`: multiple policies repeatedly evaluate auth/current_setting functions per row. Advisor recommends wrapping stable calls such as `auth.uid()` in scalar subqueries, but policy edits must preserve exact role and ownership semantics.
- `unused_index`: 24 indexes are currently reported unused. This is not sufficient evidence to drop them; usage counters may reset and indexes may serve infrequent critical queries or constraints.
- `multiple_permissive_policies`: 10 tables have multiple permissive policies for the same role/action. Review for intentional union semantics before consolidation.
- `duplicate_index`: `library_orders_provider_ref` and `library_orders_provider_ref_uq` are identical according to the advisor. Do not drop either until constraints, migrations, and concurrent production usage are checked.

## Edge Function inventory snapshot

All 29 listed Edge Functions were ACTIVE at inspection time. JWT gateway verification is enabled for 7 and disabled for 22. A disabled gateway JWT check does not by itself prove a vulnerability: handlers may validate bearer tokens, provider signatures, origin, rate limits, or public input contracts themselves. Every function with `verify_jwt=false` needs a handler-level authentication/authorization review, especially admin and webhook endpoints. Do not bulk-enable gateway verification because provider webhooks and public endpoints may intentionally be unauthenticated at the gateway.

## Required next validation

1. Map every exposed RPC to its frontend/Edge Function callers and intended public/authenticated access.
2. Inspect all SECURITY DEFINER function definitions and test as anon, authenticated non-owner, owner, and admin.
3. Review the three no-policy tables' grants and service-role-only access paths.
4. Audit all 29 Edge Function handlers against their JWT setting and repository source, prioritizing admin, payment, notification, media, and editorial endpoints.
5. Validate Auth leaked-password protection in a staging project before enabling in production.
6. Treat performance/index cleanup as a separate measured change after query-plan and usage review.

## Status

Audit recorded; no production remediation applied. PR must remain unmerged until security findings and Edge Function drift have been triaged and tested.
