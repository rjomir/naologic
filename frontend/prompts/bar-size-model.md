# Prompt: Bar Size Model for Graceful Narrow Bar Rendering

## Context

Work order bars overflowed or showed clipped text when representing short-duration orders
at low zoom levels. A 1-day order at month zoom is ~6px wide — rendering name + badge +
three-dot menu inside 6px is impossible and looks broken.

## Prompt sent to AI

> Design a progressive disclosure system for work order bars.
> Classify bars into size tiers based on their width as a fraction of total content width.
> Update WorkOrderBarComponent to accept a barSize input and conditionally render content:
>
> - md: full render (name + status badge + three-dot menu)
> - sm: status badge only
> - xs: solid colored sliver with native tooltip on hover
> - hidden: not rendered at all (filtered in parent)

## Thresholds

| Tier     | Fraction | Rationale                                              |
| -------- | -------- | ------------------------------------------------------ |
| `hidden` | < 0.1%   | Sub-pixel at any reasonable zoom — not worth rendering |
| `xs`     | < 0.6%   | ~36px at 6000px total — too narrow for any text        |
| `sm`     | < 2.2%   | ~130px — fits a compact badge but not a full name      |
| `md`     | ≥ 2.2%   | Enough space for name + badge + three-dot menu         |

## Implementation notes

- `getBarSize()` is a pure function: `(barWidthPx, totalWidthPx) → BarSize`
- Called in `TimelineComponent.getBarSize()` which reads `getBarStyle()` width and `totalWidth()`
- `hidden` bars are filtered with `@if (getBarSize(wo) !== 'hidden')` in the template
- `xs` bars use a native `title` attribute for tooltip — no extra library needed
