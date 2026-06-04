# Reflow Algorithm Design — AI Prompts & Decisions

This file documents the key design questions explored with AI assistance and the decisions made for the production schedule reflow algorithm.

---

## 1. Topological Sort Strategy

**Problem:** Work orders form a directed acyclic graph (DAG) of dependencies. They must be scheduled in an order where every parent completes before any child starts. Naive iteration by start date doesn't respect multi-level chains.

**Prompt (paraphrased):** "What is the best algorithm for scheduling tasks with arbitrary dependency chains? I need cycle detection and deterministic ordering."

**Decision: Kahn's Algorithm (BFS-based topological sort)**

Why Kahn's over DFS-based sort:

- Cycle detection falls out naturally: if the output length < input length, a cycle exists.
- Seeds the queue with zero-in-degree nodes sorted by original start date, so independent orders retain their intended sequence without extra bookkeeping.
- O(V + E) time complexity — efficient for hundreds of work orders.

Alternative considered: recursive DFS + visited set. Rejected because cycle detection requires tracking recursion stack separately, adding complexity.

```
Kahn's pseudocode:
  queue ← all nodes with inDegree 0, sorted by startDate
  while queue not empty:
    n ← dequeue
    result.push(n)
    for each child of n:
      reduce child's inDegree by 1
      if child.inDegree == 0: insert child into queue (sorted by startDate)
  if result.length < total: throw CircularDependencyError
```

---

## 2. Shift-Aware Date Arithmetic

**Problem:** A work order takes `durationMinutes` of _working_ time, not elapsed calendar time. Work pauses at shift end and resumes at the next shift start. Naive `start + duration` produces wrong end dates.

**Prompt (paraphrased):** "How do I calculate the end time of a task that can only run during specific shift hours, pausing at shift boundaries and resuming in the next shift?"

**Decision: Consume working minutes in a loop**

The `calculateEndDate(start, durationMinutes, shifts, maintenanceWindows)` function:

1. At each iteration, compute the minutes available until the next boundary (shift end _or_ maintenance window start, whichever is sooner).
2. If remaining duration ≤ available: return `current + remaining` (done).
3. Otherwise: consume `available`, jump to next valid work time via `snapToValidWorkTime`, subtract consumed, repeat.

Why not a closed-form formula: shifts can vary by day of week, include maintenance windows, and can be discontinuous. A loop consuming working-minute "chunks" is robust to all these variations without special-casing.

Luxon was chosen for date arithmetic because:

- Handles UTC explicitly (`{ zone: 'utc' }`) — no local-time surprises.
- Fluent API for `plus({ minutes })`, `.set({ hour })`, `.weekday`.
- `diff()` returns typed duration objects, not raw numbers.

---

## 3. Constraint Processing Order

**Problem:** Multiple constraints can interact. Processing them in the wrong order can produce invalid schedules (e.g., snapping to a shift after placing the order, then discovering a maintenance window that shifts it further).

**Prompt (paraphrased):** "In what order should I resolve scheduling constraints — dependencies, work center conflicts, shift hours, and maintenance windows — to always produce a valid result in one pass?"

**Decision: Dependencies → Work Center Conflict → Shift + Maintenance (combined)**

1. **Dependencies first** — compute `max(parent.endDate)` to get the earliest the child _can_ start.
2. **Work center conflict** — advance past `wcLastEnd[workCenterId]` to avoid overlapping an earlier order on the same machine.
3. **Shift + maintenance combined** — `snapToValidWorkTime` handles both atomically. Running them separately risks a second shift-snap invalidating a previous maintenance skip.

This single-pass approach works because the topological sort guarantees parents are fully scheduled before children are processed.

---

## 4. Maintenance Window Handling

**Problem:** Maintenance windows are blocked periods on a work center during which no production can occur. They must be skipped entirely — both for start-time snapping and during mid-order duration calculation.

**Prompt (paraphrased):** "How should I handle a maintenance window that falls in the middle of an order's execution? The order can't be split; work simply pauses."

**Decision: Encode maintenance windows as additional shift boundaries**

`calculateEndDate` treats maintenance start as a "boundary" the same way it treats shift end. When the next boundary is a maintenance window start:

- Consume working minutes up to that boundary.
- Jump to the maintenance window end via `getMaintenanceEndContaining`.
- Then re-snap to ensure we land inside a shift (maintenance might end outside shift hours).
- Continue consuming remaining minutes.

This means a 3-hour order that hits a 2-hour maintenance window mid-execution will take 5 clock-hours total but still consume exactly 3 working hours.

**Immovable maintenance orders:** Work orders with `isMaintenance: true` are excluded from the topological sort and reflow entirely. Their `startDate`/`endDate` seeds the `wcLastEnd` map, so regular orders are pushed around them — not through them.

---

## 5. Optimization Metrics

**Problem:** After reflowing, stakeholders want to understand the business impact: how much total delay was introduced, and how efficiently each work center is being used.

**Prompt (paraphrased):** "What utilization metric makes sense for a work center? How do I measure how 'busy' a machine is across the scheduled period?"

**Decision:**

- **`totalDelayMinutes`:** Sum of `max(0, newEndDate - originalEndDate)` across all rescheduled orders. Negative values (orders moved earlier) are excluded — we report net delay introduced, not total movement.

- **`workCenterUtilization`:** `scheduledMinutes / availableShiftMinutes` where `availableShiftMinutes` is the total shift time across the date range spanned by that work center's orders (from earliest start to latest end). Capped at 1.0. A value near 1.0 means the work center is fully loaded; a low value indicates slack capacity.

`availableMinutesInRange` iterates day-by-day, summing shift windows — O(days) but acceptable since a schedule rarely spans more than a few hundred days.

---

## 6. Setup Time

**Problem:** Some work orders require machine setup before production begins. This time counts as working time within shifts (the machine is occupied) but is separate from `durationMinutes` (which represents pure production time).

**Prompt (paraphrased):** "The spec says setupTimeMinutes should count as working time. Where exactly in the algorithm should it be added?"

**Decision: Add to effective duration before `calculateEndDate`**

```typescript
const effectiveDuration = durationMinutes + (setupTimeMinutes ?? 0);
```

The `effectiveDuration` is passed to `calculateEndDate`, which means setup time respects shift boundaries and maintenance windows exactly like production time. The `wcLastEnd` is set to the end of the full effective duration, blocking subsequent orders until both setup and production are complete.

This ensures a dependent order cannot start until setup on the parent finishes — which is the correct real-world behavior.
