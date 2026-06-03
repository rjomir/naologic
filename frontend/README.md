# Work Order Schedule Timeline – Frontend

An interactive timeline component for a manufacturing ERP system, built with Angular 21 (standalone components).

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm start        # or: pnpm exec ng serve
```

Open [http://localhost:4200](http://localhost:4200).

## Stack

| Library                    | Version | Purpose                                    |
| -------------------------- | ------- | ------------------------------------------ |
| Angular                    | 21.2    | Framework (standalone components, signals) |
| @ng-select/ng-select       | 21.x    | Timescale dropdown                         |
| @ng-bootstrap/ng-bootstrap | 20.x    | ngb-datepicker for date picking            |
| Bootstrap                  | 5.x     | Base styles                                |

## Features

- **Timeline grid** – Day / Week / Month zoom levels with a fixed left panel (work center names) and horizontally scrollable date grid
- **Work order bars** – positioned by date, color-coded by status (Open / In Progress / Complete / Blocked)
- **Three-dot actions menu** – Edit and Delete per work order
- **Create panel** – click any empty timeline area to open a slide-in panel with the start date pre-filled from the click position
- **Edit panel** – same panel re-used in edit mode, pre-populated with existing data
- **Overlap detection** – blocks save if dates overlap an existing order on the same work center (excludes self when editing)
- **Today indicator** – vertical blue line marking the current date; "Today" button re-centers the viewport
- **localStorage persistence** – work orders survive page refresh

## Architecture

```
src/app/
├── models/types.ts                          # Shared interfaces
├── data/sample-data.ts                      # 5 work centers, 9 work orders
├── services/work-order.service.ts           # Signal-based CRUD + overlap check
└── timeline/
    ├── timeline.component.*                 # Main container, date↔pixel math
    ├── work-order-bar/                      # Individual bar + three-dot menu
    └── work-order-panel/                    # Create/Edit slide-out panel
```

## Date Positioning

Bar positions are calculated as:

```
left  = (startDate - timelineStart) / unit * columnWidth
width = (endDate - startDate) / unit * columnWidth
```

Where `unit` is 1 day (Day view), 7 days (Week view), or 30.44 days (Month view). The click→date inverse calculation uses the same formula with `scrollLeft` factored in.

## Design Notes

Colors, spacing, and typography are intended to match the provided Sketch file. The Circular Std font is loaded from Naologic's CDN. Verify exact hex values and spacing against the Sketch file before final submission.
