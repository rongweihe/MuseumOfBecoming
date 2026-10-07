import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
const token = 'github_pat_mock_photo_test';
async function image(page: Page, color: string) {
  const data = await page.evaluate((color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 900, 600);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#eee2ca');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 600);
    ctx.fillStyle = '#fff9e9';
    ctx.font = '42px serif';
    ctx.fillText('A moment worth keeping', 90, 300);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color);
  return { name: 'moment.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}
async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '建立我的展馆', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '建立我的展馆', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '收藏一个瞬间' }).click();
  await page.getByLabel('我想怎样记住这件事？').fill('一个值得收藏的下午');
  await page
    .getByLabel('我做成了什么，或迈出了哪一步？')
    .fill('留出一个完整的下午，和身边的人慢慢走。');
}
async function connect(page: Page) {
  await page.getByRole('button', { name: '连接图片仓库', exact: true }).click();
  await page.getByLabel('GitHub 令牌', { exact: true }).fill(token);
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByRole('button', { name: '验证并连接', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function records(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('museum-of-becoming', 1);
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction('records');
    const read = (key: string) =>
      new Promise<any>((resolve) => {
        const r = tx.objectStore('records').get(key);
        r.onsuccess = () => resolve(r.result);
      });
    return { museum: await read('museum'), draft: await read('draft') };
  });
}
async function mockRepository(page: Page) {
  const files = new Map<string, Buffer>();
  const writes: string[] = [];
  let failSecond = false;
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    expect(req.headers().authorization).toBe(`Bearer ${token}`);
    if (path.endsWith('/MuseumOfBecoming'))
      return route.fulfill({ json: { private: false, permissions: { push: true } } });
    if (path.includes('/branches/'))
      return route.fulfill({ json: { commit: { sha: 'a'.repeat(40) } } });
    const file = path.split('/contents/')[1];
    if (req.method() === 'PUT') {
      if (failSecond && files.size === 1 && !files.has(file))
        return route.fulfill({ status: 403, json: {} });
      const body = req.postDataJSON();
      const bytes = Buffer.from(body.content, 'base64');
      files.set(file, bytes);
      writes.push(file);
      const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      return route.fulfill({
        status: 201,
        json: { content: { sha }, commit: { sha: 'b'.repeat(40) } },
      });
    }
    const bytes = files.get(file);
    return bytes
      ? route.fulfill({
          json: {
            type: 'file',
            sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
          },
        })
      : route.fulfill({ status: 404, json: {} });
  });
  await page.route('https://raw.githubusercontent.com/**', (route) => {
    const path = new URL(route.request().url()).pathname.split('/').slice(4).join('/');
    const bytes = files.get(path);
    return bytes
      ? route.fulfill({ body: bytes, contentType: 'image/webp' })
      : route.fulfill({ status: 404, body: '' });
  });
  return {
    writes,
    files,
    fail: (value: boolean) => {
      failSecond = value;
    },
  };
}

test('选择、压缩、排序、上传、封面、照片组和无凭证备份完整可用', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await mockRepository(page);
  await setup(page);
  await page
    .getByLabel('选择收藏照片')
    .setInputFiles([await image(page, '#49685b'), await image(page, '#946836')]);
  await expect(page.getByText('待上传', { exact: true })).toHaveCount(2);
  expect(mock.writes).toHaveLength(0);
  await page.getByLabel('照片 1 的说明', { exact: true }).fill('走到树影下，终于慢了下来。');
  await connect(page);
  await expect(page.getByLabel('我想怎样记住这件事？')).toHaveValue('一个值得收藏的下午');
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/05-photo-editor.png', fullPage: true });
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('这一刻，值得留下。')).toBeVisible();
  expect(mock.writes).toHaveLength(2);
  await page.getByRole('button', { name: '走近看看', exact: true }).click();
  await expect(page.getByRole('heading', { name: '当时的模样' })).toBeVisible();
  await expect(page.locator('.photo-gallery img')).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator('.photo-gallery img')
        .first()
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'docs/screenshots/06-photo-exhibit.png', fullPage: true });
  await page.getByRole('button', { name: /查看照片 1/ }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog').getByText('当时的模样 · 2 / 2')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.photo-gallery img')).toHaveCount(2);
  await page.getByRole('button', { name: '〈 返回展厅', exact: true }).click();
  await expect(page.locator('.card-photo')).toHaveCount(1);
  await page.getByRole('navigation').getByRole('button', { name: '数据与备份' }).click();
  await expect(page.getByText('图片仓库尚未连接')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  const json = Buffer.concat(chunks).toString();
  expect(json).not.toContain(token);
  const backup = JSON.parse(json);
  expect(backup.schemaVersion).toBe(2);
  expect(backup.exhibits[0].photos).toHaveLength(2);
  expect(backup.exhibits[0].photos[0].bytes).toBeLessThan(1024 * 1024);
  await page.getByLabel('导入备份', { exact: true }).setInputFiles({
    name: 'photos.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await page.getByRole('button', { name: '确认整体恢复', exact: true }).click();
  await expect(page.getByText('馆藏已完整恢复。')).toBeVisible();
  expect(errors).toEqual([]);
});

test('部分上传失败保留草稿，重试跳过成功的图片；刷新仍能恢复待上传 Blob', async ({ page }) => {
  const mock = await mockRepository(page);
  await setup(page);
  await page
    .getByLabel('选择收藏照片')
    .setInputFiles([await image(page, '#345f82'), await image(page, '#a67142')]);
  await expect(page.getByText('待上传', { exact: true })).toHaveCount(2);
  await page.getByRole('navigation').getByRole('button', { name: '展厅', exact: true }).click();
  await page.getByRole('button', { name: '保留草稿并离开', exact: true }).click();
  await expect(page.getByText('已收藏 0 个瞬间')).toBeVisible();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: '收藏一个瞬间' }).click();
  await page.getByRole('button', { name: '继续这个瞬间' }).click();
  await expect(page.getByText('待上传', { exact: true })).toHaveCount(2);
  await connect(page);
  mock.fail(true);
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'GitHub 拒绝' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('已在仓库', { exact: true })).toHaveCount(1);
  const state = await records(page);
  expect(state.museum.exhibits).toHaveLength(0);
  expect(state.draft.photos[0].kind).toBe('github');
  mock.fail(false);
  await page.getByRole('button', { name: '收入馆藏', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('这一刻，值得留下。')).toBeVisible();
  expect(mock.writes).toHaveLength(2);
  expect((await records(page)).draft).toBeUndefined();
});

test('360px 选图预览、格式拒绝、六张限制和文字未丢失', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: '建立我的展馆', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '建立我的展馆', exact: true }).click();
  await page.getByRole('button', { name: '打开菜单' }).click();
  await page.getByRole('navigation').getByRole('button', { name: '收藏一个瞬间' }).click();
  await page.getByLabel('我想怎样记住这件事？').fill('手机上的记忆');
  await page
    .getByLabel('选择收藏照片')
    .setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('真实的');
  const picture = await image(page, '#49685b');
  await page.getByLabel('选择收藏照片').setInputFiles(Array(7).fill(picture));
  await expect(page.getByRole('alert')).toContainText('最多 6 张');
  await page.getByLabel('选择收藏照片').setInputFiles(picture);
  await expect(page.getByText('待上传', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '预览藏品', exact: true }).click();
  await expect(page.locator('.preview-photo')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/07-mobile-photo-preview.png', fullPage: true });
});
