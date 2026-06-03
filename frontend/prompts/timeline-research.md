# Prompt: Timeline Architecture Research

## Prompt sent to AI

> Research best practices for Gantt-style timeline components in web applications.
> Specifically: how should date-to-pixel calculations work? How do production-grade timelines
> handle zoom levels and ruler notches? What's the right pattern for bar sizing when
> zoomed out far enough that bars become very narrow?

## Findings

### Date-to-pixel positioning

The cleanest approach: a single `pixelsPerDay` value as the zoom variable.
All positioning reduces to `(date - origin) / msPerDay * pixelsPerDay`.
Avoids the complexity of separate zoom-level column-width maps.

### Adaptive ruler notches

Fixed column headers (one label per day/week/month) collapse at different zoom levels.
The right approach: compute notches dynamically from viewport duration and pixel width.
Pick the finest unit (year → month → week → day → hour → minute) + multiplier where
each notch is at least ~90px wide. This gives readable labels at any zoom level automatically.

### Bar size progressive disclosure

When a bar represents a short order at a zoomed-out level, attempting to render name +
badge + menu inside a 4px wide bar produces overflow and broken UI.
Solution: classify bars into tiers (hidden / xs / sm / md) based on fraction of total
content width, and progressively collapse content at smaller tiers.

### Cursor-anchored zoom

Without anchor: zoom centers on the viewport midpoint — the date under the cursor drifts.
With anchor: expand/contract the viewport asymmetrically around the cursor position.
Formula: `newFrom = from + Δ * anchor`, `newTo = to - Δ * (1 - anchor)`
where `anchor = cursorX / containerWidth`.
