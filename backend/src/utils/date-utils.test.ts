import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  getShiftForDay,
  isInShift,
  getShiftEnd,
  isInMaintenance,
  snapToValidWorkTime,
  calculateEndDate,
} from './date-utils.js';
import type { Shift, MaintenanceWindow } from '../types.js';

// Mon–Fri 08:00–17:00
const weekdays: Shift[] = [
  { dayOfWeek: 1, startHour: 8, endHour: 17 },
  { dayOfWeek: 2, startHour: 8, endHour: 17 },
  { dayOfWeek: 3, startHour: 8, endHour: 17 },
  { dayOfWeek: 4, startHour: 8, endHour: 17 },
  { dayOfWeek: 5, startHour: 8, endHour: 17 },
];

const noMaint: MaintenanceWindow[] = [];

// 2026-06-01 is Monday, 2026-06-06 is Saturday, 2026-06-07 is Sunday

// ── getShiftForDay ────────────────────────────────────────────────────────────

describe('getShiftForDay', () => {
  it('returns the shift for a weekday', () => {
    const dt = DateTime.fromISO('2026-06-01T10:00:00Z', { zone: 'utc' }); // Monday
    expect(getShiftForDay(dt, weekdays)).toEqual({ dayOfWeek: 1, startHour: 8, endHour: 17 });
  });

  it('returns undefined for Saturday (no shift defined)', () => {
    const dt = DateTime.fromISO('2026-06-06T10:00:00Z', { zone: 'utc' }); // Saturday
    expect(getShiftForDay(dt, weekdays)).toBeUndefined();
  });

  it('returns undefined for Sunday (no shift defined)', () => {
    const dt = DateTime.fromISO('2026-06-07T10:00:00Z', { zone: 'utc' }); // Sunday
    expect(getShiftForDay(dt, weekdays)).toBeUndefined();
  });
});

// ── isInShift ─────────────────────────────────────────────────────────────────

describe('isInShift', () => {
  it('returns true when time is inside shift hours', () => {
    const dt = DateTime.fromISO('2026-06-01T10:00:00Z', { zone: 'utc' }); // Mon 10:00
    expect(isInShift(dt, weekdays)).toBe(true);
  });

  it('returns true at the exact shift start hour', () => {
    const dt = DateTime.fromISO('2026-06-01T08:00:00Z', { zone: 'utc' }); // Mon 08:00
    expect(isInShift(dt, weekdays)).toBe(true);
  });

  it('returns false at the exact shift end hour (end is exclusive)', () => {
    const dt = DateTime.fromISO('2026-06-01T17:00:00Z', { zone: 'utc' }); // Mon 17:00
    expect(isInShift(dt, weekdays)).toBe(false);
  });

  it('returns false before shift starts', () => {
    const dt = DateTime.fromISO('2026-06-01T07:59:00Z', { zone: 'utc' }); // Mon 07:59
    expect(isInShift(dt, weekdays)).toBe(false);
  });

  it('returns false after shift ends', () => {
    const dt = DateTime.fromISO('2026-06-01T18:00:00Z', { zone: 'utc' }); // Mon 18:00
    expect(isInShift(dt, weekdays)).toBe(false);
  });

  it('returns false on a weekend', () => {
    const dt = DateTime.fromISO('2026-06-06T10:00:00Z', { zone: 'utc' }); // Saturday
    expect(isInShift(dt, weekdays)).toBe(false);
  });
});

// ── getShiftEnd ───────────────────────────────────────────────────────────────

describe('getShiftEnd', () => {
  it('returns 17:00 on the same day for a weekday', () => {
    const dt = DateTime.fromISO('2026-06-01T10:00:00Z', { zone: 'utc' }); // Mon 10:00
    const end = getShiftEnd(dt, weekdays);
    expect(end?.toISO()).toBe('2026-06-01T17:00:00.000Z');
  });

  it('returns null on a weekend (no shift)', () => {
    const dt = DateTime.fromISO('2026-06-06T10:00:00Z', { zone: 'utc' }); // Saturday
    expect(getShiftEnd(dt, weekdays)).toBeNull();
  });
});

// ── isInMaintenance ───────────────────────────────────────────────────────────

describe('isInMaintenance', () => {
  const windows: MaintenanceWindow[] = [
    { startDate: '2026-06-03T10:00:00Z', endDate: '2026-06-03T12:00:00Z' },
  ];

  it('returns true when the time is inside a maintenance window', () => {
    const dt = DateTime.fromISO('2026-06-03T11:00:00Z', { zone: 'utc' });
    expect(isInMaintenance(dt, windows)).toBe(true);
  });

  it('returns true at the exact window start (inclusive)', () => {
    const dt = DateTime.fromISO('2026-06-03T10:00:00Z', { zone: 'utc' });
    expect(isInMaintenance(dt, windows)).toBe(true);
  });

  it('returns false at the exact window end (exclusive)', () => {
    const dt = DateTime.fromISO('2026-06-03T12:00:00Z', { zone: 'utc' });
    expect(isInMaintenance(dt, windows)).toBe(false);
  });

  it('returns false before the window', () => {
    const dt = DateTime.fromISO('2026-06-03T09:00:00Z', { zone: 'utc' });
    expect(isInMaintenance(dt, windows)).toBe(false);
  });

  it('returns false after the window', () => {
    const dt = DateTime.fromISO('2026-06-03T13:00:00Z', { zone: 'utc' });
    expect(isInMaintenance(dt, windows)).toBe(false);
  });

  it('returns false when there are no maintenance windows', () => {
    const dt = DateTime.fromISO('2026-06-03T11:00:00Z', { zone: 'utc' });
    expect(isInMaintenance(dt, [])).toBe(false);
  });
});

// ── snapToValidWorkTime – additional edge cases ───────────────────────────────

describe('snapToValidWorkTime edge cases', () => {
  it('snaps a time before shift start to the shift start (same day)', () => {
    const dt = DateTime.fromISO('2026-06-01T06:00:00Z', { zone: 'utc' }); // Mon 06:00
    const snapped = snapToValidWorkTime(dt, weekdays, noMaint);
    expect(snapped.toISO()).toBe('2026-06-01T08:00:00.000Z');
  });

  it('skips the weekend and snaps to Monday when called on Saturday', () => {
    const dt = DateTime.fromISO('2026-06-06T10:00:00Z', { zone: 'utc' }); // Saturday
    const snapped = snapToValidWorkTime(dt, weekdays, noMaint);
    expect(snapped.toISO()).toBe('2026-06-08T08:00:00.000Z'); // Monday
  });

  it('handles maintenance that ends mid-shift correctly', () => {
    const maintenance: MaintenanceWindow[] = [
      { startDate: '2026-06-02T09:00:00Z', endDate: '2026-06-02T10:30:00Z' },
    ];
    const dt = DateTime.fromISO('2026-06-02T09:00:00Z', { zone: 'utc' }); // Tue in maintenance
    const snapped = snapToValidWorkTime(dt, weekdays, maintenance);
    expect(snapped.toISO()).toBe('2026-06-02T10:30:00.000Z');
  });
});

// ── calculateEndDate – additional edge cases ──────────────────────────────────

describe('calculateEndDate edge cases', () => {
  it('returns the start when duration is 0', () => {
    const start = DateTime.fromISO('2026-06-01T10:00:00Z', { zone: 'utc' });
    const end = calculateEndDate(start, 0, weekdays, noMaint);
    expect(end.toISO()).toBe('2026-06-01T10:00:00.000Z');
  });

  it('snaps a before-shift start to shift start then applies duration', () => {
    // Start at 06:00 Mon → snapped to 08:00 → 60 min → ends 09:00
    const start = DateTime.fromISO('2026-06-01T06:00:00Z', { zone: 'utc' });
    const end = calculateEndDate(start, 60, weekdays, noMaint);
    expect(end.toISO()).toBe('2026-06-01T09:00:00.000Z');
  });

  it('handles duration that exactly fills remaining shift time', () => {
    // Start at 16:00 Mon, 60 min remaining → ends exactly at 17:00
    const start = DateTime.fromISO('2026-06-01T16:00:00Z', { zone: 'utc' });
    const end = calculateEndDate(start, 60, weekdays, noMaint);
    expect(end.toISO()).toBe('2026-06-01T17:00:00.000Z');
  });

  it('correctly splits work across two maintenance windows', () => {
    // Wed: 60 min work, then maint 10-11, then 60 min work 11-12, then maint 12-13, then 60 min work 13-14
    const maintenance: MaintenanceWindow[] = [
      { startDate: '2026-06-03T10:00:00Z', endDate: '2026-06-03T11:00:00Z' },
      { startDate: '2026-06-03T12:00:00Z', endDate: '2026-06-03T13:00:00Z' },
    ];
    const start = DateTime.fromISO('2026-06-03T09:00:00Z', { zone: 'utc' });
    const end = calculateEndDate(start, 180, weekdays, maintenance);
    expect(end.toISO()).toBe('2026-06-03T14:00:00.000Z');
  });
});
