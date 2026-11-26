import { normalizeForSearch } from './search-select';

describe('normalizeForSearch', () => {
  it('folds Arabic letter variants and drops diacritics', () => {
    expect(normalizeForSearch('أَطْفَال')).toBe('اطفال');
    expect(normalizeForSearch('الجلدية')).toBe(normalizeForSearch('الجلديه'));
    expect(normalizeForSearch('مستشفى')).toBe('مستشفي');
  });

  it('ignores case for English', () => {
    expect(normalizeForSearch('  Dermatology ')).toBe('dermatology');
  });
});
