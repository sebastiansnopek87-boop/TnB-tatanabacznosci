/**
 * Provider transaction references must match the reference saved when checkout
 * was created. Order UUIDs identify the local order; they do not replace this check.
 */
export function providerReferenceMatches(stored: unknown, received: unknown): boolean {
  return typeof stored === "string"
    && stored.length > 0
    && typeof received === "string"
    && received.length > 0
    && stored === received;
}

/** P24 requires a successful server-side /transaction/verify before ACK. */
export function p24VerificationSucceeded(httpOk: boolean, providerStatus: unknown): boolean {
  return httpOk && providerStatus === "success";
}

/**
 * Tpay's notification field tr_id is the transaction title returned by
 * transaction creation. Never substitute an internal transactionId or the
 * local order UUID: those values are not guaranteed to match tr_id.
 */
export function tpayTransactionReference(title: unknown): string | null {
  if (typeof title !== "string") return null;
  const reference = title.trim();
  return reference.length > 0 ? reference : null;
}
