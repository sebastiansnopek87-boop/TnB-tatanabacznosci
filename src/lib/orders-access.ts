const ACCESS_STATUSES = ["paid", "refund_pending", "refunded"] as const;

/** Access requires confirmed payment and must not have been explicitly revoked. */
export function hasAccess(order: { status: string; paid_at: string | null; access_revoked_at: string | null }): boolean {
  return !!order.paid_at && !order.access_revoked_at && ACCESS_STATUSES.includes(order.status as (typeof ACCESS_STATUSES)[number]);
}
