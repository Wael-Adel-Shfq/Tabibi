import { pickForDay } from './health-tips.service';

const DAY = 86_400_000;

describe('pickForDay', () => {
  it('returns null when there are no tips', () => {
    expect(pickForDay([], 0)).toBeNull();
  });

  it('keeps the same tip for the whole day', () => {
    const tips = ['a', 'b', 'c'];
    expect(pickForDay(tips, 5 * DAY)).toBe(pickForDay(tips, 5 * DAY + DAY - 1));
  });

  it('moves to the next tip each day and wraps around', () => {
    const tips = ['a', 'b', 'c'];
    expect([0, 1, 2, 3].map((day) => pickForDay(tips, day * DAY))).toEqual(['a', 'b', 'c', 'a']);
  });
});
