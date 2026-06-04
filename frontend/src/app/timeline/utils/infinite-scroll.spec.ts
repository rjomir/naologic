import { describe, it, expect } from 'vitest';

/**
 * Pure unit tests for the infinite-scroll column expansion logic.
 * The component uses two signals (daysBeforeToday, daysAfterToday) that drive
 * totalDays and timelineStart. These tests verify the arithmetic without Angular.
 */

function buildTimeline(daysBeforeToday: number, daysAfterToday: number) {
  const today = new Date('2026-06-04T00:00:00.000Z');

  const timelineStart = () => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysBeforeToday);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const totalDays = () => daysBeforeToday + daysAfterToday;

  const columns = () =>
    Array.from({ length: totalDays() }, (_, i) => {
      const date = new Date(timelineStart().getTime() + i * 86_400_000);
      return date.toISOString().slice(0, 10);
    });

  return { timelineStart, totalDays, columns };
}

describe('infinite scroll column expansion', () => {
  it('starts with the expected number of columns', () => {
    const { totalDays } = buildTimeline(30, 90);
    expect(totalDays()).toBe(120);
  });

  it('totalDays grows when daysAfterToday increases', () => {
    const initial = buildTimeline(30, 90);
    const expanded = buildTimeline(30, 90 + 30);
    expect(expanded.totalDays()).toBe(initial.totalDays() + 30);
  });

  it('totalDays grows when daysBeforeToday increases', () => {
    const initial = buildTimeline(30, 90);
    const expanded = buildTimeline(30 + 30, 90);
    expect(expanded.totalDays()).toBe(initial.totalDays() + 30);
  });

  it('timelineStart moves back when daysBeforeToday increases', () => {
    const before = buildTimeline(30, 90);
    const after = buildTimeline(60, 90);
    const diff = (before.timelineStart().getTime() - after.timelineStart().getTime()) / 86_400_000;
    expect(diff).toBe(30);
  });

  it('columns array begins at timelineStart date', () => {
    const { timelineStart, columns } = buildTimeline(30, 90);
    const expectedFirst = timelineStart().toISOString().slice(0, 10);
    expect(columns()[0]).toBe(expectedFirst);
  });

  it('columns array ends at timelineStart + totalDays - 1', () => {
    const { timelineStart, totalDays, columns } = buildTimeline(30, 90);
    const expectedLast = new Date(timelineStart().getTime() + (totalDays() - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(columns().at(-1)).toBe(expectedLast);
  });

  it('prepending 30 days shifts every column date back by 30 days', () => {
    const original = buildTimeline(30, 90);
    const prepended = buildTimeline(60, 90);
    const originalFirst = new Date(original.columns()[0]);
    const prependedFirst = new Date(prepended.columns()[0]);
    const daysDiff = (originalFirst.getTime() - prependedFirst.getTime()) / 86_400_000;
    expect(daysDiff).toBe(30);
  });
});
