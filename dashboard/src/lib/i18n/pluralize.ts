import type { Locale } from "./translations";

/** Russian noun-number agreement: 1 takes nominative singular, 2-4 take
 * genitive singular, everything else (0, 5-20, 25-30, ...) takes genitive
 * plural -- except 11-14, which always take the genitive-plural form even
 * though they end in 1-4. E.g. pluralizeRu(91, ["получатель", "получателя",
 * "получателей"]) -> "получатель" (91 ends in 1, not 11). */
function pluralizeRu(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Word form for a count, RU-aware (EN just needs singular/plural). Forms
 * are always [one, few, many] regardless of locale -- pass the same three
 * Russian forms everywhere; for English locale, ignores `few`/`many` and
 * -- English has no fewer than the "few" case in practice -- if the two
 * English forms are equal (e.g. always "recipients"), pass singular/plural
 * as `few`/`many`. */
export function pluralize(n: number, locale: Locale, forms: [string, string, string]): string {
  if (locale === "ru") return pluralizeRu(n, forms);
  return n === 1 ? forms[0] : forms[2];
}
