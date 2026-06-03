# Prompt: Adaptive Ruler Notches Implementation

## Context

The timeline initially rendered one fixed-width column per day/week/month based on a zoom
dropdown. At Day zoom with 120 columns × 50px = 6000px total width, every column showed an
individual label. This was fine when containers were wide, but at any zoom-out the labels
collided and the header became unreadable.

## Prompt sent to AI

> Build a `computeNotches()` utility for the Angular timeline ruler.
> Given viewport start/end timestamps and container pixel width, automatically select the finest
> time unit + multiplier where each notch is at least 90px wide.
> Integrate into the timeline header as absolutely-positioned adaptive labels over the day grid.
> Replace the fixed `COLUMN_WIDTH[zoomLevel]` map with a single `pixelsPerDay` signal.

## Design decisions

**Single `pixelsPerDay` signal**

- Before: `zoomLevel → COLUMN_WIDTH → columnWidth` (three concepts for one thing)
- After: `pixelsPerDay` is the only zoom variable; dropdown sets presets (50/20/6 px/day)
- `dateToPx()` simplifies to: `days * pixelsPerDay`

**Columns are always day units**

- Before: columns were day/week/month units depending on zoom level
- After: always 120 day columns; only their rendered width changes
- Notch labels are drawn independently over these, completely decoupled from column count

**Header rendering: absolute position over day-grid**

- Notch labels are `position: absolute` over the scrollable content area
- Day column grid lines are unchanged (flex)
- Keeps grid structure and label granularity as separate concerns

## Key formula

```typescript
// Select unit where notch is at least MIN_NOTCH_PX wide:
notchWidthPx = (spanMs / viewportDurationMs) * containerWidthPx >= 90;

// Notch left position:
leftPx = ((notchDateMs - viewportFromMs) / viewportDurationMs) * containerWidthPx;
```
