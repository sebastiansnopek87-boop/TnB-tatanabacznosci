# Production Edge Function drift audit — 2026-11-17

## Purpose

This report records a read-only comparison between deployed Supabase Edge Function entrypoints and the corresponding source files on `chore/legacy-runtime-audit`.

It is a release-gate document. It does not authorize deployment, secret changes, JWT configuration changes, or production database changes.

Project: `pmdfiipontreuclfumdh`  
Comparison branch: `chore/legacy-runtime-audit`

## Result

All eight inspected deployed entrypoints differ in byte length from the corresponding branch entrypoint. This establishes source drift, not which version is correct.

| Function | Deployed entrypoint chars | Branch entrypoint chars | Notable branch-only import observed |
|---|---:|---:|---|
| `tnb-orders` | 31,866 | 34,185 | `../_shared/smtp.ts` |
| `tnb-payments` | 22,109 | 23,396 | `../_shared/payment-webhook.ts` |
| `tnb-admin` | 37,012 | 39,086 | `../_shared/smtp.ts` |
| `tnb-contact` | 12,257 | 13,294 | `../_shared/smtp.ts` |
| `tnb-newsletter` | 8,831 | 12,726 | `../_shared/smtp.ts` |
| `tnb-notifications` | 19,510 | 22,128 | `../_shared/smtp.ts` |
| `tnb-library-delivery` | 16,692 | 17,848 | `../_shared/smtp.ts` |
| `tnb-article-newsletter` | 22,674 | 24,420 | `../_shared/smtp.ts` |

The character counts refer to the deployed `index.ts` content and the branch `index.ts` file retrieved during this audit. They are not cryptographic equivalence checks.

## Payment-specific release risk

The deployed `tnb-payments` entrypoint does not import the branch helper `providerReferenceMatches` from `../_shared/payment-webhook.ts`. The branch version does.

The deployed payment handler therefore must not be treated as equivalent to the branch implementation. Before any deployment, review the full provider-specific matching rules, signature validation, event idempotency, amount/currency checks, environment checks, state transitions, and acknowledgement behavior against the actual provider contracts and existing production orders.

The branch also contains SMTP helper imports in multiple functions. Before deploying any of those changes, review the helper and each caller together, including environment-variable names, sender identity, TLS behavior, provider constraints, error handling, and notification idempotency.

## Required release gate

1. Review each complete deployed/source diff, including imported local modules and `deno.json` import maps.
2. Run Deno checks and function-specific tests against the branch sources.
3. Add or verify contract tests for every payment provider and webhook replay/duplicate case.
4. Test SMTP delivery in a non-production environment with controlled recipients.
5. Verify function configuration, especially `verify_jwt`, against each endpoint's intended authentication model.
6. Obtain an explicit release decision before deploying any Edge Function.
7. After deployment, run endpoint smoke tests and inspect logs before proceeding.

## Production safety

- No Edge Function was deployed as part of this audit.
- No Supabase secrets were read or changed.
- No production migration or table change was executed.
- Do not bulk-deploy the branch's Edge Functions based only on CI success.


## Additional payment notification finding

The branch `tnb-payments/index.ts` currently records order notifications with `mode: "test"` and transitions them to `status: "simulated"`; this code path does not call `sendSmtpMail`. The subsequent delivery status is therefore recorded as `not_sent` for this path. Treat payment confirmation/access email delivery as unverified until the production notification path is explicitly connected and tested end-to-end. Do not assume that the presence of the shared SMTP helper in other Edge Functions means payment emails are being delivered.
