/**
 * Viewport zoom math with cursor anchor point.
 *
 * When zooming in/out, the point under the cursor should stay at the same screen
 * position. This requires expanding/contracting the viewport asymmetrically around
 * the anchor point rather than around the center.
 *
 * Without anchor: zoom always recenters on the viewport midpoint, causing the
 * visible date under the cursor to "drift" after each wheel step.
 *
 * With anchor:
 *   newFrom = from + Δ * anchorRatio
 *   newTo   = to   - Δ * (1 - anchorRatio)
 *
 * Where anchorRatio = cursorX / containerWidth  (0 = left edge, 1 = right edge)
 */

export interface ViewportMs {
  from: number;
  to: number;
}

/** Minimum visible duration: 2 hours */
const MIN_DURATION_MS = 2 * 3_600_000;
/** Maximum visible duration: 5 years */
const MAX_DURATION_MS = 5 * 365 * 86_400_000;

/**
 * Apply a zoom step to a viewport, keeping the anchor point (cursor position)
 * fixed on screen.
 *
 * @param viewport     Current viewport {from, to} in Unix ms
 * @param deltaMs      How many ms to add/remove from the total duration (positive = zoom out)
 * @param anchorRatio  Cursor position as a fraction of container width [0..1]
 */
export function anchorZoom(viewport: ViewportMs, deltaMs: number, anchorRatio: number): ViewportMs {
  const ratio = Math.max(0, Math.min(1, anchorRatio));
  let newFrom = viewport.from + deltaMs * ratio;
  let newTo = viewport.to - deltaMs * (1 - ratio);

  // Clamp duration within allowed range
  const duration = newTo - newFrom;
  if (duration < MIN_DURATION_MS) {
    const mid = (newFrom + newTo) / 2;
    newFrom = mid - MIN_DURATION_MS / 2;
    newTo = mid + MIN_DURATION_MS / 2;
  } else if (duration > MAX_DURATION_MS) {
    const mid = (newFrom + newTo) / 2;
    newFrom = mid - MAX_DURATION_MS / 2;
    newTo = mid + MAX_DURATION_MS / 2;
  }

  return { from: newFrom, to: newTo };
}

/**
 * Convert a pixel X position (relative to the content area, scroll-adjusted)
 * to a Unix ms timestamp within the viewport.
 */
export function pxToMs(
  scrollAdjustedX: number,
  containerWidthPx: number,
  viewport: ViewportMs,
): number {
  const ratio = scrollAdjustedX / containerWidthPx;
  return viewport.from + ratio * (viewport.to - viewport.from);
}

/**
 * Convert a Unix ms timestamp to a pixel X position within the content area.
 */
export function msToRelativePx(
  timestampMs: number,
  containerWidthPx: number,
  viewport: ViewportMs,
): number {
  const duration = viewport.to - viewport.from;
  if (duration <= 0) return 0;
  return ((timestampMs - viewport.from) / duration) * containerWidthPx;
}
