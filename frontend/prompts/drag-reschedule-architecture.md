# Prompt: Drag-to-Reschedule Architecture

## Context

Drag-to-reschedule is listed as a bonus feature in the FE spec. A user should be able to
drag a work order bar horizontally to a new date, and the timeline should call the API to
persist the change.

This prompt documents the architecture to implement when the feature is prioritised.

## Core drag payload

When a drag starts, capture the bar's identifying data:

```typescript
interface DragPayload {
  id: string; // work order docId
  name: string; // for the drag preview label
  startMs: number; // original start timestamp (Unix ms)
  durationMs: number; // end - start, kept constant during drag
  status: string;
  locked: boolean; // if true, prevent drag
}
```

## Drop calculation

On `cdkDragEnded` (or equivalent drop event), compute the new start date from where the
pointer landed:

```typescript
// cursorContentX = event.pointerPosition.x - gridLeft + scrollLeft
const newStartMs = pxToMs(cursorContentX, totalWidth, contentViewport);
const newEndMs = newStartMs + payload.durationMs;
```

Then call `PATCH /api/work-orders/:id` with `{ startDate, endDate }` (ISO strings).

## Angular CDK approach

```
pnpm --filter frontend add @angular/cdk
```

1. Apply `cdkDrag` to `app-work-order-bar` and `cdkDropList` to `.grid-area`.
2. Pass `[cdkDragData]="wo"` so the drop handler receives the work order.
3. Set `cdkDragBoundary=".grid-area"` to confine horizontal movement.
4. Use `cdkDragConstrainPosition` to lock vertical movement (Y stays fixed).
5. On `(cdkDragEnded)`: read `event.distance.x`, compute delta ms from delta px, call API.
6. Optimistic update: update the signal immediately, roll back on API error.

## Lock behaviour

If `workOrder.data.locked === true`, set `[cdkDragDisabled]="true"` and show a lock icon
on the bar. The bar should still be clickable for editing.

## Snap-to-day option

After computing `newStartMs`, optionally snap to the nearest day boundary:

```typescript
const snapped = Math.round(newStartMs / MS_PER_DAY) * MS_PER_DAY;
```

This keeps orders aligned to calendar days and avoids fractional-hour start times.

## Overlap prevention

Before persisting, check if the new date range overlaps with another order on the same
work center. Use the same overlap detection logic already present in the create/edit panel.
If overlap detected, cancel the drag and show a brief inline error.
