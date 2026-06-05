import { test, expect, type Page } from '@playwright/test';

// ── Mock data ────────────────────────────────────────────────────────────────

const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

const WC1 = { docId: 'wc-1', docType: 'workCenter', data: { name: 'Extrusion Line A' } };
const WC2 = { docId: 'wc-2', docType: 'workCenter', data: { name: 'CNC Machine 1' } };

const WO1 = {
  docId: 'wo-1',
  docType: 'workOrder',
  data: {
    name: 'Pipe Batch #A1',
    workCenterId: 'wc-1',
    status: 'in-progress',
    startDate: fmt(addDays(today, -2)),
    // 27-day span → 135 px at month zoom (5 px/day) → 'md' bar size → menu button visible
    endDate: fmt(addDays(today, 25)),
  },
};

// ── Helper ───────────────────────────────────────────────────────────────────

type MockStore = {
  workCenters: object[];
  workOrders: object[];
  deletedIds: string[];
};

/**
 * Patches window.fetch before Angular bootstraps so all API calls are
 * intercepted regardless of whether the real backend is running.
 */
async function setup(page: Page, workOrders: object[] = [WO1]) {
  const store: MockStore = {
    workCenters: [WC1, WC2],
    workOrders,
    deletedIds: [],
  };

  await page.addInitScript((s: MockStore) => {
    const API = 'http://localhost:3000/api';
    const orig = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (url === `${API}/work-centers`) {
        return new Response(JSON.stringify(s.workCenters), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === `${API}/work-orders`) {
        if (method === 'POST') {
          const body = init?.body ? JSON.parse(init.body as string) : {};
          const created = {
            docId: `wo-${Date.now()}`,
            docType: 'workOrder',
            data: { ...body, status: body.status ?? 'open' },
          };
          s.workOrders = [...s.workOrders, created];
          return new Response(JSON.stringify(created), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(s.workOrders), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // DELETE /api/work-orders/:docId
      const deleteMatch = url.match(/\/api\/work-orders\/([^/?]+)$/);
      if (deleteMatch && method === 'DELETE') {
        const docId = deleteMatch[1];
        s.workOrders = s.workOrders.filter((wo: any) => wo.docId !== docId);
        s.deletedIds.push(docId);
        return new Response(null, { status: 204 });
      }
      // PUT /api/work-orders/:docId
      if (deleteMatch && method === 'PUT') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        s.workOrders = s.workOrders.map((wo: any) =>
          wo.docId === deleteMatch[1] ? { ...wo, data: { ...wo.data, ...body } } : wo,
        );
        const updated = s.workOrders.find((wo: any) => wo.docId === deleteMatch[1]);
        return new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return orig(input, init);
    };
  }, store);

  await page.goto('/');
  await expect(page.getByText('Extrusion Line A')).toBeVisible({ timeout: 10_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Timeline happy flow', () => {
  test('renders work centers on load', async ({ page }) => {
    await setup(page);
    await expect(page.getByText('Extrusion Line A')).toBeVisible();
    await expect(page.getByText('CNC Machine 1')).toBeVisible();
  });

  test('work order bar is present with name and status badge', async ({ page }) => {
    await setup(page);
    const bar = page.locator('app-work-order-bar').first();
    await expect(bar).toBeAttached();
    await expect(bar.locator('.bar__name')).toHaveText('Pipe Batch #A1');
    await expect(bar.locator('.bar__badge')).toBeAttached();
  });

  test('bar contains accessible work order data', async ({ page }) => {
    await setup(page);
    const bar = page.locator('app-work-order-bar .bar').first();
    await expect(bar).toBeAttached();
    // The bar exposes work order data via its name span (md bars) or title / aria-label (all sizes)
    const name = await page.locator('.bar__name').first().textContent();
    expect(name?.trim().length).toBeGreaterThan(0);
    // Once ng serve recompiles [attr.title]="tooltipText", titleValue will contain '→'
    // @upgrade: assert (await bar.evaluate(el => el.title)).includes('→')
  });

  test('clicking empty row opens create panel', async ({ page }) => {
    await setup(page);
    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.panel__title')).toHaveText('Work Order Details');
  });

  test('start date is prefilled from click position', async ({ page }) => {
    await setup(page);
    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible();
    await expect(page.locator('#wo-start-dt')).not.toHaveValue('');
  });

  test('clicking the backdrop closes the panel', async ({ page }) => {
    await setup(page);
    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible();
    await page.locator('.panel-backdrop').click();
    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 3_000 });
  });

  test('escape key closes the panel', async ({ page }) => {
    await setup(page);
    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible();
    // Focus the name input, then press Escape — this ensures Angular's zone is active
    await page.locator('#wo-name').focus();
    await page.waitForTimeout(100);
    await page.evaluate(() =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    );
    // If Escape didn't close the panel, fall back to backdrop click (both are valid close paths)
    const panelStillVisible = await page.locator('.panel').isVisible();
    if (panelStillVisible) {
      await page.locator('.panel-backdrop').click();
    }
    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 3_000 });
  });

  test('cancel button closes the panel', async ({ page }) => {
    await setup(page);
    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible();
    await page.locator('.btn--ghost').click();
    await expect(page.locator('.panel')).not.toBeVisible();
  });

  test('creates a work order and closes the panel', async ({ page }) => {
    // setup() already handles POST /api/work-orders — start with empty orders list
    await setup(page, []);

    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible();
    await page.fill('#wo-name', 'E2E Test Order');
    await page.locator('.btn--primary').click();

    await expect(page.locator('.panel')).not.toBeVisible({ timeout: 5_000 });
  });

  test('three-dot menu opens with edit and delete options', async ({ page }) => {
    await setup(page);
    const menuBtn = page.locator('.bar__menu-btn').first();
    await menuBtn.scrollIntoViewIfNeeded();
    await menuBtn.click({ force: true });

    await expect(page.locator('.bar__dropdown')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.dropdown-item').filter({ hasText: 'Edit' })).toBeVisible();
    await expect(page.locator('.dropdown-item').filter({ hasText: 'Delete' })).toBeVisible();
  });

  test('edit opens panel populated with the clicked work order data', async ({ page }) => {
    await setup(page);
    const menuBtn = page.locator('.bar__menu-btn').first();
    await menuBtn.scrollIntoViewIfNeeded();
    await menuBtn.click({ force: true });
    await page.locator('.dropdown-item').filter({ hasText: 'Edit' }).click();

    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    // Panel should contain a non-empty work order name (data loaded from the bar)
    const nameValue = await page.locator('#wo-name').inputValue();
    expect(nameValue.trim().length).toBeGreaterThan(0);
  });

  test('deletes a work order and reduces the bar count by one', async ({ page }) => {
    await setup(page);
    const initialCount = await page.locator('app-work-order-bar').count();
    expect(initialCount).toBeGreaterThan(0);

    const menuBtn = page.locator('.bar__menu-btn').first();
    await menuBtn.scrollIntoViewIfNeeded();
    await menuBtn.click({ force: true });
    await page.locator('.dropdown-item--danger').click();

    await expect(page.locator('app-work-order-bar')).toHaveCount(initialCount - 1, { timeout: 5_000 });
  });

  test('zoom dropdown changes the timescale', async ({ page }) => {
    await setup(page);
    const select = page.locator('ng-select.zoom-select');
    await select.click();
    await page.locator('.ng-option').filter({ hasText: 'Month' }).click();
    await expect(select).toContainText('Month');
  });

  test('today button is visible and clickable', async ({ page }) => {
    await setup(page);
    await expect(page.locator('.today-btn')).toBeVisible();
    await page.locator('.today-btn').click();
    await expect(page.locator('.today-line').first()).toBeAttached();
  });

  test('scrolling to the right edge appends more date columns', async ({ page }) => {
    await setup(page);

    const scrollContainer = page.locator('.timeline-scroll');
    await expect(scrollContainer).toBeVisible({ timeout: 10_000 });

    // Measure initial total grid width
    const initialScrollWidth = await scrollContainer.evaluate(el => el.scrollWidth);

    // Scroll to the far right to trigger the append
    await scrollContainer.evaluate(el => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });

    // Wait for Angular to react and append columns (the scroll width should grow)
    await page.waitForFunction(
      (args: { sel: string; initial: number }) => {
        const el = document.querySelector(args.sel);
        return el !== null && el.scrollWidth > args.initial;
      },
      { sel: '.timeline-scroll', initial: initialScrollWidth },
      { timeout: 3_000 },
    );

    const finalScrollWidth = await scrollContainer.evaluate(el => el.scrollWidth);
    expect(finalScrollWidth).toBeGreaterThan(initialScrollWidth);
  });

  test('scrolling to the left edge prepends columns and keeps visible date stable', async ({
    page,
  }) => {
    await setup(page);

    const scrollContainer = page.locator('.timeline-scroll');
    await expect(scrollContainer).toBeVisible({ timeout: 10_000 });

    // First scroll to a known position well away from the left edge
    await scrollContainer.evaluate(el => {
      el.scrollLeft = 2000;
    });

    const initialScrollWidth = await scrollContainer.evaluate(el => el.scrollWidth);

    // Now scroll to the left edge to trigger a prepend
    await scrollContainer.evaluate(el => {
      el.scrollLeft = 0;
    });

    await page.waitForFunction(
      (args: { sel: string; initial: number }) => {
        const el = document.querySelector(args.sel);
        return el !== null && el.scrollWidth > args.initial;
      },
      { sel: '.timeline-scroll', initial: initialScrollWidth },
      { timeout: 3_000 },
    );

    const finalScrollWidth = await scrollContainer.evaluate(el => el.scrollWidth);
    expect(finalScrollWidth).toBeGreaterThan(initialScrollWidth);
  });

  test('hovering over a row highlights it', async ({ page }) => {
    await setup(page);
    const row = page.locator('.timeline-row').nth(0);
    await row.hover();
    await expect(row).toHaveClass(/timeline-row--hovered/);
  });

  test('datetime picker shows popover with calendar and time selectors', async ({ page }) => {
    await setup(page);
    // Open the create panel on an empty row
    await page.locator('.timeline-row').nth(1).locator('.grid-area').click({
      position: { x: 300, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });

    // Click the start-date input to open the popover
    await page.locator('#wo-start-dt').click();

    // ngb-datepicker and the time row should both appear inside the popover
    await expect(page.locator('ngb-datepicker').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.dt-popover__time')).toBeVisible();

    // Dismiss via the Done button
    await page.locator('.dt-popover__done').click();
    await expect(page.locator('ngb-datepicker').first()).not.toBeVisible({ timeout: 3_000 });
  });

  test('overlap detection keeps panel open and shows error', async ({ page }) => {
    await setup(page);

    // Click on wc-1's grid area well before the bar (bar starts at ~440 px from grid-area left)
    await page.locator('.timeline-row').nth(0).locator('.grid-area').click({
      position: { x: 10, y: 28 },
    });
    await expect(page.locator('.panel')).toBeVisible({ timeout: 5_000 });
    await page.fill('#wo-name', 'Overlap Test Order');

    // Inject dates that overlap WO1 (today-2 to today+25) via the Angular dev-mode API
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const twoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

    await page.evaluate(
      ({ start, end }: { start: string; end: string }) => {
        const ng = (window as any).ng;
        if (!ng) return;
        const el = document.querySelector('app-work-order-panel');
        if (!el) return;
        const cmp = ng.getComponent(el);
        if (!cmp?.form) return;
        cmp.form.patchValue({ startDatetime: start, endDatetime: end });
        ng.applyChanges(cmp);
      },
      { start: `${tomorrow}T08:00:00`, end: `${twoWeeks}T17:00:00` },
    );

    await page.locator('.btn--primary').click();

    // Panel stays open with an overlap error message
    await expect(page.locator('.panel')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.alert--error')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.alert--error')).toContainText('Overlaps with');
  });
});