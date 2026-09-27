import { test, expect } from '@playwright/test';

test('B catalog separates sensor selection from visual guided tests', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?variant=c');

  await expect(page.getByRole('heading', { name: 'Choose a sensor' })).toBeVisible();
  await expect(page.getByTestId('variant-switcher')).toHaveCount(0);
  const catalog = page.getByRole('navigation', { name: 'Sensor features' });
  await expect(catalog).toHaveClass(/catalog-b/);
  await expect(catalog.locator('button')).toHaveCount(6);

  const sensors: Array<[string, string]> = [
    ['Motion', 'motion'],
    ['Orientation', 'orientation'],
    ['Location', 'location'],
    ['Touch', 'pointer'],
    ['Viewport', 'viewport'],
    ['Visibility', 'visibility'],
  ];

  for (const [name, visual] of sensors) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('heading', { name: `Test ${name}` })).toBeVisible();
    await expect(page.getByTestId('sensor-visual')).toHaveAttribute('data-visual', visual);
    await expect(page.getByText('Start the test and follow the instruction.')).toBeVisible();
    await page.getByRole('button', { name: 'All sensors' }).click();
  }
});

test('demo motion produces a visual response, success light, haptic option, and shake event', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const testWindow = window as Window & { vibrateCalls?: number };
    testWindow.vibrateCalls = 0;
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => { testWindow.vibrateCalls! += 1; return true; } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('button', { name: /Motion/ }).click();

  await expect(page.getByRole('heading', { name: 'Test Motion' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Haptic feedback' }).check();
  await expect(page.getByRole('checkbox', { name: 'Haptic feedback' })).toBeChecked();
  expect(await page.evaluate(() => (window as Window & { vibrateCalls?: number }).vibrateCalls)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Start test' }).click();

  await expect(page.getByText('CHECK PASSED')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('.status-light.green')).toBeVisible();
  await expect(page.locator('[data-visual="motion"] .motion-trail')).toBeVisible();
  await expect(page.getByText('Shake', { exact: true }).last()).toBeVisible({ timeout: 8000 });
});

test('sensor catalog and detail view fit a phone screen without vertical page scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 626 });
  await page.goto('/');
  const phone = page.getByTestId('device-frame');
  await expect(phone).toBeVisible();

  for (const screen of ['catalog', 'test']) {
    if (screen === 'test') await page.getByRole('button', { name: /Orientation/ }).click();
    expect(await phone.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)).toBe(true);
  }
});
