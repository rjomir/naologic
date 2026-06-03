import { test, expect, type Page } from '@playwright/test';

const WC1 = { docId: 'wc-1', docType: 'workCenter', data: { name: 'Extrusion Line A' } };
const WC2 = { docId: 'wc-2', docType: 'workCenter', data: { name: 'CNC Machine 1' } };

const WO1 = {
  docId: 'wo-1',
  docType: 'workOrder',
  data: {
    name: 'Pipe Batch #A1',
    workCenterId: 'wc-1',
    status: 'in-progress',
    startDate: new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
  },
};

async function setupWithApiError(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const API = 'http://localhost:3000/api';
    window.fetch = async (input, _init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.startsWith(API)) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 500 });
    };
  });
  await page.goto('/');
}

async function setupWithWorkOrders(page: Page): Promise<void> {
  const state = { workOrders: [WO1] as object[] };

  await page.addInitScript((s: { workOrders: object[] }) => {
    const API = 'http://localhost:3000/api';
    const orig = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();

      if (url === `${API}/work-centers`) {
        return new Response(
          JSON.stringify([
            { docId: 'wc-1', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
            { docId: 'wc-2', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === `${API}/work-orders` && method === 'GET') {
        return new Response(JSON.stringify(s.workOrders), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === `${API}/reflow` && method === 'POST') {
        return new Response(
          JSON.stringify({ changes: [], explanation: 'Already optimal.', updatedCount: 0 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return orig(input, init);
    };
  }, state);

  await page.goto('/');
  await expect(page.getByText('Extrusion Line A')).toBeVisible({ timeout: 10_000 });
}

async function setupWithReflowError(page: Page): Promise<void> {
  const state = { workOrders: [WO1] as object[] };

  await page.addInitScript((s: { workOrders: object[] }) => {
    const API = 'http://localhost:3000/api';
    const orig = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();

      if (url === `${API}/work-centers`) {
        return new Response(
          JSON.stringify([
            { docId: 'wc-1', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url === `${API}/work-orders` && method === 'GET') {
        return new Response(JSON.stringify(s.workOrders), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === `${API}/reflow` && method === 'POST') {
        return new Response(JSON.stringify({ error: 'Circular dependency detected' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return orig(input, init);
    };
  }, state);

  await page.goto('/');
  await expect(page.getByText('Extrusion Line A')).toBeVisible({ timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Error states', () => {
  test('shows error banner when the API is unreachable on load', async ({ page }) => {
    await setupWithApiError(page);
    await expect(page.locator('.banner--error')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.banner--error')).toContainText('backend API');
  });

  test('no error banner when API loads successfully', async ({ page }) => {
    await setupWithWorkOrders(page);
    await expect(page.locator('.banner--error')).not.toBeVisible();
  });
});

test.describe('Reflow', () => {
  test('shows success banner when reflow runs with no changes needed', async ({ page }) => {
    await setupWithWorkOrders(page);
    await page.locator('.reflow-btn').click();
    await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.banner--success')).toContainText('already valid');
  });

  test('shows error banner when reflow API call fails', async ({ page }) => {
    await setupWithReflowError(page);
    await page.locator('.reflow-btn').click();
    // The timeline component sets reflowResult to the failure message
    await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.banner--success')).toContainText('failed');
  });

  test('success banner can be dismissed', async ({ page }) => {
    await setupWithWorkOrders(page);
    await page.locator('.reflow-btn').click();
    await expect(page.locator('.banner--success')).toBeVisible({ timeout: 8_000 });
    await page.locator('.banner__close-btn').click();
    await expect(page.locator('.banner--success')).not.toBeVisible({ timeout: 3_000 });
  });
});
