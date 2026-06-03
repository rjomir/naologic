import { getBarSize } from './activity-size.model';

describe('getBarSize', () => {
  it('returns hidden when totalWidthPx is zero', () => {
    expect(getBarSize(100, 0)).toBe('hidden');
  });

  it('returns hidden when barWidthPx is zero', () => {
    expect(getBarSize(0, 1000)).toBe('hidden');
  });

  it('returns hidden for sub-pixel fraction (< 0.1%)', () => {
    expect(getBarSize(0.5, 10_000)).toBe('hidden');
  });

  it('returns xs for thin sliver (0.1% – 0.6%)', () => {
    expect(getBarSize(30, 10_000)).toBe('xs'); // 0.3%
  });

  it('returns sm for narrow bar (0.6% – 2.2%)', () => {
    expect(getBarSize(100, 10_000)).toBe('sm'); // 1%
  });

  it('returns md for normal bar (≥ 2.2%)', () => {
    expect(getBarSize(500, 10_000)).toBe('md'); // 5%
  });

  it('returns md for the full width', () => {
    expect(getBarSize(10_000, 10_000)).toBe('md');
  });
});
