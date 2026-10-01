// Bank transfer is always available; online operators (Przelewy24, Tpay, PayU) are
// configured in /admin/platnosci and offered only when enabled and fully configured.
export type PaymentMethodId = "bank_transfer" | "p24" | "tpay" | "payu";

export const BANK_METHOD = { id: "bank_transfer" as const, label: "Przelew tradycyjny", note: "Dane do przelewu pokażemy po złożeniu zamówienia. Dostęp przyznamy po zaksięgowaniu wpłaty." };

// Bank transfer details — fill in before going live. Empty values show "do uzupełnienia".
export const BANK_TRANSFER = {
  recipient: "",
  accountNumber: "",
  bankName: "",
  address: "",
};

export const bankConfigured = () => !!(BANK_TRANSFER.recipient && BANK_TRANSFER.accountNumber);
