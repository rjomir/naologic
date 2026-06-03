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

/** Fraction thresholds (bar width / total content width) */
const THRESHOLD_HIDDEN = 0.001; // < 0.1%  — too thin to render anything meaningful
const THRESHOLD_XS = 0.006; // < 0.6%  — just a colored sliver, no text
const THRESHOLD_SM = 0.022; // < 2.2%  — show status badge only, no name

/**
 * Classify a bar into a display tier based on its width relative to total content width.
 *
 * @param barWidthPx      Rendered pixel width of the bar
 * @param totalWidthPx    Total pixel width of the timeline content area
 */
export function getBarSize(barWidthPx: number, totalWidthPx: number): BarSize {
  if (totalWidthPx <= 0 || barWidthPx <= 0) return 'hidden';
  const fraction = barWidthPx / totalWidthPx;
  if (fraction < THRESHOLD_HIDDEN) return 'hidden';
  if (fraction < THRESHOLD_XS) return 'xs';
  if (fraction < THRESHOLD_SM) return 'sm';
  return 'md';
}
