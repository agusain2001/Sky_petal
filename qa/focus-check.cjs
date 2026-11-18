const { chromium, expect } = require('@playwright/test');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const base = process.env.TEST_BASE_URL;
  if (!base || new URL(base).hostname !== '127.0.0.1') throw Error('Loopback QA only');
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/shop');
    const trigger = page.getByRole('button', { name: 'Search products', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const result = { id: 'QA-FOCUS-01', requirements: ['F09', 'Q19'], status: 'PASS', expected: 'Keyboard open/close returns focus to Search products trigger', actual: null };
    try { await expect(trigger).toBeFocused({ timeout: 3000 }); }
    catch (e) { result.status = 'FAIL'; result.actual = e.message; process.exitCode = 1; }
    result.focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, label: document.activeElement.getAttribute('aria-label') }));
    await writeFile(path.join(process.env.QA_EVIDENCE_DIR, 'focus-check.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
