# Prompt: Cursor-Anchored Ctrl+Wheel Zoom

## Context

The zoom dropdown reset scroll position to center on today every time it was used.
There was no way to zoom into a specific date without manually scrolling after.

## Prompt sent to AI

> Add Ctrl+wheel zoom to the timeline scroll container.
> When the user holds Ctrl and scrolls, zoom in/out while keeping the date currently
> under the cursor fixed at the same screen X position (cursor-anchored zoom).
> Sync the zoom dropdown label to the closest preset when continuous zoom is used.

## Algorithm

```
// anchor ratio: 0 = left edge, 1 = right edge of visible area
anchorRatio = (cursorClientX - leftColWidth) / visibleGridWidth

// Expand/contract asymmetrically around the anchor:
newFrom = from + Δ * anchorRatio
newTo   = to   - Δ * (1 - anchorRatio)

// Re-scroll so cursor date stays at same screen position:
newScrollLeft = (cursorDateMs - timelineStartMs) / msPerDay * newPxPerDay - cursorScreenX
```

## Design decisions

**`pixelsPerDay` as the zoom variable (not a pure viewport model)**

- A full viewport model would remove horizontal scrolling entirely
- Keeping the 120-day fixed content range and varying pixel density is simpler
- Still uses the anchor math — just converts back to `pixelsPerDay` at the end

**Ctrl+wheel only**

- Plain wheel scrolls horizontally (native behavior preserved)
- Ctrl+wheel zooms — consistent with maps, editors, and browser zoom convention
- `event.preventDefault()` called only when Ctrl is held

**Zoom label sync thresholds**

- Day: `pixelsPerDay >= 30`
- Week: `pixelsPerDay >= 10`
- Month: `pixelsPerDay < 10`
