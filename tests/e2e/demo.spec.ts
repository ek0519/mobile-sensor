import { test, expect } from '@playwright/test';

test('selecting a sensor opens its test instruction and details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Choose a sensor' })).toBeVisible();
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Location', exact: true })).toBeVisible();
  await expect(page.getByText('Request your current position')).toBeVisible();
  await expect(page.getByText('Allow location access. Location requires HTTPS.')).toBeVisible();
});

test('simulated motion turns the pass light green and reports detector events', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('button', { name: 'Allow & start test' }).click();

  await expect(page.getByText('CHECK PASSED')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('.status-light.green')).toBeVisible();
  await expect(page.locator('.event-list').getByText('Shake', { exact: true })).toBeVisible({ timeout: 8000 });

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.app-status strong')).toHaveText('PAUSED');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'CLEAR' }).click();
  await expect(page.getByText('Demo signals will trigger sample events.')).toBeVisible();
});

test('simulated location is opt-in and shows a successful reading after selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Allow & start test' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow & start test' }).click();

  await expect(page.getByText('CHECK PASSED')).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('25.03300, 121.56540')).toBeVisible();
  await expect(page.locator('.status-light.green')).toBeVisible();
});

test('keeps the mobile test flow inside the centered phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const phone = page.getByTestId('device-frame');
  await expect(phone).toBeVisible();
  const desktopBox = await phone.boundingBox();
  expect(desktopBox?.width).toBe(430);
  expect(desktopBox?.height).toBe(900);
  expect(Math.abs((desktopBox!.x + desktopBox!.width / 2) - 720)).toBeLessThanOrEqual(1);
  expect(Math.abs((desktopBox!.y + desktopBox!.height / 2) - 500)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: 'Choose a sensor' })).toBeVisible();
  expect(await phone.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBox = await phone.boundingBox();
  expect(mobileBox?.width).toBe(390);
  expect(mobileBox?.height).toBe(844);
  expect(await phone.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.sensor-picker').evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
});
