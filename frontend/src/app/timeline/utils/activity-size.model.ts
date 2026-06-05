/**
 * Bar size classification for graceful degradation of narrow work order bars.
 *
 * When a work order bar is very narrow relative to the visible timeline, rendering
 * the full name + status badge causes overflow and an unreadable UI. This model maps
 * the bar's fraction of total width to a display tier, which components use to
 * progressively collapse the bar contents.
 */

/** Display tiers from smallest to largest */
export type BarSize = 'hidden' | 'xs' | 'sm' | 'md';

/** Absolute pixel thresholds — independent of total timeline width so prepending days never reclassifies a bar */
const PX_HIDDEN = 4;
const PX_XS = 24;
// 130 px: md padding (20) + name (30) + gap (8) + largest badge (41) + gap (8) + button (24) = 131
const PX_SM = 130;

/**
 * Classify a bar into a display tier based on its absolute rendered pixel width.
 *
 * @param barWidthPx  Rendered pixel width of the bar
 */
export function getBarSize(barWidthPx: number): BarSize {
  if (barWidthPx < PX_HIDDEN) return 'hidden';
  if (barWidthPx < PX_XS) return 'xs';
  if (barWidthPx < PX_SM) return 'sm';
  return 'md';
}
