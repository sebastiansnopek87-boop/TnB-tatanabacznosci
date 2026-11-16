import { z } from "zod";

/** Public, non-sensitive platform columns. Keep billing_* out of this allowlist. */
export const PUBLIC_COLS = "platform_name, contact_email, support_email, notice_enabled, maintenance_enabled, maintenance_message, social_youtube, social_spotify, social_tiktok, social_instagram, podcast_layout, module_visibility, brand_settings, visual_effects, company_legal_name, company_legal_form, company_nip, company_regon, company_krs, company_address_street, company_address_postal, company_address_city, company_address_country, contact_phone, contact_hours, footer_description, footer_copyright, footer_show_contact";

const optEmail = z.union([z.string().trim().email("Podaj poprawny adres e-mail").max(255), z.literal("")]).transform((v) => (v === "" ? null : v));
const optUrl = z.union([z.string().trim().url("Podaj pełny adres zaczynający się od https://").max(500).refine((v) => v.startsWith("https://"), "Adres musi zaczynać się od https://"), z.literal("")]).transform((v) => (v === "" ? null : v));
const optText = (max: number) => z.union([z.string().trim().max(max), z.literal("")]).transform((v) => (v === "" ? null : v));
const optNip = z.union([z.string().trim().regex(/^\\d{10}$/, "NIP musi mieć dokładnie 10 cyfr (bez myślników)"), z.literal("")]).transform((v) => (v === "" ? null : v));
const optRegon = z.union([z.string().trim().regex(/^\\d{9}(\\d{5})?$/, "REGON musi mieć 9 lub 14 cyfr"), z.literal("")]).transform((v) => (v === "" ? null : v));
const optKrs = z.union([z.string().trim().regex(/^\\d{10}$/, "KRS musi mieć dokładnie 10 cyfr"), z.literal("")]).transform((v) => (v === "" ? null : v));
const optPostal = z.union([z.string().trim().regex(/^\\d{2}-\\d{3}$/, "Kod pocztowy w formacie 00-000"), z.literal("")]).transform((v) => (v === "" ? null : v));
const optPhone = z.union([z.string().trim().regex(/^\\+?[0-9\\s-]{7,20}$/, "Podaj poprawny numer telefonu"), z.literal("")]).transform((v) => (v === "" ? null : v));

export const platformSchema = z.object({
  social_youtube: optUrl, social_spotify: optUrl, social_tiktok: optUrl, social_instagram: optUrl,
  platform_name: z.string().trim().min(1, "Podaj nazwę platformy").max(100),
  contact_email: optEmail,
  support_email: optEmail,
  notice_enabled: z.boolean(),
  maintenance_enabled: z.boolean(),
  maintenance_message: z.string().trim().max(500, "Komunikat może mieć najwyżej 500 znaków"),
  company_legal_name: optText(200),
  company_legal_form: optText(100),
  company_nip: optNip,
  company_regon: optRegon,
  company_krs: optKrs,
  company_address_street: optText(200),
  company_address_postal: optPostal,
  company_address_city: optText(100),
  company_address_country: optText(100),
  contact_phone: optPhone,
  contact_hours: optText(200),
  billing_same_as_company: z.boolean(),
  billing_name: optText(200),
  billing_nip: optNip,
  billing_address: optText(300),
  footer_description: optText(500),
  footer_copyright: optText(200),
  footer_show_contact: z.boolean(),
}).refine((d) => !(d.notice_enabled || d.maintenance_enabled) || d.maintenance_message.length > 0, {
  message: "Wpisz treść komunikatu, zanim go włączysz.", path: ["maintenance_message"],
}).refine((d) => d.billing_same_as_company || !!d.billing_name, {
  message: "Podaj nazwę nabywcy na fakturze albo włącz kopiowanie danych podmiotu.", path: ["billing_name"],
});
