/**
 * Comprehensive happy-flow E2E suite.
 *
 * All API calls are intercepted — no real backend required.
 * Covers:
 *   • App initial render (title, work centers, today indicator)
 *   • Full lifecycle: create → screenshot → verify → tooltip → edit → reflow → delete
 *   • Status badge CSS classes for all 4 statuses
 *   • Form validation: required name, end-after-start, overlap detection
 *   • All 4 timescale zoom levels
 *   • Today-button navigation
 *   • Reflow banner: with changes + no-changes variants + dismiss
 */

import { test, expect, type Page } from '@playwright/test';

// ── Shared test fixtures ──────────────────────────────────────────────────────

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFrom = (n: number) => new Date(today.getTime() + n * 86_400_000);

/** 5 work centers matching the real seed data names */
const WORK_CENTERS = [
  { docId: 'wc-extrusion-a', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
  { docId: 'wc-cnc-1', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
  { docId: 'wc-assembly', docType: 'workCenter', data: { name: 'Assembly Station' } },
  { docId: 'wc-quality', docType: 'workCenter', data: { name: 'Quality Control' } },
  { docId: 'wc-packaging', docType: 'workCenter', data: { name: 'Packaging Line' } },
];

/**
 * One work order per status.
 * Each spans ≥27 days so it renders as an 'md' bar at month zoom (5 px/day → ≥135 px),
 * which means the status badge and three-dot menu button are both visible.
 */
const BASELINE_ORDERS = [
  {
    docId: 'wo-open-1',
    docType: 'workOrder',
    data: {
      name: 'Open Order Alpha',
      workCenterId: 'wc-extrusion-a',
      status: 'open',
      startDate: iso(daysFrom(5)),
      endDate: iso(daysFrom(35)),
    },
  },
  {
    docId: 'wo-inprogress-1',
    docType: 'workOrder',
    data: {
      name: 'In-Progress Batch',
      workCenterId: 'wc-cnc-1',
      status: 'in-progress',
      startDate: iso(daysFrom(-10)),
      endDate: iso(daysFrom(20)),
    },
  },
  {
    docId: 'wo-complete-1',
    docType: 'workOrder',
    data: {
      name: 'Completed Run',
      workCenterId: 'wc-assembly',
      status: 'complete',
      startDate: iso(daysFrom(-60)),
      endDate: iso(daysFrom(-30)),
    },
  },
  {
    docId: 'wo-blocked-1',
    docType: 'workOrder',
    data: {
      name: 'Blocked Job',
      workCenterId: 'wc-quality',
      status: 'blocked',
      startDate: iso(daysFrom(40)),
      endDate: iso(daysFrom(70)),
    },
  },
];

// Reflow response when 2 orders need rescheduling (960 min = 16 h total delay)
const REFLOW_WITH_CHANGES = {
  changes: [
    {
      docId: 'wo-open-1',
      workOrderNumber: 'WO-OPEN',
      originalStartDate: iso(daysFrom(5)),
      newStartDate: iso(daysFrom(7)),
      originalEndDate: iso(daysFrom(35)),
      newEndDate: iso(daysFrom(37)),
      delayMinutes: 480,
      reason: 'Work center occupied by preceding order',
    },
    {
      docId: 'wo-inprogress-1',
      workOrderNumber: 'WO-IP',
      originalStartDate: iso(daysFrom(-10)),
      newStartDate: iso(daysFrom(-8)),
      originalEndDate: iso(daysFrom(20)),
      newEndDate: iso(daysFrom(22)),
      delayMinutes: 480,
      reason: 'Dependency chain delay',
    },
  ],
  explanation: '2 order(s) rescheduled.',
  updatedCount: 2,
  totalDelayMinutes: 960,
};

const REFLOW_NO_CHANGES = {
  changes: [],
  explanation: 'Schedule is already valid — no changes needed.',
  updatedCount: 0,
  totalDelayMinutes: 0,
};

// ── Mock fetch setup ──────────────────────────────────────────────────────────

type SerializedOrder = {
  docId: string;
  docType: string;
  data: Record<string, unknown>;
};

type MockOptions = {
  orders?: SerializedOrder[];
  reflowResponse?: Record<string, unknown>;
};

/**
 * Patches window.fetch before Angular bootstraps so every API call is
 * intercepted regardless of whether the real backend is running.
 * The in-browser store is fully mutable: POST/PUT/DELETE update it so
 * subsequent GETs reflect the changes, just like the real server would.
 */
async function setupMock(page: Page, opts: MockOptions = {}): Promise<void> {
  const store = {
    workCenters: WORK_CENTERS as SerializedOrder[],
    workOrders: (opts.orders ?? [...BASELINE_ORDERS]) as SerializedOrder[],
    reflow: opts.reflowResponse ?? REFLOW_WITH_CHANGES,
  };

  await page.addInitScript(
    (s: { workCenters: SerializedOrder[]; workOrders: SerializedOrder[]; reflow: unknown }) => {
      const API = 'http://localhost:3000/api';
      const orig = window.fetch.bind(window);

      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        const method = (
          init?.method ?? (input instanceof Request ? input.method : 'GET')
        ).toUpperCase();

        // SSE stream — pass through; Angular handles the EventSource separately
        if (url.includes('/events')) return orig(input, init);

        // GET /api/work-centers
        if (url === `${API}/work-centers`) {
          return new Response(JSON.stringify(s.workCenters), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // GET /api/work-orders
        if (url === `${API}/work-orders` && method === 'GET') {
          return new Response(JSON.stringify(s.workOrders), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // POST /api/work-orders — create
        if (url === `${API}/work-orders` && method === 'POST') {
          const body = init?.body ? JSON.parse(init.body as string) : {};
          const created: SerializedOrder = {
            docId: `wo-e2e-${Date.now()}`,
            docType: 'workOrder',
            data: {
              name: body.name,
              workCenterId: body.workCenterId,
              status: body.status ?? 'open',
              startDate: body.startDate,
              endDate: body.endDate,
            },
          };
          s.workOrders = [...s.workOrders, created];
          return new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // PUT /api/work-orders/:docId — update
        const woMatch = url.match(/\/api\/work-orders\/([^/?]+)$/);
        if (woMatch) {
          const docId = woMatch[1];

          if (method === 'PUT') {
            const body = init?.body ? JSON.parse(init.body as string) : {};
            s.workOrders = s.workOrders.map(wo =>
              wo.docId === docId ? { ...wo, data: { ...wo.data, ...body } } : wo,
            );
            const updated = s.workOrders.find(wo => wo.docId === docId);
            return new Response(JSON.stringify(updated), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          // DELETE /api/work-orders/:docId
          if (method === 'DELETE') {
            s.workOrders = s.workOrders.filter(wo => wo.docId !== docId);
            return new Response(null, { status: 204 });
          }
        }

        // POST /api/reflow
        if (url.includes('/reflow') && method === 'POST') {
          return new Response(JSON.stringify(s.reflow), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return orig(input, init);
      };
    },
    store,
  );

  await page.goto('/');
  await expect(page.getByText('Extrusion Line A')).toBeVisible({ timeout: 10_000 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Locates the timeline row for a given work center name */
const wcRow = (page: Page, name: string) =>
  page.locator(`[aria-label="${name} work center row"]`);

/**
 * Locates the `.bar` div for a given work order name via its aria-label.
 * Using the aria-label (which always starts with the name) is more robust than
 * the `.bar__name` span, which can be visually hidden on narrow sm-sized bars
 * due to the parent's `overflow: hidden`.
 */
const barByName = (page: Page, name: string) =>
  page.locator(`.bar[aria-label^="${name}"]`);

// ── Suite: App renders correctly ─────────────────────────────────────────────

test.describe('App renders correctly', () => {
  test('shows title, all 5 work centers and the today indicator', async ({ page }, testInfo) => {
    await setupMock(page);

    await expect(page.locator('.page-title')).toHaveText('Work Orders');
    for (const wc of WORK_CENTERS) {
      await expect(page.getByText(wc.data.name)).toBeVisible();
    }
    await expect(page.locator('.today-line').first()).toBeAttached();

    await testInfo.attach('initial-load', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('shows all 4 status badges with correct CSS classes', async ({ page }, testInfo) => {
    await setupMock(page);

    await expect(page.locator('.bar--open').first()).toBeAttached();
    await expect(page.locator('.bar--in-progress').first()).toBeAttached();
    await expect(page.locator('.bar--complete').first()).toBeAttached();
    await expect(page.locator('.bar--blocked').first()).toBeAttached();

    // All md bars also show a badge pill
    await expect(page.locator('.badge--open').first()).toBeVisible();
    await expect(page.locator('.badge--in-progress').first()).toBeVisible();
    await expect(page.locator('.badge--complete').first()).toBeVisible();
    await expect(page.locator('.badge--blocked').first()).toBeVisible();

    await testInfo.attach('all-status-badges', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('controls bar has Timescale dropdown, Today button and Run Reflow button', async ({
    page,
  }) => {
    await setupMock(page);

    await expect(page.locator('.zoom-select')).toBeVisible();
    await expect(page.locator('.today-btn')).toBeVisible();
    await expect(page.locator('.reflow-btn')).toBeVisible();
    await expect(page.locator('.reflow-btn')).toHaveText('Run Reflow');
  });
});

// ── Suite: Full lifecycle ─────────────────────────────────────────────────────

test.describe('Full lifecycle — create, edit, reflow, delete', () => {
  test(
    'creates a work order, verifies it, checks tooltip, edits it, runs reflow, then deletes it',
    async ({ page }, testInfo) => {
      // Helper: attach a labelled screenshot to the Playwright HTML report
      const snap = async (label: string) =>
        testInfo.attach(label, {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png',
        });

      // ── Step 1: Load app with baseline orders ───────────────────────────────
      await test.step('load app with baseline orders', async () => {
        await setupMock(page);
        await expect(page.locator('.page-title')).toHaveText('Work Orders');
        await snap('01-initial-state');
      });

      // ── Step 2: Open create panel by clicking Packaging Line row ────────────
      await test.step('click empty row to open create panel', async () => {
        // Packaging Line has no baseline orders — safe to click anywhere
        await wcRow(page, 'Packaging Line').locator('.grid-area').click({
          // x=600 → today+30 days at month zoom (5 px/day, 90 days before today)
          position: { x: 600, y: 28 },
        });

        await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
        await expect(page.locator('.panel__title')).toHaveText('Work Order Details');

        // Start date pre-filled from click position
        await expect(page.locator('#wo-start-dt')).not.toHaveValue('');

        // Status defaults to Open
        await expect(page.locator('ng-select[formcontrolname="status"]')).toContainText('Open');

        await snap('02-create-panel-open');
      });

      // ── Step 3: Fill in name and submit ─────────────────────────────────────
      await test.step('fill name and create the work order', async () => {
        await page.fill('#wo-name', 'E2E Lifecycle Order');

        // Verify submit button says "Create" in create mode
        await expect(page.locator('.btn--primary')).toHaveText('Create');

        await page.locator('.btn--primary').click();
        await expect(page.locator('.panel')).not.toBeVisible({ timeout: 5_000 });
      });

      // ── Step 4: Verify the new bar appears on the timeline ──────────────────
      await test.step('verify new work order bar is visible', async () => {
        // Wait for Angular to update the signal and re-render the bar.
        // Use the aria-label selector (always set, always visible) instead of
        // .bar__name which can be clipped to zero-width on narrow sm bars.
        await expect(barByName(page, 'E2E Lifecycle Order')).toBeVisible({ timeout: 5_000 });

        await snap('03-work-order-created');
      });

      // ── Step 5: Hover over bar to see tooltip ───────────────────────────────
      await test.step('hover bar to verify tooltip content', async () => {
        const newBar = barByName(page, 'E2E Lifecycle Order');
        await newBar.scrollIntoViewIfNeeded();
        await newBar.hover();

        // Tooltip appears after 200 ms — wait for it
        await expect(page.locator('.bar__tooltip')).toBeVisible({ timeout: 2_000 });
        await expect(page.locator('.bar__tooltip-name')).toHaveText('E2E Lifecycle Order');
        // Tooltip shows the date range and status
        await expect(page.locator('.bar__tooltip-meta')).toBeVisible();
        await expect(page.locator('.bar__tooltip-status')).toBeVisible();

        await snap('04-tooltip-visible');

        // Move mouse away to dismiss tooltip
        await page.mouse.move(0, 0);
      });

      // ── Step 6: Edit the work order ─────────────────────────────────────────
      await test.step('open three-dot menu and click Edit', async () => {
        const newBar = barByName(page, 'E2E Lifecycle Order');
        await newBar.scrollIntoViewIfNeeded();

        const menuBtn = newBar.locator('.bar__menu-btn');
        await menuBtn.click({ force: true });

        await expect(page.locator('.bar__dropdown')).toBeVisible({ timeout: 3_000 });
        await expect(page.locator('.dropdown-item').filter({ hasText: 'Edit' })).toBeVisible();
        await expect(
          page.locator('.dropdown-item--danger').filter({ hasText: 'Delete' }),
        ).toBeVisible();

        await snap('05-dropdown-open');

        await page.locator('.dropdown-item').filter({ hasText: 'Edit' }).click();

        await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

        // Panel pre-populated with existing name
        await expect(page.locator('#wo-name')).toHaveValue('E2E Lifecycle Order');

        // Submit button says "Save" in edit mode
        await expect(page.locator('.btn--primary')).toHaveText('Save');

        await snap('06-edit-panel-prepopulated');
      });

      await test.step('change name and save', async () => {
        await page.fill('#wo-name', 'E2E Lifecycle Order (Edited)');
        await page.locator('.btn--primary').click();

        await expect(page.locator('.panel')).not.toBeVisible({ timeout: 5_000 });

        // Bar aria-label updates when the signal refreshes
        await expect(barByName(page, 'E2E Lifecycle Order (Edited)')).toBeVisible({
          timeout: 5_000,
        });

        await snap('07-after-edit');
      });

      // ── Step 7: Run Reflow ───────────────────────────────────────────────────
      await test.step('run reflow and verify result banner', async () => {
        await page.locator('.reflow-btn').click();

        // Banner appears with the rescheduled count and delay
        await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });
        await expect(page.locator('.banner--success')).toContainText(
          'Reflow complete: 2 order(s) rescheduled',
        );
        await expect(page.locator('.banner--success')).toContainText('Total delay: +16h');

        await snap('08-reflow-banner');

        // Dismiss the banner
        await page.locator('.banner__close-btn').click();
        await expect(page.locator('.banner--success')).not.toBeVisible({ timeout: 3_000 });

        await snap('09-banner-dismissed');
      });

      // ── Step 8: Delete the created work order ────────────────────────────────
      await test.step('delete the work order via three-dot menu', async () => {
        const editedBar = barByName(page, 'E2E Lifecycle Order (Edited)');
        await editedBar.scrollIntoViewIfNeeded();

        const menuBtn = editedBar.locator('.bar__menu-btn');
        await menuBtn.click({ force: true });

        await expect(page.locator('.bar__dropdown')).toBeVisible({ timeout: 3_000 });
        await page.locator('.dropdown-item--danger').filter({ hasText: 'Delete' }).click();

        // Bar should be removed from the DOM
        await expect(
          page.locator('.bar__name').filter({ hasText: 'E2E Lifecycle Order (Edited)' }),
        ).not.toBeAttached({ timeout: 5_000 });

        await snap('10-after-delete');
      });

      // ── Step 9: Verify baseline orders still intact ─────────────────────────
      await test.step('verify baseline orders are unaffected', async () => {
        await expect(barByName(page, 'Open Order Alpha')).toBeAttached();
        await expect(barByName(page, 'In-Progress Batch')).toBeAttached();
        await expect(barByName(page, 'Blocked Job')).toBeAttached();

        await snap('11-final-state');
      });
    },
  );
});

// ── Suite: Create panel ───────────────────────────────────────────────────────

test.describe('Create panel', () => {
  test('shows error when name is empty and submit is clicked', async ({ page }) => {
    await setupMock(page);

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    // Clear the name field (it starts empty) and submit without filling it
    await page.locator('.btn--primary').click();

    // Validation error must appear
    await expect(page.locator('.field__error')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.field__error')).toContainText('required');

    // Panel stays open
    await expect(page.locator('.panel')).toBeVisible();
  });

  test('shows end-before-start error when end date precedes start', async ({ page }) => {
    await setupMock(page);

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    // Inject an end-before-start date pair via the Angular component API
    await page.fill('#wo-name', 'Date Order');

    const future = daysFrom(10).toISOString().slice(0, 10);
    const past = daysFrom(5).toISOString().slice(0, 10);

    await page.evaluate(
      ({ start, end }: { start: string; end: string }) => {
        const ng = (window as any).ng;
        if (!ng) return;
        const el = document.querySelector('app-work-order-panel');
        if (!el) return;
        const cmp = ng.getComponent(el);
        if (!cmp?.form) return;
        cmp.form.patchValue({ startDatetime: `${start}T10:00:00`, endDatetime: `${end}T09:00:00` });
        cmp.form.markAllAsTouched();
        ng.applyChanges(cmp);
      },
      { start: future, end: past },
    );

    await page.locator('.btn--primary').click();

    await expect(page.locator('.alert--error')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.alert--error')).toContainText('End must be after start');
    await expect(page.locator('.panel')).toBeVisible();
  });

  test('shows overlap error when dates conflict with an existing order', async ({ page }) => {
    await setupMock(page);

    // Click on Extrusion Line A — has wo-open-1 from today+5 to today+35
    await wcRow(page, 'Extrusion Line A').locator('.grid-area').click({
      position: { x: 400, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    await page.fill('#wo-name', 'Conflicting Order');

    // Inject dates that overlap wo-open-1 (today+5 → today+35)
    const start = iso(daysFrom(10));
    const end = iso(daysFrom(25));

    await page.evaluate(
      ({ s, e }: { s: string; e: string }) => {
        const ng = (window as any).ng;
        if (!ng) return;
        const el = document.querySelector('app-work-order-panel');
        if (!el) return;
        const cmp = ng.getComponent(el);
        if (!cmp?.form) return;
        cmp.form.patchValue({ startDatetime: `${s}T08:00:00`, endDatetime: `${e}T17:00:00` });
        ng.applyChanges(cmp);
      },
      { s: start, e: end },
    );

    await page.locator('.btn--primary').click();

    await expect(page.locator('.alert--error')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.alert--error')).toContainText('Overlaps with');
    await expect(page.locator('.alert--error')).toContainText('Open Order Alpha');
    await expect(page.locator('.panel')).toBeVisible();
  });

  test('cancel button closes panel without saving', async ({ page }) => {
    await setupMock(page, { orders: [] });

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    await page.fill('#wo-name', 'Cancelled Order');

    await page.locator('.btn--ghost').click();

    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.bar__name').filter({ hasText: 'Cancelled Order' })).not.toBeAttached();
  });

  test('backdrop click closes panel', async ({ page }) => {
    await setupMock(page);

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    await page.locator('.panel-backdrop').click();
    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 3_000 });
  });

  test('Escape key closes panel', async ({ page }) => {
    await setupMock(page);

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');

    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 3_000 });
  });

  test('start date input is pre-filled from click position', async ({ page }) => {
    await setupMock(page);

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    const startValue = await page.locator('#wo-start-dt').inputValue();
    expect(startValue.trim().length).toBeGreaterThan(0);
  });

  test('datetime picker popover shows calendar and time selects', async ({ page }) => {
    await setupMock(page);

    await wcRow(page, 'Packaging Line').locator('.grid-area').click({
      position: { x: 600, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    await page.locator('#wo-start-dt').click();

    await expect(page.locator('ngb-datepicker').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.dt-popover__time')).toBeVisible();

    await page.locator('.dt-popover__done').click();
    await expect(page.locator('ngb-datepicker').first()).not.toBeVisible({ timeout: 3_000 });
  });
});

// ── Suite: Edit panel ─────────────────────────────────────────────────────────

test.describe('Edit panel', () => {
  test('opens with work order data pre-populated', async ({ page }) => {
    await setupMock(page);

    const bar = barByName(page, 'Open Order Alpha');
    await bar.scrollIntoViewIfNeeded();
    await bar.locator('.bar__menu-btn').click({ force: true });

    await expect(page.locator('.bar__dropdown')).toBeVisible({ timeout: 3_000 });
    await page.locator('.dropdown-item').filter({ hasText: 'Edit' }).click();

    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#wo-name')).toHaveValue('Open Order Alpha');
    await expect(page.locator('.btn--primary')).toHaveText('Save');
  });

  test('editing the name updates the bar label', async ({ page }) => {
    await setupMock(page);

    const bar = barByName(page, 'Open Order Alpha');
    await bar.scrollIntoViewIfNeeded();
    await bar.locator('.bar__menu-btn').click({ force: true });
    await page.locator('.dropdown-item').filter({ hasText: 'Edit' }).click();

    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    await page.fill('#wo-name', 'Renamed Alpha Order');
    await page.locator('.btn--primary').click();

    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 5_000 });
    await expect(barByName(page, 'Renamed Alpha Order')).toBeVisible({ timeout: 5_000 });
  });
});

// ── Suite: Delete ─────────────────────────────────────────────────────────────

test.describe('Delete work order', () => {
  test('removes the bar from the timeline after Delete', async ({ page }) => {
    await setupMock(page);

    const initialCount = await page.locator('app-work-order-bar').count();
    expect(initialCount).toBeGreaterThan(0);

    const bar = barByName(page, 'Open Order Alpha');
    await bar.scrollIntoViewIfNeeded();
    await bar.locator('.bar__menu-btn').click({ force: true });

    await expect(page.locator('.bar__dropdown')).toBeVisible({ timeout: 3_000 });
    await page.locator('.dropdown-item--danger').filter({ hasText: 'Delete' }).click();

    await expect(page.locator('app-work-order-bar')).toHaveCount(initialCount - 1, {
      timeout: 5_000,
    });
    await expect(barByName(page, 'Open Order Alpha')).not.toBeAttached({ timeout: 3_000 });
  });
});

// ── Suite: Bar tooltip ────────────────────────────────────────────────────────

test.describe('Bar tooltip on hover', () => {
  test('shows tooltip with name, date range and status after 200 ms hover', async ({
    page,
  }, testInfo) => {
    await setupMock(page);

    const bar = barByName(page, 'In-Progress Batch');
    await bar.scrollIntoViewIfNeeded();
    await bar.hover();

    await expect(page.locator('.bar__tooltip')).toBeVisible({ timeout: 2_000 });
    await expect(page.locator('.bar__tooltip-name')).toHaveText('In-Progress Batch');
    await expect(page.locator('.bar__tooltip-meta')).toContainText('→');
    await expect(page.locator('.bar__tooltip-status')).toBeVisible();

    await testInfo.attach('bar-tooltip', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });
});

// ── Suite: Row hover highlight ────────────────────────────────────────────────

test.describe('Row hover highlight', () => {
  test('adds hovered CSS class when mouse enters a row', async ({ page }) => {
    await setupMock(page);

    const row = wcRow(page, 'Extrusion Line A');
    await row.hover();
    await expect(row).toHaveClass(/timeline-row--hovered/);
  });

  test('removes hovered class when mouse leaves', async ({ page }) => {
    await setupMock(page);

    const row = wcRow(page, 'Extrusion Line A');
    await row.hover();
    await expect(row).toHaveClass(/timeline-row--hovered/);

    await page.mouse.move(0, 0);
    await expect(row).not.toHaveClass(/timeline-row--hovered/, { timeout: 2_000 });
  });
});

// ── Suite: Timescale zoom ─────────────────────────────────────────────────────

test.describe('Timescale zoom', () => {
  const switchTo = async (page: Page, label: string) => {
    await page.locator('.zoom-select').click();
    await page.locator('.ng-option').filter({ hasText: label }).click();
    await expect(page.locator('.zoom-select')).toContainText(label);
  };

  test('switches to Day zoom', async ({ page }, testInfo) => {
    await setupMock(page);
    await switchTo(page, 'Day');
    await testInfo.attach('zoom-day', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('switches to Week zoom', async ({ page }, testInfo) => {
    await setupMock(page);
    await switchTo(page, 'Week');
    await testInfo.attach('zoom-week', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('switches to Hour zoom', async ({ page }, testInfo) => {
    await setupMock(page);
    await switchTo(page, 'Hour');
    await testInfo.attach('zoom-hour', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('returns to Month zoom', async ({ page }, testInfo) => {
    await setupMock(page);
    await switchTo(page, 'Day');
    await switchTo(page, 'Month');
    await testInfo.attach('zoom-month', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });
});

// ── Suite: Today navigation ───────────────────────────────────────────────────

test.describe('Today button navigation', () => {
  test('scrolls viewport so the today indicator is visible', async ({ page }) => {
    await setupMock(page);

    // Scroll far from today to create a visible offset
    const scrollContainer = page.locator('.timeline-scroll');
    await scrollContainer.evaluate(el => {
      el.scrollLeft = el.scrollWidth;
    });

    await page.locator('.today-btn').click();

    // Today line should now be visible in the viewport
    await expect(page.locator('.today-line').first()).toBeInViewport({ timeout: 3_000 });
  });
});

// ── Suite: Reflow outcomes ────────────────────────────────────────────────────

test.describe('Run Reflow', () => {
  test('shows a success banner with rescheduled count and delay when orders change', async ({
    page,
  }, testInfo) => {
    await setupMock(page, { reflowResponse: REFLOW_WITH_CHANGES });

    await page.locator('.reflow-btn').click();
    await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.banner--success')).toContainText(
      'Reflow complete: 2 order(s) rescheduled',
    );
    await expect(page.locator('.banner--success')).toContainText('Total delay: +16h');

    await testInfo.attach('reflow-with-changes', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('shows "already valid" banner when no changes are needed', async ({ page }, testInfo) => {
    await setupMock(page, { reflowResponse: REFLOW_NO_CHANGES });

    await page.locator('.reflow-btn').click();
    await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.banner--success')).toContainText('already valid');

    await testInfo.attach('reflow-no-changes', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  });

  test('banner can be dismissed with the × button', async ({ page }) => {
    await setupMock(page, { reflowResponse: REFLOW_NO_CHANGES });

    await page.locator('.reflow-btn').click();
    await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });

    await page.locator('.banner__close-btn').click();
    await expect(page.locator('.banner--success')).not.toBeVisible({ timeout: 3_000 });
  });

  test('Run Reflow button shows loading state while request is in-flight', async ({ page }) => {
    // Load the page first with the standard mock, then override reflow to be slow
    // via page.evaluate() (post-load). addInitScript would be overwritten by
    // setupMock's own addInitScript, so we must inject the delay after load.
    await setupMock(page);

    await page.evaluate(() => {
      const orig = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        const method = (
          (init as RequestInit | undefined)?.method ??
          (input instanceof Request ? input.method : 'GET')
        ).toUpperCase();
        if (url.includes('/reflow') && method === 'POST') {
          // Hold for 1 s so we can assert the in-flight loading text
          await new Promise(r => setTimeout(r, 1_000));
          return new Response(
            JSON.stringify({ changes: [], explanation: 'No changes.', updatedCount: 0, totalDelayMinutes: 0 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return orig(input, init);
      };
    });

    await page.locator('.reflow-btn').click();

    // Signal fires synchronously before fetch; Angular change detection updates the button text
    await expect(page.locator('.reflow-btn')).toHaveText('Reflowing…', { timeout: 2_000 });
    // After the 1 s delay the button reverts
    await expect(page.locator('.reflow-btn')).toHaveText('Run Reflow', { timeout: 5_000 });
  });
});

// ── Suite: Infinite scroll ────────────────────────────────────────────────────

test.describe('Infinite scroll', () => {
  test('appends columns when scrolled to the right edge', async ({ page }) => {
    await setupMock(page);

    const sc = page.locator('.timeline-scroll');
    const before = await sc.evaluate(el => el.scrollWidth);

    await sc.evaluate(el => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });

    await page.waitForFunction(
      ({ sel, initial }: { sel: string; initial: number }) => {
        const el = document.querySelector(sel);
        return !!el && el.scrollWidth > initial;
      },
      { sel: '.timeline-scroll', initial: before },
      { timeout: 3_000 },
    );

    const after = await sc.evaluate(el => el.scrollWidth);
    expect(after).toBeGreaterThan(before);
  });

  test('prepends columns when scrolled to the left edge', async ({ page }) => {
    await setupMock(page);

    const sc = page.locator('.timeline-scroll');
    // Move away from the left edge first
    await sc.evaluate(el => {
      el.scrollLeft = 2_000;
    });

    const before = await sc.evaluate(el => el.scrollWidth);

    // Trigger prepend by reaching the left edge
    await sc.evaluate(el => {
      el.scrollLeft = 0;
    });

    await page.waitForFunction(
      ({ sel, initial }: { sel: string; initial: number }) => {
        const el = document.querySelector(sel);
        return !!el && el.scrollWidth > initial;
      },
      { sel: '.timeline-scroll', initial: before },
      { timeout: 3_000 },
    );

    const after = await sc.evaluate(el => el.scrollWidth);
    expect(after).toBeGreaterThan(before);
  });
});
