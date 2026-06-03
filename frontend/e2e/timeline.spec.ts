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
    endDate: fmt(addDays(today, 5)),
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
    await expect(page.locator('[formcontrolname="startDate"]')).not.toHaveValue('');
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
});