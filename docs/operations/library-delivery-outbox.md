# Library delivery outbox operations

This guide applies only to the TNB project. It is an operator procedure for the
transactional queue introduced by
`20261119010000_library_delivery_outbox.sql`.

## Event model

A transition from a null `paid_at` to a non-null `paid_at` inserts two rows in
the same database transaction:

- `order_paid`: payment confirmation notification.
- `order_access_delivered` for an account order, or `order_guest_access`
  for a guest order: access-link delivery notification.

The unique constraint on `(order_id, event_key)` makes enqueueing idempotent.
The queue is private to `service_role`; do not grant browser roles access.

## Status meanings

| Status | Meaning | Operator action |
| --- | --- | --- |
| `pending` | Enqueued and waiting for its availability time | No action unless queue age exceeds the normal processing window |
| `processing` | Claimed under a five-minute worker lease | Check worker/cron health if it remains here |
| `retry` | A failure known to have happened before SMTP hand-off | Automatic bounded retry; monitor attempts |
| `sent` | SMTP transport accepted the message and returned successfully | This is not proof of inbox delivery |
| `simulated` | Test mode rendered/logged the message; no live email was sent | Do not report as delivered |
| `skipped` | Delivery was intentionally unnecessary or disabled | Inspect the associated log reason if unexpected |
| `needs_review` | Result may be ambiguous, including SMTP hand-off or an expired worker lease | Investigate before any resend |
| `dead_letter` | Safe pre-SMTP failures exhausted the retry limit | Fix the underlying cause, then use an approved recovery procedure |

A worker lease older than five minutes is moved to `needs_review`, not retried.
This is deliberate: after a worker crash, the SMTP server may already have
accepted the message even if the application did not record the response.

## Read-only monitoring

Queue volume by status and event:

```sql
select event_key, status, count(*) as rows,
       min(created_at) as oldest_created_at,
       max(attempts) as max_attempts
from public.library_delivery_outbox
group by event_key, status
order by event_key, status;
```

Rows requiring investigation:

```sql
select id, order_id, event_key, status, attempts,
       locked_at, locked_by, last_error, created_at, updated_at
from public.library_delivery_outbox
where status in ('needs_review', 'dead_letter')
order by updated_at asc;
```

Queue rows that appear stuck in processing:

```sql
select id, order_id, event_key, attempts, locked_at, locked_by
from public.library_delivery_outbox
where status = 'processing'
  and locked_at < now() - interval '5 minutes'
order by locked_at asc;
```

Cron registration and recent run metadata:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'tnb-library-delivery-outbox';
```

These queries are observational. Run them against the TNB database only.

## Handling an incident

1. Check the cron registration and Supabase logs for `tnb-orders`.
2. Inspect the matching `email_notification_log` row using the outbox
   `order_id` and the deterministic key `event_key || '-' || order_id`.
3. For `sent`, confirm the recorded provider message ID where available.
   Do not equate SMTP acceptance with inbox placement.
4. For `simulated`, correct the environment/configuration before treating the
   message as a customer delivery.
5. For `needs_review`, establish whether the provider accepted the message
   using provider-side evidence. Do not blindly reset the outbox row or resend.
6. For `dead_letter`, fix the pre-SMTP cause first. Recovery must preserve
   duplicate protection and be recorded in the order event log.
7. If evidence is insufficient to establish whether a message was accepted,
   leave the row in `needs_review` and contact the customer through a separate,
   verified channel before any manual resend.

## Safety constraints

- Never expose outbox rows, checkout redirect URLs, or private delivery payloads
  to `anon` or `authenticated`.
- Never automatically retry an SMTP failure or an unknown result after SMTP
  hand-off.
- Never mark a simulated message as sent.
- Never resolve an ambiguous payment or delivery by creating a second checkout.
- Do not manually edit queue status or invoke the claim/finish RPCs from a
  browser session.
- The cron job must use the TNB Vault secret and the TNB `tnb-orders` function.
  Do not copy its credential or endpoint into another project.
