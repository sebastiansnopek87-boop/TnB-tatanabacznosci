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
