# TNB production release runbook

## Release status (2026-11-20)

This branch is not approved for production deployment.

Verified:
- GitHub Actions Build passed for the current delivery branch head.
- The isolated migration replay passed from an empty local Supabase database, including all 68 repository migrations.
- The branch contains checkout idempotency and transactional delivery-outbox changes.
- The production Supabase project has not received these migrations or Edge Function changes.
- Production payment providers remain disabled / sandbox.
- Email delivery remains in test/simulated mode; live SMTP and Auth SMTP delivery have not been verified.
- CyberFolks deployment is configured and target-verified, but deployment is disabled and paused.
- PR #16 is still a draft and is one commit behind `main`.

Passing a clean migration replay proves that the migration set can build a fresh database. It does not prove that applying it to the existing production database is safe. Production currently has 66 recorded migrations while this branch adds two more.

## Hard release gates

Do not publish until every gate below has an explicit PASS:

1. **Source review**
   - Rebase or otherwise reconcile the feature branch with the latest `main`; do not discard either side's changes.
   - Review the complete PR diff, especially checkout state transitions, provider adapters, outbox worker, SQL SECURITY DEFINER functions, grants, cron scheduling, and webhook authentication.
   - Resolve all review findings and rerun CI on the final commit.
   - Keep the PR in draft until the review is complete.

2. **Database compatibility**
   - Take and verify a restorable production backup.
   - Rehearse both new migrations against a sanitized production-like snapshot containing existing orders, notification logs, payment providers, Vault, pg_cron, and pg_net.
   - Verify migration history continuity. Never reset migration history or create an artificial baseline.
   - Verify RLS, table privileges, function execute grants, trigger behavior, cron job creation, and rollback/forward-recovery steps.
   - Confirm the cron URL and Vault secret reference target the TNB project only.

3. **Edge Functions**
   - Produce and review deployed-source diffs for every function affected by the release.
   - Run Deno checks and function tests for the exact release SHA.
   - Verify custom cron authentication, provider webhook signature validation, P24 server-side verification, provider-reference matching, amount/currency/environment checks, and admin role checks.
   - Confirm that no service-role key, provider secret, checkout redirect URL, or private delivery payload reaches browser-readable data.

4. **Email and delivery**
   - Configure a dedicated live SMTP transport and separately configure Supabase Auth SMTP.
   - Verify sender-domain authentication (SPF, DKIM, DMARC), recipient delivery, bounce handling, and provider message IDs.
   - Test outbox success, safe retry, dead-letter, stale lease, and ambiguous SMTP hand-off behavior.
   - Confirm that simulated/test mode cannot be mistaken for a real customer delivery.

5. **Payments**
   - Configure each payment operator only in sandbox first.
   - Run end-to-end tests for checkout creation, repeated requests, concurrent requests, mismatched idempotency fingerprints, provider timeouts, webhook replay, wrong references, wrong amount/currency, and failed/cancelled payments.
   - Confirm that an ambiguous provider create result never triggers an automatic second charge.
   - Enable live credentials only after operator-side verification and an explicit release approval.

6. **Frontend and hosting**
   - Build the static Vite SPA artifact from the exact approved commit.
   - Verify direct navigation and refresh on all required SPA routes on staging.
   - Verify that the hosting rewrite serves `index.html` for application routes without exposing source maps, server-only code, or secrets.
   - Confirm backup and rollback procedures for the static artifact.
   - Keep CyberFolks auto-deploy disabled until the exact artifact and target path are approved.

7. **Operational acceptance**
   - Run E2E tests with separate user, moderator, admin, and superadmin accounts.
   - Verify profile writes, access control, premium material purchase, paid transition, access delivery, account recovery, and admin order handling.
   - Confirm monitoring and manual procedures for `needs_review` and `dead_letter` outbox rows.
   - Record the release SHA, migration versions, deployed function versions, smoke-test results, and approver.

## Deployment order after approval

1. Freeze and record the exact release SHA.
2. Back up production and verify restore capability.
3. Apply the reviewed database migrations in the approved maintenance window.
4. Verify schema, privileges, trigger, Vault lookup, and cron job before deploying code that depends on them.
5. Deploy the compatible Edge Functions.
6. Run sandbox webhook and checkout tests against the deployed functions.
7. Configure and verify live SMTP and Auth SMTP separately.
8. Deploy the static SPA artifact to staging and run route/auth/access E2E tests.
9. Obtain explicit production approval, then publish the exact approved artifact.
10. Keep payment operators disabled until a controlled live smoke test is approved.
11. Monitor payment events, delivery outbox, SMTP logs, and Supabase function logs after release.

## Stop conditions

Stop the release and do not continue automatically if:
- migration history differs from the rehearsed snapshot;
- any production row would be rewritten or dropped unexpectedly;
- provider transaction creation has an ambiguous result;
- webhook signature, reference, amount, currency, or environment validation fails;
- email delivery is simulated or its result is ambiguous;
- a required role/access test has not been completed;
- the deployed artifact SHA differs from the approved release SHA.

This runbook is for the TNB repository and TNB infrastructure only. Do not use it to modify or deploy any other project.
