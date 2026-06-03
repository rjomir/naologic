import { DateTime } from 'luxon';
import type { Shift, MaintenanceWindow } from '../types.js';

/** Luxon weekday (1=Mon…7=Sun) → spec dayOfWeek (0=Sun…6=Sat) */
function toSpecDay(luxonWeekday: number): number {
  return luxonWeekday === 7 ? 0 : luxonWeekday;
}

export function getShiftForDay(dt: DateTime, shifts: Shift[]): Shift | undefined {
  const specDay = toSpecDay(dt.weekday);
  return shifts.find(s => s.dayOfWeek === specDay);
}

export function isInShift(dt: DateTime, shifts: Shift[]): boolean {
  const shift = getShiftForDay(dt, shifts);
  if (!shift) return false;
  const decimal = dt.hour + dt.minute / 60 + dt.second / 3600;
  return decimal >= shift.startHour && decimal < shift.endHour;
}

export function getShiftEnd(dt: DateTime, shifts: Shift[]): DateTime | null {
  const shift = getShiftForDay(dt, shifts);
  if (!shift) return null;
  return dt.startOf('day').set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 });
}

/** Find the next shift start at or after `from`. */
function findNextShiftStart(from: DateTime, shifts: Shift[]): DateTime {
  for (let daysAhead = 0; daysAhead <= 14; daysAhead++) {
    const day = from.startOf('day').plus({ days: daysAhead });
    const shift = getShiftForDay(day, shifts);
    if (!shift) continue;

    const shiftStart = day.set({ hour: shift.startHour, minute: 0, second: 0, millisecond: 0 });
    const shiftEnd = day.set({ hour: shift.endHour, minute: 0, second: 0, millisecond: 0 });

    if (daysAhead === 0) {
      if (from < shiftEnd) {
        // Either inside the shift or before it starts today
        return from <= shiftStart ? shiftStart : from;
      }
      continue; // shift already over today
    }

    return shiftStart;
  }
  throw new Error('No shift found within 14 days');
}

export function isInMaintenance(dt: DateTime, windows: MaintenanceWindow[]): boolean {
  for (const w of windows) {
    const start = DateTime.fromISO(w.startDate, { zone: 'utc' });
    const end = DateTime.fromISO(w.endDate, { zone: 'utc' });
    if (dt >= start && dt < end) return true;
  }
  return false;
}

function getMaintenanceEndContaining(dt: DateTime, windows: MaintenanceWindow[]): DateTime | null {
  for (const w of windows) {
    const start = DateTime.fromISO(w.startDate, { zone: 'utc' });
    const end = DateTime.fromISO(w.endDate, { zone: 'utc' });
    if (dt >= start && dt < end) return end;
  }
  return null;
}

function getNextMaintenanceStart(from: DateTime, windows: MaintenanceWindow[]): DateTime | null {
  let nearest: DateTime | null = null;
  for (const w of windows) {
    const start = DateTime.fromISO(w.startDate, { zone: 'utc' });
    if (start > from) {
      if (!nearest || start < nearest) nearest = start;
    }
  }
  return nearest;
}

/**
 * Advance `from` to the next moment that is both inside a shift and
 * outside any maintenance window.
 */
export function snapToValidWorkTime(
  from: DateTime,
  shifts: Shift[],
  windows: MaintenanceWindow[],
): DateTime {
  let current = from;

  for (let guard = 0; guard < 60; guard++) {
    // 1. Skip maintenance
    if (isInMaintenance(current, windows)) {
      const end = getMaintenanceEndContaining(current, windows)!;
      current = end;
      continue;
    }

    // 2. Snap to shift
    if (!isInShift(current, shifts)) {
      current = findNextShiftStart(current, shifts);
      continue;
    }

    // 3. Might have landed in maintenance after shift snap
    if (isInMaintenance(current, windows)) {
      continue;
    }

    return current;
  }

  throw new Error('Could not find valid work time within guard limit');
}

/**
 * Calculate the actual end date/time given a start, duration, shifts, and
 * maintenance windows. Work pauses outside shifts and during maintenance,
 * resuming at the next valid moment.
 */
export function calculateEndDate(
  start: DateTime,
  durationMinutes: number,
  shifts: Shift[],
  windows: MaintenanceWindow[],
): DateTime {
  let current = snapToValidWorkTime(start, shifts, windows);
  let remaining = durationMinutes;

  while (remaining > 0) {
    const shiftEnd = getShiftEnd(current, shifts);
    if (!shiftEnd) {
      // Defensive: snap again
      current = snapToValidWorkTime(current.plus({ minutes: 1 }), shifts, windows);
      continue;
    }

    const minutesToShiftEnd = shiftEnd.diff(current, 'minutes').minutes;
    const nextMaint = getNextMaintenanceStart(current, windows);
    const minutesToMaint = nextMaint ? nextMaint.diff(current, 'minutes').minutes : Infinity;

    const available = Math.min(minutesToShiftEnd, minutesToMaint);

    if (available <= 0) {
      // At a boundary — advance past it
      if (minutesToMaint <= 0 && nextMaint) {
        const maintEnd = getMaintenanceEndContaining(current, windows) ?? nextMaint;
        current = snapToValidWorkTime(maintEnd, shifts, windows);
      } else {
        current = snapToValidWorkTime(current.plus({ minutes: 1 }), shifts, windows);
      }
      continue;
    }

    if (remaining <= available) {
      return current.plus({ minutes: remaining });
    }

    remaining -= available;
    current = current.plus({ minutes: available });

    // Advance past the boundary we just hit
    current = snapToValidWorkTime(current, shifts, windows);
  }

  return current;
}
