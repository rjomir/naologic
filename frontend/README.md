# Work Order Schedule Timeline – Frontend

An interactive timeline component for a manufacturing ERP system, built with Angular 21 (standalone components, OnPush change detection, signals).

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm start        # or: pnpm exec ng serve
```

Open [http://localhost:4200](http://localhost:4200). The app expects the backend API at `http://localhost:3000/api` (configurable via the `API_URL` injection token).

## Stack

| Library                    | Version | Purpose                                             |
| -------------------------- | ------- | --------------------------------------------------- |
| Angular                    | 21.2    | Framework – standalone components, signals, OnPush  |
| @ng-select/ng-select       | 21.x    | Timescale zoom dropdown                             |
| @ng-bootstrap/ng-bootstrap | 20.x    | `ngb-datepicker` inside the datetime picker popover |
| Bootstrap                  | 5.x     | Base styles (reset + utility classes)               |
| Playwright                 | 1.60    | E2E test suite                                      |

## Features

- **Timeline grid** – Day / Week / Month zoom levels with a sticky left column and a horizontally scrollable date grid; keyboard-controlled via Ctrl+Wheel smooth zoom
- **Infinite scroll** – Detects when the viewport approaches either edge and prepends/appends date columns without a visible jump
- **Work order bars** – Positioned by date, colour-coded by status; graceful degradation at narrow widths (hidden / xs / sm / md size tiers)
- **Three-dot actions menu** – Per-bar dropdown with Edit and Delete
- **Create panel** – Click any empty timeline row; start date pre-filled from click position, end date pre-filled to start + 7 days
- **Edit panel** – Same slide-out panel in edit mode; form pre-populated with the existing order's data
- **Date + time picker** – `DatetimePickerComponent`: a `ControlValueAccessor` that exposes a single readonly input and opens an `ngb-datepicker` + hour / minute selects in an `NgbPopover`; stores values as full ISO datetime strings
- **Form validation** – Required fields, end-must-be-after-start group validator, client-side overlap detection
- **Overlap detection** – `ScheduleValidatorService` compares date ranges; blocks save with an inline error
- **Today indicator** – Vertical blue line marking the current date; "Today" button re-centres the viewport
- **Real-time sync** – `SseService` opens a Server-Sent Events connection; the timeline reflects changes made by other users instantly
- **Run Reflow** – Triggers the backend scheduling algorithm; response shown in a dismissible banner

## Architecture

```
src/app/
├── models/types.ts                              # Shared interfaces + SSE event types
├── tokens/api-url.token.ts                      # API_URL injection token
├── interceptors/api-error.interceptor.ts        # Centralised HTTP error normalisation
├── services/
│   ├── work-order.service.ts                    # State facade — owns signals, orchestrates below
│   ├── work-order-api.service.ts                # Thin HTTP layer (HttpClient), no state
│   ├── schedule-validator.service.ts            # Pure overlap-check logic, no HTTP
│   └── sse.service.ts                           # EventSource wrapper, auto-reconnects
└── timeline/
    ├── timeline.component.*                     # Main container, date↔pixel math, zoom, scroll
    ├── utils/
    │   ├── compute-notches.ts                   # Adaptive ruler notch selection
    │   ├── viewport.utils.ts                    # Anchor zoom + clamped px↔ms conversion
    │   └── activity-size.model.ts               # Bar size classification (hidden/xs/sm/md)
    ├── work-order-bar/                          # Individual bar + three-dot dropdown
    └── work-order-panel/
        ├── work-order-panel.component.*         # Create/Edit slide-out panel
        └── datetime-picker.component.*          # ControlValueAccessor date+time picker
```

## Date Positioning

Bar positions are calculated as:

```
left  = (startDate − timelineStart) / 86_400_000 × pixelsPerDay
width = (endDate − startDate) / 86_400_000 × pixelsPerDay
```

`pixelsPerDay` is set per zoom preset (Hour: 1440 · Day: 50 · Week: 20 · Month: 5) and can be adjusted continuously via Ctrl+Wheel. The click→date inverse uses the same formula with `scrollLeft` factored in. All arithmetic uses local-time dates to avoid DST-induced shifts in click-to-date mapping.

## E2E Tests

Playwright tests live in `e2e/`. The config auto-starts `ng serve` before running.

```bash
pnpm test:e2e          # run all specs
pnpm test:e2e --ui     # open Playwright UI mode
```

**Covered scenarios:**

| Spec file              | Scenarios                                                                        |
| ---------------------- | -------------------------------------------------------------------------------- |
| `timeline.spec.ts`     | Work center rendering, bar presence, create/edit/delete flow, zoom, today button |
|                        | Panel close (backdrop / Cancel / Escape), datetime picker popover, row hover     |
|                        | Overlap detection, infinite scroll (left + right edge)                           |
| `error-states.spec.ts` | API error banner on load, reflow success/failure banners, banner dismiss         |

API calls are intercepted by patching `window.fetch` before Angular bootstraps — no real backend required.

## Design Notes

Colors, spacing, and typography match the provided Sketch file. The Circular Std font is loaded from Naologic's CDN. The `dt-` CSS prefix is used for all datetime picker styles (written with `ViewEncapsulation.None` so they reach NgbPopover content rendered in `document.body`).
