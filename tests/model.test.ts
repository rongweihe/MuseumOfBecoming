import { describe, it, expect } from 'vitest';
import {
  parseBackup,
  validateBackup,
  validDate,
  formatDate,
  sortedExhibits,
  searchExhibit,
} from '../src/model';
import { demoMuseum } from '../src/demo';
const sample = () => structuredClone(demoMuseum);

describe('备份恢复的边界', () => {
  it('完整备份往返保留个人配置、全部故事、精选和月精度', () => {
    const before = validateBackup(sample());
    expect(parseBackup(JSON.stringify(before))).toEqual(before);
    expect(before.exhibits[2].occurredOn).toBe('2026-07');
    expect(formatDate(before.exhibits[2], true)).toBe('2026年7月');
  });
  it('拒绝非法 JSON 和未知版本', () => {
    expect(() => parseBackup('{invalid')).toThrow('JSON');
    expect(() => validateBackup({ ...sample(), schemaVersion: 2 })).toThrow('版本');
  });
  it('拒绝重复 ID、无效精选引用和超额精选', () => {
    const sameUuid = sample();
    sameUuid.exhibits[0].id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    sameUuid.exhibits[1].id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(() => validateBackup(sameUuid)).toThrow('重复');
    const duplicate = sample();
    duplicate.exhibits[1].id = duplicate.exhibits[0].id;
    expect(() => validateBackup(duplicate)).toThrow('重复');
    expect(() => validateBackup({ ...sample(), featuredIds: ['missing'] })).toThrow('精选');
    expect(() =>
      validateBackup({
        ...sample(),
        featuredIds: sample()
          .exhibits.slice(0, 4)
          .map((e) => e.id),
      }),
    ).toThrow('最多');
  });
  it('拒绝危险链接，只接受 HTTPS，且提取允许字段', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      'http://example.com',
      'https://user:secret@example.com',
    ]) {
      const data = sample();
      data.exhibits[0].evidence = [{ label: '证据', url }];
      expect(() => validateBackup(data)).toThrow('HTTPS');
    }
    const safe = sample();
    safe.exhibits[0].evidence = [
      { label: '<script>纯文本</script>', url: 'https://example.com/path' },
    ];
    const result = validateBackup({ ...safe, svg: '<svg />', dangerous: true });
    expect(result).not.toHaveProperty('svg');
    expect(result.exhibits[0].evidence[0].label).toContain('<script>');
  });
  it('拒绝非法日期、过长内容、过量展品与大文件', () => {
    const data = sample();
    data.exhibits[0].occurredOn = '2026-02-30';
    expect(() => validateBackup(data)).toThrow('日期');
    data.exhibits[0].occurredOn = '2026-02-28';
    data.exhibits[0].createdAt = '2026-02-30T00:00:00.000Z';
    expect(() => validateBackup(data)).toThrow('ISO');
    data.exhibits[0].createdAt = '2026-02-28T00:00:00.000Z';
    data.exhibits[0].title = '字'.repeat(41);
    expect(() => validateBackup(data)).toThrow('标题');
    expect(() =>
      validateBackup({ ...sample(), exhibits: Array(1001).fill(sample().exhibits[0]) }),
    ).toThrow('1000');
    expect(() => parseBackup(' '.repeat(5 * 1024 * 1024 + 1))).toThrow('5 MiB');
  });
});
describe('日历与浏览', () => {
  it('按实际日历处理闰年、月精度、非法天数', () => {
    expect(validDate('2024-02-29', 'day')).toBe(true);
    expect(validDate('2026-02-29', 'day')).toBe(false);
    expect(validDate('2026-09', 'month')).toBe(true);
    expect(validDate('2026-09-01', 'month')).toBe(false);
    expect(validDate('2026-13', 'month')).toBe(false);
    expect(validDate('0000-01', 'month')).toBe(false);
  });
  it('搜索正文和行动，排序稳定，不修改原始记录', () => {
    const data = sample();
    expect(searchExhibit(data.exhibits[0], '检查清单')).toBe(true);
    expect(searchExhibit(data.exhibits[0], '完全不存在')).toBe(false);
    const reversed = [...data.exhibits].reverse();
    expect(sortedExhibits(reversed).map((e) => e.id)).toEqual(data.exhibits.map((e) => e.id));
    expect(reversed[0].id).toBe(data.exhibits[5].id);
  });
});
