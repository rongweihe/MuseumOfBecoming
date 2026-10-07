import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
let server: Server;
let origin = '';
const prefix = '/Museum_of_Becoming/';
test.beforeAll(async () => {
  const root = resolve('dist');
  // 使用真正的静态文件服务验证生产包，避免 Vite 的开发回退掩盖子路径问题。
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404).end();
        return;
      }
      const path = resolve(root, decodeURIComponent(pathname.slice(prefix.length)) || 'index.html');
      if (!path.startsWith(`${root}/`)) {
        res.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
      };
      res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
      res.end(content);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  if (address && typeof address === 'object') origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolveClose, reject) =>
    server.close((e) => (e ? reject(e) : resolveClose())),
  );
});
test('生产包子路径下所有资源、直达详情与刷新可用，故事没有外发请求', async ({ page }) => {
  const network: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];
  page.on('request', (req) => {
    network.push(req.url());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(res.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}${prefix}#/exhibit/00000000-0000-4000-8000-000000000001`);
  await expect(page.getByRole('heading', { name: '我让一座桥稳了下来', level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByText('你当时没有全部答案，但你一步一步把事情弄清楚了。')).toBeVisible();
  await page.getByRole('button', { name: '〈 返回展厅', exact: true }).click();
  await page.getByLabel('搜索馆藏标题或故事').fill('本地搜索隐私检查');
  expect(network.every((url) => url.startsWith(`${origin}${prefix}`))).toBe(true);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
