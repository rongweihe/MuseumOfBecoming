import { test, expect, type Page } from '@playwright/test';
import { demoMuseum } from '../../src/demo';

async function createMuseum(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '建立我的展馆', exact: true }).click();
  await page.getByLabel('馆主名', { exact: true }).fill('验收馆主');
  await page.getByRole('dialog').getByRole('button', { name: '建立我的展馆', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('已收藏 0 个瞬间')).toBeVisible();
}
async function startForm(page: Page) {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: '收藏一个瞬间', exact: true })
    .click();
  await expect(page.getByLabel('我想怎样记住这件事？')).toBeVisible();
}
async function fillMoment(page: Page, title = '把一个小想法做了出来') {
  await page.getByLabel('我想怎样记住这件事？').fill(title);
  await page.getByLabel('发生在什么时候？').fill('2026-09-21');
  await page
    .getByLabel('我做成了什么，或迈出了哪一步？')
    .fill('一个可以打开的原型。仍然有待改进，但我终于迈出了这一步。');
  await page.getByLabel('用一句话记住它的意义').fill('开始可以很小，但它真实地发生了。');
}
async function readRecords(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('museum-of-becoming', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('records', 'readonly');
    return new Promise<any>((resolve) => {
      const r = tx.objectStore('records').get('museum');
      r.onsuccess = () => resolve(r.result);
    });
  });
}

test('桌面首页、详情、手机首页和揭幕截图；收藏后刷新与模式隔离', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('以下故事为虚构示例')).toBeVisible();
  await expect(page.getByText('已收藏 6 个瞬间')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/01-desktop-museum.png', fullPage: true });
  await page
    .getByRole('button', { name: /我让一座桥稳了下来/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: '我让一座桥稳了下来', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/02-desktop-exhibit.png', fullPage: true });
  await page.getByRole('button', { name: '〈 返回展厅', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.locator('.collection-grid .exhibit-card')).toHaveCount(6);
  await page.locator('h1').focus();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'docs/screenshots/03-mobile-museum.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await createMuseum(page);
  await startForm(page);
  await fillMoment(page);
  await page.getByLabel('日期精度').selectOption('month');
  await page.getByLabel('发生在什么时候？').fill('2026-09');
  await page.getByLabel('放在展厅入口的精选展台').check();
  await page.getByRole('button', { name: '补充这个故事' }).click();
  await page.getByLabel('给那时的自己').fill('你开始了，这就值得被记住。');
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('这一刻，值得留下。')).toBeVisible();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshots/04-new-exhibit-unveiling.png', fullPage: true });
  await page.getByRole('button', { name: '走近看看', exact: true }).click();
  await expect(page.getByRole('heading', { name: '把一个小想法做了出来', level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByText('你开始了，这就值得被记住。')).toBeVisible();
  await expect(page.getByText('2026年9月', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '〈 返回展厅', exact: true }).click();
  await expect(page.getByText('已收藏 1 个瞬间')).toBeVisible();
  await page.getByRole('button', { name: '参观演示展馆', exact: true }).click();
  await expect(page.getByText('已收藏 6 个瞬间')).toBeVisible();
  await page.getByRole('button', { name: '回到我的展馆', exact: true }).click();
  await expect(page.getByText('已收藏 1 个瞬间')).toBeVisible();
  const data = await readRecords(page);
  expect(data.exhibits).toHaveLength(1);
  expect(data.exhibits[0].occurredOn).toBe('2026-09');
  expect(data.featuredIds).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('草稿保留与恢复；保存失败没有揭幕且输入仍在', async ({ page }) => {
  await createMuseum(page);
  await startForm(page);
  await fillMoment(page, '草稿里的一个小瞬间');
  await page.getByRole('navigation').getByRole('button', { name: '展厅', exact: true }).click();
  await page.getByRole('button', { name: '保留草稿并离开', exact: true }).click();
  await expect(page.getByText('已收藏 0 个瞬间')).toBeVisible();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: '收藏一个瞬间' }).click();
  await page.getByRole('button', { name: '继续这个瞬间', exact: true }).click();
  await expect(page.getByLabel('我想怎样记住这件事？')).toHaveValue('草稿里的一个小瞬间');
  await page.evaluate(() => {
    const prototype = IDBDatabase.prototype;
    const original = prototype.transaction;
    prototype.transaction = function (this: IDBDatabase, ...args: any[]) {
      if (args[1] === 'readwrite') throw new DOMException('模拟配额不足', 'QuotaExceededError');
      return original.apply(this, args as any);
    } as typeof prototype.transaction;
  });
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '未能保存到浏览器' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('我想怎样记住这件事？')).toHaveValue('草稿里的一个小瞬间');
  const data = await readRecords(page);
  expect(data.exhibits).toHaveLength(0);
});

test('导出后在空的同源浏览器恢复；非法备份与失败事务保护现有馆藏', async ({ page, browser }) => {
  await createMuseum(page);
  await startForm(page);
  await fillMoment(page, '备份里的瞬间');
  await page.getByLabel('放在展厅入口的精选展台').check();
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await page.getByRole('button', { name: '回到展厅', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '数据与备份' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  const backup = JSON.parse(buffer.toString());
  expect(backup.exhibits).toHaveLength(1);
  expect(backup.featuredIds).toHaveLength(1);
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto('http://127.0.0.1:5173/#/settings');
  await fresh
    .getByLabel('导入备份', { exact: true })
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await expect(fresh.getByText('文件中有')).toBeVisible();
  await fresh.getByRole('button', { name: '确认整体恢复' }).click();
  await expect(fresh.getByText('馆藏已完整恢复。')).toBeVisible();
  const restored = await readRecords(fresh);
  expect({ ...restored, exportedAt: backup.exportedAt }).toEqual(backup);
  await context.close();
  for (const bad of [
    '{broken',
    JSON.stringify({ ...backup, schemaVersion: 5 }),
    JSON.stringify({ ...backup, exhibits: [backup.exhibits[0], backup.exhibits[0]] }),
    JSON.stringify({
      ...backup,
      exhibits: [
        { ...backup.exhibits[0], evidence: [{ label: '危险链接', url: 'javascript:alert(1)' }] },
      ],
    }),
  ]) {
    await page
      .getByLabel('导入备份', { exact: true })
      .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(bad) });
    await expect(page.getByRole('alert')).toBeVisible();
    expect((await readRecords(page)).exhibits).toHaveLength(1);
  }
  await page.getByLabel('导入备份', { exact: true }).setInputFiles({
    name: 'demo-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demoMuseum)),
  });
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: any[]) {
      if (args[1] === 'readwrite') throw new DOMException('模拟失败', 'QuotaExceededError');
      return original.apply(this, args as any);
    } as typeof original;
  });
  await page.getByRole('button', { name: '确认整体恢复' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  expect((await readRecords(page)).exhibits).toHaveLength(1);
});

test('主题、正文搜索、月精度长廊和详情返回保持筛选与滚动位置', async ({ page }) => {
  await page.goto('/');
  await page.locator('#collection').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '工程与创造', exact: true }).click();
  await page.getByLabel('搜索馆藏标题或故事').fill('检查清单');
  const list = page.locator('.collection-grid .exhibit-card');
  await expect(list).toHaveCount(1);
  const before = await page.evaluate(() => scrollY);
  await list.first().click();
  await page.getByRole('button', { name: '〈 返回展厅', exact: true }).click();
  await expect(page.getByLabel('搜索馆藏标题或故事')).toHaveValue('检查清单');
  await expect(list).toHaveCount(1);
  await expect(list.first()).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(10);
  await page.getByRole('navigation').getByRole('button', { name: '时间长廊' }).click();
  await expect(page.getByText('2026年7月 · 探索与成长')).toBeVisible();
});

test('360px 手机填写、静态揭幕、键盘焦点和纯文本渲染', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createMuseum(page);
  await page.getByRole('button', { name: '打开菜单' }).click();
  await startForm(page);
  await fillMoment(page, '<script>一个纯文本标题</script>');
  await page.getByRole('button', { name: '预览藏品', exact: true }).click();
  await expect(page.getByText('它正在成为一件藏品')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '继续填写', exact: true }).click();
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page
      .locator('.reveal-scene .artifact')
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '<script>一个纯文本标题</script>', level: 1 }),
  ).toBeVisible();
  expect(await page.locator('main script').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('编辑、三件精选替换和删除确认保持一致，不重复揭幕', async ({ page }) => {
  await createMuseum(page);
  await page.getByRole('navigation').getByRole('button', { name: '数据与备份' }).click();
  await page.getByLabel('导入备份', { exact: true }).setInputFiles({
    name: 'fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demoMuseum)),
  });
  await page.getByRole('button', { name: '确认整体恢复' }).click();
  await expect(page.getByText('馆藏已完整恢复。')).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: '展厅', exact: true }).click();
  await page.getByRole('button', { name: /我把想法放到了世界上/ }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('我想怎样记住这件事？').fill('编辑过的作品');
  await page.getByLabel('放在展厅入口的精选展台').check();
  await expect(page.getByLabel('请选择要替换的精选')).toBeVisible();
  await page.getByLabel('请选择要替换的精选').selectOption(demoMuseum.featuredIds[0]);
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('heading', { name: '编辑过的作品', level: 1 })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const afterEdit = await readRecords(page);
  expect(afterEdit.featuredIds).toHaveLength(3);
  expect(afterEdit.featuredIds).not.toContain(demoMuseum.featuredIds[0]);
  expect(afterEdit.featuredIds).toContain(demoMuseum.exhibits[1].id);
  await page.getByRole('button', { name: '删除这件展品' }).click();
  await page.getByRole('button', { name: '关闭对话框' }).click();
  expect((await readRecords(page)).exhibits).toHaveLength(6);
  await page.getByRole('button', { name: '删除这件展品' }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('已收藏 5 个瞬间')).toBeVisible();
  const afterDelete = await readRecords(page);
  expect(afterDelete.featuredIds).toHaveLength(2);
  expect(afterDelete.featuredIds).not.toContain(demoMuseum.exhibits[1].id);
});

test('模式切换、浏览器返回也保护草稿，精度切换不伪造某日', async ({ page }) => {
  await createMuseum(page);
  await startForm(page);
  await fillMoment(page, '还在路上的草稿');
  await page.getByLabel('日期精度').selectOption('month');
  await page.getByLabel('日期精度').selectOption('day');
  await expect(page.getByLabel('发生在什么时候？')).toHaveValue('');
  await page.getByRole('button', { name: '参观演示展馆', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '保留草稿并离开', exact: true }).click();
  await expect(page.getByText('已收藏 6 个瞬间')).toBeVisible();
  await page.getByRole('button', { name: '回到我的展馆', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '收藏一个瞬间' }).click();
  await page.getByRole('button', { name: '继续这个瞬间', exact: true }).click();
  await expect(page.getByLabel('我想怎样记住这件事？')).toHaveValue('还在路上的草稿');
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '丢弃草稿并离开', exact: true }).click();
  await expect(page.getByText('已收藏 0 个瞬间')).toBeVisible();
});

test('键盘打开展品、返回恢复焦点，弹窗焦点不逸出', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.featured-section .exhibit-card').first();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '我让一座桥稳了下来', level: 1 })).toBeFocused();
  const back = page.getByRole('button', { name: '〈 返回展厅', exact: true });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(card).toBeFocused();
  await page.getByRole('button', { name: '建立我的展馆', exact: true }).focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '建立我的展馆', exact: true })).toBeFocused();
});

test('存储不可用时明确临时模式，仍可导出恢复所需数据', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('禁用存储', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByText('浏览器存储暂时不可用。', { exact: false })).toBeVisible();
  await createMuseum(page);
  await startForm(page);
  await fillMoment(page, '临时收藏');
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByText('已收入临时馆藏，请及时导出备份。')).toBeVisible();
  await page.getByRole('button', { name: '回到展厅', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '数据与备份' }).click();
  await expect(page.getByText('临时模式 · 当前无法使用浏览器存储')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  expect((await downloaded).suggestedFilename()).toContain('来时路');
});
