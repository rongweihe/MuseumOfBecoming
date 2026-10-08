import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubPhotoClient } from '../src/photos/github';
import {
  defaultRepository,
  digest,
  imagePath,
  photoUrl,
  validatePhotos,
  type PendingPhoto,
  type HostedPhoto,
} from '../src/photos/model';
import { validateBackup } from '../src/model';
import { demoMuseum } from '../src/demo';
const exhibitId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function pending(): Promise<PendingPhoto> {
  const blob = new Blob(['small image test payload'], { type: 'image/webp' });
  return {
    kind: 'pending',
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    alt: '那个下午',
    width: 300,
    height: 200,
    bytes: blob.size,
    hash: await digest(blob),
    blob,
  };
}
async function mockGitHub({ conflict = false, failure = false } = {}) {
  const photo = await pending();
  const blobSha = await digest(photo.blob, 'SHA-1');
  const writes: any[] = [];
  let exists = false;
  let attempts = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url.startsWith('https://api.github.com/repos/')).toBe(true);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
      if (url.endsWith('/MuseumOfBecoming'))
        return Response.json({ private: false, permissions: { push: true } });
      if (url.includes('/branches/')) return Response.json({ commit: { sha: 'a'.repeat(40) } });
      if (init.method === 'PUT') {
        attempts++;
        if (failure) return Response.json({}, { status: 403 });
        const body = JSON.parse(String(init.body));
        writes.push(body);
        exists = true;
        if (conflict && attempts === 1) return Response.json({}, { status: 409 });
        return Response.json(
          { content: { sha: blobSha }, commit: { sha: 'b'.repeat(40) } },
          { status: 201 },
        );
      }
      return exists
        ? Response.json({ type: 'file', sha: blobSha })
        : Response.json({}, { status: 404 });
    }),
  );
  return { photo, writes, blobSha };
}
afterEach(() => vi.unstubAllGlobals());
describe('图片上传与恢复', () => {
  it('实际写入 base64 文件，固定提交地址，并在重试中复用已有文件', async () => {
    const { photo, writes } = await mockGitHub();
    const client = new GitHubPhotoClient();
    await client.connect(defaultRepository, 'test-token');
    const uploaded = await client.upload(photo, exhibitId);
    await client.upload(photo, exhibitId);
    expect(writes).toHaveLength(1);
    expect(writes[0].branch).toBe('main');
    expect(writes[0]).not.toHaveProperty('sha');
    expect(Buffer.from(writes[0].content, 'base64').toString()).toBe('small image test payload');
    expect(photoUrl(uploaded)).toContain('/' + 'b'.repeat(40) + '/public/uploads/');
    expect(JSON.stringify(client)).not.toContain('test-token');
    client.disconnect();
    await expect(client.upload(photo, exhibitId)).rejects.toThrow('连接');
  });
  it('写入冲突后重新核对，已存在图片不重复写入', async () => {
    const { photo, writes } = await mockGitHub({ conflict: true });
    const client = new GitHubPhotoClient();
    await client.connect(defaultRepository, 'test-token');
    const saved = await client.upload(photo, exhibitId);
    expect(writes).toHaveLength(1);
    expect(saved.commit).toBe('a'.repeat(40));
  });
  it('权限失败不伪造托管引用；失败不会卡住上传队列', async () => {
    const { photo } = await mockGitHub({ failure: true });
    const client = new GitHubPhotoClient();
    await client.connect(defaultRepository, 'test-token');
    await expect(client.upload(photo, exhibitId)).rejects.toThrow('拒绝');
    await mockGitHub();
    await expect(client.upload(photo, exhibitId)).resolves.toHaveProperty('kind', 'github');
  });
  it('拒绝私人仓库和无权限账户', async () => {
    const client = new GitHubPhotoClient();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ private: true, permissions: { push: true } })),
    );
    await expect(client.connect(defaultRepository, 'test-token')).rejects.toThrow('公开');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ private: false, permissions: { push: false } })),
    );
    await expect(client.connect(defaultRepository, 'test-token')).rejects.toThrow('写入权限');
  });
  it('旧备份迁移到 v2，新备份保留图片且拒绝任意主机和危险路径', async () => {
    const { photo } = await mockGitHub();
    const client = new GitHubPhotoClient();
    await client.connect(defaultRepository, 'test-token');
    const hosted = await client.upload(photo, exhibitId);
    const old = validateBackup({ ...demoMuseum, schemaVersion: 1 });
    expect(old.schemaVersion).toBe(2);
    const record = { ...demoMuseum.exhibits[0], id: exhibitId, photos: [hosted] };
    const restored = validateBackup({ ...demoMuseum, exhibits: [record], featuredIds: [] });
    expect(restored.exhibits[0].photos).toEqual([hosted]);
    expect(() => validatePhotos([{ ...hosted, path: '../../index.html' }], exhibitId)).toThrow(
      '路径',
    );
    expect(() => validatePhotos([{ ...hosted, commit: 'main' }], exhibitId)).toThrow('版本');
    expect(() => validatePhotos(Array(7).fill(hosted), exhibitId)).toThrow('最多');
    const sanitized = validatePhotos([{ ...hosted, url: 'javascript:alert(1)' }], exhibitId);
    expect(sanitized[0]).not.toHaveProperty('url');
    expect(imagePath(exhibitId, photo.hash)).toMatch(/\.webp$/);
  });
});

describe('GitHub 权限与限流的真实响应行为', () => {
  it('只读 token 可以连接，但上传时报明确的写入权限错误', async () => {
    const { photo } = await mockGitHub();
    const fetchOriginal = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === 'PUT')
          return Response.json(
            { message: 'Resource not accessible by personal access token' },
            { status: 403 },
          );
        return fetchOriginal(input, init);
      }),
    );
    const client = new GitHubPhotoClient();
    await client.connect(defaultRepository, 'test-token');
    await expect(client.upload(photo, exhibitId)).rejects.toMatchObject({
      status: 403,
      reason: 'permissions',
      operation: 'upload-photo',
    });
  });
  it('限流后连续点击不继续发网络请求', async () => {
    const { photo } = await mockGitHub();
    const client = new GitHubPhotoClient();
    await client.connect(defaultRepository, 'test-token');
    const fetch = vi.fn(async () =>
      Response.json(
        { message: 'API rate limit exceeded' },
        { status: 403, headers: { 'retry-after': '60', 'x-ratelimit-remaining': '0' } },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(client.upload(photo, exhibitId)).rejects.toMatchObject({ reason: 'rate-limit' });
    await expect(client.upload(photo, exhibitId)).rejects.toThrow('等待期');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
