// Payment methods offered at checkout. Only bank transfer is active.
// "online_p24" is a placeholder for a future Przelewy24 integration — no operator connection exists yet.
export const PAYMENT_METHODS = [
  { id: "bank_transfer", label: "Przelew tradycyjny", note: "Dane do przelewu pokażemy po złożeniu zamówienia. Materiał wyślemy po zaksięgowaniu wpłaty.", enabled: true },
  { id: "online_p24", label: "Płatność online", note: "Integracja w przygotowaniu", enabled: false },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

// Bank transfer details — fill in before going live. Empty values show "do uzupełnienia".
export const BANK_TRANSFER = {
  recipient: "",
  accountNumber: "",
  bankName: "",
  address: "",
};

export const bankConfigured = () => !!(BANK_TRANSFER.recipient && BANK_TRANSFER.accountNumber);
