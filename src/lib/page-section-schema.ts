import { z } from "zod";
import { HOME_KINDS, isSafeHref } from "./pages";
import { TextFormatsSchema } from "./rich-text";

const BtnDraft = z.object({ label: z.string().max(60), href: z.string().max(500) });

const sectionShape = (btn: z.ZodTypeAny) => z.object({
  textFormats: TextFormatsSchema,
  hidden: z.boolean().default(false), optional: z.boolean().default(false),
  id: z.string().regex(/^[a-z0-9]{1,20}$/), kind: z.enum(["hero", "text", "values", "columns", "quote", "image", "cta", ...HOME_KINDS]),
  settings: z.record(z.string().regex(/^[a-zA-Z0-9]{1,40}$/), z.string().max(3000)).refine((r) => Object.keys(r).length <= 40).optional(),
  eyebrow: z.string().max(200).default(""), layout: z.enum(["left", "right"]).default("right"), display: z.enum(["full", "inset", "featured"]).default("full"), decorative: z.boolean().default(false),
  items: z.array(z.object({ title: z.string().max(120), body: z.string().max(3000), href: z.string().max(500).refine((h) => !h || isSafeHref(h), "Adres musi zaczynać się od / lub https://").optional(), cta: z.string().max(60).optional(), image: z.string().regex(/^(asset:[a-z-]{1,40}|[a-z0-9-]+\\.(jpg|png|webp))$/).optional(), alt: z.string().max(200).optional() })).max(12).default([]),
  heading: z.string().max(200), body: z.string().max(20000), image: z.string().regex(/^[a-z0-9-]+\\.(jpg|png|webp)$/).nullable(),
  imageAlt: z.string().max(200), caption: z.string().max(300), quoteAuthor: z.string().max(120), buttons: z.array(btn).max(4),
});

export const DraftSectionSchema = sectionShape(BtnDraft);
