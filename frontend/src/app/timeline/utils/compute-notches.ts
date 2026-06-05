/**
 * Adaptive timeline ruler notch computation.
 *
 * Given a viewport time range and a pixel width, automatically selects the finest
 * time unit + multiplier that keeps notches at least MIN_NOTCH_PX wide.
 * This prevents the ruler from becoming unreadably dense at low zoom levels,
 * and ensures the right granularity (day labels vs week labels vs month labels)
 * appears automatically without manual zoom-level switching.
 */

export interface TimelineNotch {
  /** Unique key for @for tracking */
  key: string;
  /** Human-readable label rendered in the header */
  label: string;
  /** Notch boundary date */
  date: Date;
  /** Pixel width this notch occupies in the total content area */
  widthPx: number;
  /** Duration this notch covers in milliseconds */
  spanMs: number;
}

interface NotchConfig {
  unit: string;
  msPerUnit: number;
  multipliers: number[];
  formatLabel: (d: Date) => string;
}

/** Minimum pixel gap between ruler labels before switching to a coarser unit */
const MIN_NOTCH_PX = 90;

const NOTCH_CONFIGS: NotchConfig[] = [
  {
    unit: 'year',
    msPerUnit: 365.25 * 86_400_000,
    multipliers: [1],
    formatLabel: d => d.getFullYear().toString(),
  },
  {
    unit: 'month',
    msPerUnit: 30.44 * 86_400_000,
    multipliers: [1, 2, 3, 6],
    formatLabel: d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  },
  {
    unit: 'week',
    msPerUnit: 7 * 86_400_000,
    multipliers: [1, 2, 4],
    formatLabel: d => `Wk ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  },
  {
    unit: 'day',
    msPerUnit: 86_400_000,
    multipliers: [1, 2, 3, 5, 7, 14],
    formatLabel: d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
  {
    unit: 'hour',
    msPerUnit: 3_600_000,
    multipliers: [1, 2, 4, 6, 8, 12],
    formatLabel: d =>
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  },
  {
    unit: 'minute',
    msPerUnit: 60_000,
    multipliers: [1, 5, 10, 15, 30],
    formatLabel: d =>
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
  },
];

/**
 * Compute ruler notches for a given viewport and container width.
 *
 * @param viewportFromMs    Start of visible range (Unix ms)
 * @param viewportToMs      End of visible range (Unix ms)
 * @param containerWidthPx  Total pixel width of the timeline content area (used for notch widths)
 * @param visibleWidthPx    Pixel width of the visible viewport (used for density guard).
 *                          Defaults to containerWidthPx when not provided.
 * @param minUnit           Coarsest unit the algorithm is allowed to pick (e.g. 'day' means
 *                          year/month/week are skipped). Falls back to coarser units only when
 *                          the minUnit and finer units are all too small to be readable.
 */
export function computeNotches(
  viewportFromMs: number,
  viewportToMs: number,
  containerWidthPx: number,
  visibleWidthPx = containerWidthPx,
  minUnit?: string,
): TimelineNotch[] {
  if (containerWidthPx <= 0 || viewportToMs <= viewportFromMs) return [];

  const duration = viewportToMs - viewportFromMs;

  const minIdx = minUnit
    ? Math.max(
        0,
        NOTCH_CONFIGS.findIndex(c => c.unit === minUnit),
      )
    : 0;

  let selectedConfig: NotchConfig = NOTCH_CONFIGS[NOTCH_CONFIGS.length - 1];
  let selectedMultiplier: number = selectedConfig.multipliers.at(-1)!;

  const pickFrom = (startIndex: number): boolean => {
    for (let i = startIndex; i < NOTCH_CONFIGS.length; i++) {
      const config = NOTCH_CONFIGS[i];
      for (const mult of config.multipliers) {
        const spanMs = config.msPerUnit * mult;
        const notchPx = (spanMs / duration) * containerWidthPx;
        if (notchPx >= MIN_NOTCH_PX && notchPx < visibleWidthPx / 2) {
          selectedConfig = config;
          selectedMultiplier = mult;
          return true;
        }
      }
    }
    return false;
  };

  // Try from minUnit first; fall back to coarser units if nothing in range is readable.
  if (!pickFrom(minIdx) && minIdx > 0) pickFrom(0);

  const spanMs = selectedConfig.msPerUnit * selectedMultiplier;
  // Snap to the first boundary before the viewport start
  const startMs = Math.floor(viewportFromMs / spanMs) * spanMs;

  const notches: TimelineNotch[] = [];

  for (let t = startMs; t < viewportToMs; t += spanMs) {
    const rightMs = Math.min(t + spanMs, viewportToMs);
    const leftMs = Math.max(t, viewportFromMs);
    const widthPx = ((rightMs - leftMs) / duration) * containerWidthPx;
    if (widthPx <= 0) continue;

    notches.push({
      key: t.toString(),
      label: selectedConfig.formatLabel(new Date(t)),
      date: new Date(Math.max(t, viewportFromMs)),
      widthPx,
      spanMs,
    });
  }

  return notches;
}
