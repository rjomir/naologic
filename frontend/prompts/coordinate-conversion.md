# Prompt: Precise Pixel ↔ Timestamp Conversion with Viewport Clamping

## Context

The timeline has two coordinate conversion paths:

1. `dateToPx(date, from)` — date → absolute pixel position in the content area (used for
   bar placement and ruler notch positioning)
2. `pxToDate(px)` — pixel position → date (used for click-to-create date prefill)

The original `pxToDate` had no bounds checking:

```typescript
// before — unclamped
return new Date(timelineStart + (px / pixelsPerDay) * MS_PER_DAY);
```

If `px` was negative (click to the left of the content area) or exceeded `totalWidth()`
(click to the right), the resulting date would be outside the 120-day content range.
While unlikely in normal use, it produces silent data corruption: an order created outside
the visible range would be invisible on the timeline.

## Prompt sent to AI

> Tighten the click-to-date math in `pxToDate`.
> Clamp the pixel input to `[0, totalWidth()]` before computing the date so no out-of-bounds
> timestamp can be produced from a mis-click or edge interaction.
> Also add ratio/result clamping to the `pxToMs` and `msToRelativePx` utility functions so
> any future consumer gets correct bounds for free.

## Design decisions

**Clamp at the ratio level in `pxToMs`, not at the output level**

Clamping `ratio = clamp(px / width, 0, 1)` before multiplying is more robust than clamping
the final ms value, because it correctly handles edge cases where `containerWidthPx` is 0
(returns `viewport.from` instead of NaN/Infinity).

**`pxToDate` delegates to `pxToMs`**

Rather than inlining the clamped formula in the component, `pxToDate` now calls `pxToMs`
with a full-content viewport `{from: timelineStartMs, to: timelineEndMs}`. This keeps the
component in sync with the utility layer and ensures both use the same clamping logic.

**`msToRelativePx` clamps output to `[0, containerWidthPx]`**

A timestamp outside the viewport would otherwise produce a negative or overflowing pixel
position, causing bars to render outside the grid. The clamp is a safety net for any
caller that passes an out-of-range timestamp.

## Key formula

```typescript
// pxToMs — clamped ratio
const ratio = Math.max(0, Math.min(1, scrollAdjustedX / containerWidthPx));
return viewport.from + ratio * (viewport.to - viewport.from);

// msToRelativePx — clamped result
const px = ((timestampMs - viewport.from) / duration) * containerWidthPx;
return Math.max(0, Math.min(containerWidthPx, px));
```
