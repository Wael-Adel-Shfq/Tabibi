import type { Advertisement } from '../../core/models/entities';
import { PopupFrequency } from './popup-frequency';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const HOUR = 60 * 60 * 1000;
const ad = (repeatHours: number) => ({ id: 'ad-1', popup_repeat_hours: repeatHours }) as Advertisement;

describe('PopupFrequency', () => {
  it('shows an ad that was never shown', () => {
    expect(new PopupFrequency(new MemoryStorage()).canShow(ad(24), 0)).toBe(true);
  });

  it('hides it until the repeat window has passed', () => {
    const frequency = new PopupFrequency(new MemoryStorage());
    frequency.markShown(ad(24), 1000);
    expect(frequency.canShow(ad(24), 1000 + 23 * HOUR)).toBe(false);
    expect(frequency.canShow(ad(24), 1000 + 24 * HOUR)).toBe(true);
  });

  it('always shows ads with a zero repeat window', () => {
    const frequency = new PopupFrequency(new MemoryStorage());
    frequency.markShown(ad(0), 1000);
    expect(frequency.canShow(ad(0), 1001)).toBe(true);
  });

  it('works without storage', () => {
    const frequency = new PopupFrequency(null);
    frequency.markShown(ad(24), 1000);
    expect(frequency.canShow(ad(24), 1001)).toBe(true);
  });
});
