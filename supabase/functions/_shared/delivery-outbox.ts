export type OutboxDispatchStatus = "sent" | "simulated" | "skipped" | "failed" | "duplicate";
export type OutboxFinishStatus = "sent" | "simulated" | "skipped" | "failed" | "needs_review";

export function isSafeDeliveryRetry(reason: string | undefined): boolean {
  // These failures happen before any SMTP hand-off, so a bounded retry cannot
  // duplicate a message that the remote mail server may already have accepted.
  return reason === "template_not_found" ||
    reason === "missing_variables" ||
    reason === "log_insert_failed";
}

export function getOutboxFinishDecision(
  status: OutboxDispatchStatus,
  reason?: string,
): { status: OutboxFinishStatus; safeToRetry: boolean } {
  if (status === "sent" || status === "simulated" || status === "skipped") {
    return { status, safeToRetry: false };
  }
  if (status === "failed" && isSafeDeliveryRetry(reason)) {
    return { status: "failed", safeToRetry: true };
  }
  // Duplicate log rows and all unknown/SMTP-stage failures are ambiguous.
  // They must be inspected rather than automatically resent.
  return { status: "needs_review", safeToRetry: false };
}
