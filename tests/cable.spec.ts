import { test, expect } from '@playwright/test';
import { tabletApp } from './navigation';
import { walk } from './case-navigation';
test.use({ actionTimeout: 15000, viewport: { width: 844, height: 650 } });
test('carry a bounded cable around the corridor, save/drop/resume, terminate and test the line', async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Game error:', e.message); });
    await page.addInitScript(() => localStorage.setItem('netcity-quality', 'low'));
    await page.goto('/');
    await expect(page.locator('.connection-status')).toContainText('В сети');
    await expect(page.locator('.asset-status')).toHaveAttribute('data-state', 'ready', { timeout: 45000 });
    const move = async (axis: 'x' | 'z', goal: number) => { await page.bringToFront(); await page.locator('canvas').click({ position: { x: 450, y: 350 } }); await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true); await walk(page, axis, goal); };
    const action = async (label: string) => { await tabletApp(page, 'Инструменты'); await page.getByRole('button', { name: label, exact: true }).click(); await expect(page.getByText('Ожидание подтверждения…', { exact: false })).toHaveCount(0); };
    await move('z', 0);
    await move('x', 11);
    await move('z', 4.5);
    await action('Взять бухту');
    await expect(page.locator('.cable-panel')).toContainText('бухта в руках');
    await page.keyboard.press('Escape');
    await move('z', 0);
    await action('Закрепить кабель здесь');
    await page.keyboard.press('Escape');
    await move('x', 16.5);
    await action('Закрепить кабель здесь');
    await expect.poll(() => page.evaluate(async () => { const path = '/src/world.ts', { EngineStore } = await import(/* @vite-ignore */ path); return EngineStore.LastCreatedScene.meshes.filter((m: any) => m.name.startsWith('physical-cable-')).length; })).toBe(1);
    await action('Положить бухту');
    await expect(page.locator('.cable-panel')).toContainText('бухта на месте');
    await page.reload();
    await expect(page.locator('.connection-status')).toContainText('В сети');
    await action('Поднять бухту');
    await expect(page.locator('.cable-panel')).toContainText('Подойдите');
    await page.keyboard.press('Escape');
    await move('z', 0);
    await move('x', 16.5);
    await action('Поднять бухту');
    await expect(page.locator('.cable-panel')).toContainText('бухта в руках');
    await action('Установить коннектор');
    await action('Проверить учебный линк');
    await expect(page.locator('.cable-panel')).toContainText('Учебная линия сохранена');
    await expect(page.locator('.profile-summary')).toContainText('0 NET');
    await expect(page.locator('.profile-summary')).toContainText('0 XP');
    expect(errors).toEqual([]);
});
test('portrait cable tools fit and require approaching the real spool', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
        const page = await context.newPage();
        await page.goto('/');
        await expect(page.locator('.connection-status')).toContainText('В сети');
        await tabletApp(page, 'Инструменты');
        await page.getByRole('button', { name: 'Взять бухту', exact: true }).tap();
        await expect(page.locator('.cable-panel')).toContainText('Подойдите');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole('button', { name: 'Закрыть планшет' }).tap();
        await expect(page.getByLabel('Джойстик движения')).toBeVisible();
    }
    finally {
        await context.close();
    }
});
