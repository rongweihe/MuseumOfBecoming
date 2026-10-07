import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { emptyMuseum } from '../src/model';
import { getStored, persistMuseum, loadMuseum, persistDraft, writeStored } from '../src/storage';

describe('馆藏隔离与事务', () => {
  it('初次打开仅选择演示，不将虚构记录复制进个人馆藏', async () => {
    const data = await loadMuseum();
    expect(data.preferences.mode).toBe('demo');
    expect(data.museum.exhibits).toEqual([]);
  });
  it('正式收藏、偏好和移除草稿一起提交', async () => {
    const data = emptyMuseum();
    data.owner.name = '测试馆主';
    await writeStored({ draft: { title: '未提交' } });
    await persistMuseum(data, { mode: 'personal', initialized: true }, true);
    expect((await loadMuseum()).museum.owner.name).toBe('测试馆主');
    expect(await getStored('draft')).toBeUndefined();
  });
  it('恢复数据无效时不覆盖已有馆藏', async () => {
    const original = await loadMuseum();
    await expect(
      persistMuseum({ ...original.museum, schemaVersion: 99 } as never, {
        mode: 'personal',
        initialized: true,
      }),
    ).rejects.toThrow();
    expect((await loadMuseum()).museum).toEqual(original.museum);
  });
  it('写入过程中失败必须回滚此前写入，保留旧数据与草稿', async () => {
    await writeStored({ museum: { sentinel: 'before' }, draft: { sentinel: 'keep' } });
    await expect(
      writeStored({ museum: { sentinel: 'after' }, preferences: () => {} }, ['draft']),
    ).rejects.toThrow();
    expect(await getStored('museum')).toEqual({ sentinel: 'before' });
    expect(await getStored('draft')).toEqual({ sentinel: 'keep' });
  });
  it('草稿串行操作完成后可明确清除', async () => {
    await writeStored({ draft: { title: '旧草稿' } });
    await persistDraft(undefined);
    expect(await getStored('draft')).toBeUndefined();
  });
});
