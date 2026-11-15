const DIACRITICS = /[ً-ٰٟـ]/g;
const FOLD: Record<string, string> = { أ: 'ا', إ: 'ا', آ: 'ا', ٱ: 'ا', ة: 'ه', ى: 'ي' };

/**
 * Mirrors the database function `normalize_arabic`, so a search term typed by
 * a visitor matches the stored `search_text` regardless of hamza forms, taa
 * marbuta, alef maqsura, diacritics or letter case.
 */
export function normalizeArabic(input: string | null | undefined): string {
  return (input ?? '')
    .replace(DIACRITICS, '')
    .replace(/[أإآٱةى]/g, (char) => FOLD[char])
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
