export function isSafeDeliveryRetry(reason: string | undefined): boolean {
  // These failures happen before any SMTP hand-off, so a bounded retry cannot
  // duplicate a message that the remote mail server may already have accepted.
  return reason === "template_not_found" ||
    reason === "missing_variables" ||
    reason === "log_insert_failed";
}
