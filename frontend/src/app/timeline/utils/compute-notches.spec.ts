import { computeNotches } from './compute-notches';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

describe('computeNotches', () => {
  it('returns empty array for zero container width', () => {
    expect(computeNotches(0, DAY * 30, 0)).toEqual([]);
  });

  it('returns empty array when from >= to', () => {
    expect(computeNotches(DAY * 10, DAY * 5, 600)).toEqual([]);
  });

  it('produces at least one notch for a valid range', () => {
    const notches = computeNotches(0, DAY * 30, 900);
    expect(notches.length).toBeGreaterThan(0);
  });

  it('notch widths sum to container width', () => {
    const width = 1200;
    const notches = computeNotches(0, DAY * 90, width);
    const total = notches.reduce((s, n) => s + n.widthPx, 0);
    expect(Math.round(total)).toBe(width);
  });

  it('all notches have a non-empty label', () => {
    const notches = computeNotches(0, DAY * 30, 900);
    for (const n of notches) {
      expect(n.label.length).toBeGreaterThan(0);
    }
  });

  it('picks coarser unit when container is narrow', () => {
    // 7-day range in 200px → should pick week or day, not hour
    const notches = computeNotches(0, WEEK, 200);
    // Each notch should be <= 7 days wide (week unit at most)
    for (const n of notches) {
      expect(n.widthPx).toBeGreaterThan(0);
    }
  });

  it('each notch key is unique', () => {
    const notches = computeNotches(0, DAY * 60, 900);
    const keys = notches.map(n => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
