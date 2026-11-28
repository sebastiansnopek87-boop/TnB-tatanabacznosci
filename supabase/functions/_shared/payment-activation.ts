// Payment processing is deliberately opt-in. Undefined, empty, or unexpected values fail closed.
export function isPaymentOperationsEnabled(value: string | undefined): boolean {
  return value === "true";
}
