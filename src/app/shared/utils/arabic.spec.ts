import { normalizeArabic } from './arabic';

describe('normalizeArabic', () => {
  it('folds hamza forms to bare alef', () => {
    expect(normalizeArabic('أحمد إبراهيم آدم')).toBe('احمد ابراهيم ادم');
  });

  it('folds taa marbuta and alef maqsura', () => {
    expect(normalizeArabic('فاطمة مصطفى')).toBe('فاطمه مصطفي');
  });

  it('removes diacritics and tatweel', () => {
    expect(normalizeArabic('أَحْمَد')).toBe('احمد');
    expect(normalizeArabic('محـــمد')).toBe('محمد');
  });

  it('lowercases latin text and collapses whitespace', () => {
    expect(normalizeArabic('  Dr.  AHMED   Ali ')).toBe('dr. ahmed ali');
  });

  it('treats null and undefined as empty', () => {
    expect(normalizeArabic(null)).toBe('');
    expect(normalizeArabic(undefined)).toBe('');
  });
});
