import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidence = process.env.QA_EVIDENCE_DIR || path.join(process.cwd(), 'qa/evidence/fresh');

test('QA-B01 public critical pages: axe AA subset and 320px reflow', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 740 });
  const findings = [];
  for (const route of ['/', '/shop', '/products/the-petal-bralette', '/cart', '/account', '/checkout', '/contact']) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await page.locator('main').waitFor();
    await page.waitForTimeout(600);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const violations = result.violations.map(v => ({
      id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })),
    }));
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    findings.push({ route, violations, dimensions });
  }
  await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, `axe-${info.project.name}.json`), JSON.stringify(findings, null, 2));
  expect(findings.flatMap(f => f.violations.filter(v => ['critical', 'serious'].includes(v.impact || '')).map(v => ({ route: f.route, ...v })))).toEqual([]);
  expect(findings.filter(f => f.dimensions.scrollWidth > f.dimensions.width)).toEqual([]);
});

test('QA-B02 saved homepage CMS fields appear in rendered page', async ({ page }, info) => {
  const access = JSON.parse(await readFile(process.env.TEST_OWNER_ACCESS_FILE!, 'utf8'));
  const auth = await page.request.post('/api/auth', { data: { action: 'login', email: access.email, password: access.password } });
  expect(auth.ok()).toBe(true);
  const original = await (await page.request.get('/api/home')).json();
  const tokens = { eyebrow: 'QA-EYEBROW-PROPAGATION', description: 'QA-DESCRIPTION-PROPAGATION', story: 'QA-STORY-PROPAGATION', storyBody: 'QA-STORYBODY-PROPAGATION' };
  try {
    expect((await page.request.post('/api/admin/cms', { data: { ...original, ...tokens } })).ok()).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('main')).toContainText(tokens.storyBody);
    const body = await page.locator('main').innerText();
    const actual = Object.fromEntries(Object.entries(tokens).map(([key, value]) => [key, body.includes(value)]));
    await mkdir(evidence, { recursive: true });
    await writeFile(path.join(evidence, `cms-${info.project.name}.json`), JSON.stringify(actual, null, 2));
    expect(actual).toEqual({ eyebrow: true, description: true, story: true, storyBody: true });
  } finally {
    expect((await page.request.post('/api/admin/cms', { data: original })).ok()).toBe(true);
  }
});

test('QA-B03 reduced-motion and unavailable WebGL preserve shopping content', async ({ browser }, info) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: info.project.name === 'mobile' ? { width: 320, height: 740 } : { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type.includes('webgl')) return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  const page = await context.newPage();
  try {
    await page.goto(process.env.TEST_BASE_URL!);
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('.silk-experience').scrollIntoViewIfNeeded();
    await expect(page.locator('.silk-fallback')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.locator('a[href="/shop"]').count()).toBeGreaterThan(0);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, `fallback-${info.project.name}.png`), fullPage: true });
  } finally { await context.close(); }
});
