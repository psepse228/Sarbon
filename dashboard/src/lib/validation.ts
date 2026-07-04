import { z } from "zod";

export const packageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Название пакета обязательно"),
  price: z.number().nonnegative(),
  currency: z.string().min(1).default("RUB"),
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  guestsMin: z.number().int().nonnegative().nullable(),
  guestsMax: z.number().int().nonnegative().nullable(),
  prepaymentTerms: z.string(),
  cancellationTerms: z.string(),
});

export const packagesArraySchema = z.array(packageSchema);

export const faqEntrySchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1, "Вопрос обязателен"),
  answer: z.string().min(1, "Ответ обязателен"),
});

export const faqArraySchema = z.array(faqEntrySchema);

export const partnerSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1, "Категория обязательна"),
  name: z.string().min(1, "Название партнёра обязательно"),
  contact: z.string(),
});

export const partnersArraySchema = z.array(partnerSchema);

export const policiesSchema = z.object({
  policies: z.string(),
});
