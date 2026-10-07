export const themes = {
  craft: '工程与创造',
  growth: '探索与成长',
  relationships: '生活与关系',
  wellbeing: '身体与勇气',
} as const;
export const artifacts = {
  bridge: '桥梁',
  lighthouse: '灯塔',
  crystal: '晶体',
  'twin-stars': '双星',
  mountain: '山峰',
} as const;
export const palettes = { bronze: '暖铜', sage: '石绿', midnight: '夜蓝' } as const;
export type Theme = keyof typeof themes;
export type Artifact = keyof typeof artifacts;
export type Palette = keyof typeof palettes;
export interface Exhibit {
  id: string;
  title: string;
  occurredOn: string;
  datePrecision: 'day' | 'month';
  theme: Theme;
  artifact: Artifact;
  palette: Palette;
  summary?: string;
  context?: string;
  challenge?: string;
  actions: string[];
  outcome: string;
  meaning?: string;
  noteToSelf?: string;
  evidence: { label: string; url?: string }[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
export interface MuseumBackup {
  schemaVersion: 1;
  exportedAt: string;
  owner: { name: string; introduction: string };
  featuredIds: string[];
  exhibits: Exhibit[];
}
export interface Draft {
  exhibit: Exhibit;
  featured: boolean;
  replaces: string;
  editingId?: string;
}
export type Mode = 'demo' | 'personal';
export interface Preferences {
  mode: Mode;
  initialized: boolean;
}
export function emptyMuseum(): MuseumBackup {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    owner: { name: 'remy', introduction: '这里收藏着我做成的事，也收藏着它们让我成为的自己。' },
    featuredIds: [],
    exhibits: [],
  };
}
export function today() {
  const d = new Date();
  // 事件日期是本地日历日期，不能通过 UTC 转换导致日期前移。
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function newExhibit(): Exhibit {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    occurredOn: today(),
    datePrecision: 'day',
    theme: 'growth',
    artifact: 'crystal',
    palette: 'bronze',
    actions: [],
    outcome: '',
    tags: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function validDate(value: string, precision: 'day' | 'month') {
  if (!(precision === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/).test(value)) return false;
  const [y, m, day = 1] = value.split('-').map(Number);
  if (y < 1 || y > 9999 || m < 1 || m > 12 || day < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
export function formatDate(e: Pick<Exhibit, 'occurredOn' | 'datePrecision'>, long = false) {
  const [y, m, d] = e.occurredOn.split('-');
  return long
    ? `${y}年${Number(m)}月${e.datePrecision === 'day' ? `${Number(d)}日` : ''}`
    : `${y}.${m}${e.datePrecision === 'day' ? `.${d}` : ''}`;
}
export function sortedExhibits(exhibits: Exhibit[]) {
  // 月精度记录保留月值，不伪造某日；同月记录以创建时间和 ID 保持稳定顺序。
  return [...exhibits].sort(
    (a, b) =>
      b.occurredOn.localeCompare(a.occurredOn) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
}
export function searchExhibit(e: Exhibit, query: string) {
  return [
    e.title,
    e.summary,
    e.context,
    e.challenge,
    ...e.actions,
    e.outcome,
    e.meaning,
    e.noteToSelf,
    ...e.tags,
    ...e.evidence.map((v) => v.label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label}格式不正确。`);
  return value as Record<string, unknown>;
}
function str(value: unknown, label: string, max: number, required = false): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw new Error(`${label}应为${required ? '非空' : ''}文本，且不超过 ${max} 字。`);
  return value;
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label}最多 ${max} 项。`);
  return value;
}
function enumValue<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T))
    throw new Error(`${label}不在支持范围内。`);
  return value as T;
}
function timestamp(value: unknown, label: string) {
  const v = str(value, label, 40, true);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    !validDate(v.slice(0, 10), 'day') ||
    Number(v.slice(11, 13)) > 23 ||
    Number(v.slice(14, 16)) > 59 ||
    Number(v.slice(17, 19)) > 59
  )
    throw new Error(`${label}不是有效 ISO 时间。`);
  return v;
}
export function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validateExhibit(value: unknown): Exhibit {
  const x = object(value, '展品');
  // UUID 的大小写不改变身份；归一化后检查唯一性，不能让同一 ID 占两个位置。
  const id = str(x.id, '展品 ID', 36, true).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    throw new Error('展品 ID 必须是有效 UUID。');
  const precision = enumValue(x.datePrecision, ['day', 'month'], '日期精度');
  const date = str(x.occurredOn, '日期', 10, true);
  if (!validDate(date, precision)) throw new Error('日期不正确，请使用真实的某天或某月。');
  const evidence = list(x.evidence, '证据', 3).map((value) => {
    const v = object(value, '证据');
    const label = str(v.label, '证据说明', 300, true);
    const url = str(v.url, '证据链接', 2048);
    if (url && !httpsUrl(url)) throw new Error('证据链接仅支持不带账号密码的 HTTPS 地址。');
    return { label, ...(url ? { url } : {}) };
  });
  // 显式提取允许字段，防止备份夹带 HTML、SVG、原型属性或未知配置。
  return {
    id,
    title: str(x.title, '标题', 40, true),
    occurredOn: date,
    datePrecision: precision,
    theme: enumValue(x.theme, Object.keys(themes) as Theme[], '主题'),
    artifact: enumValue(x.artifact, Object.keys(artifacts) as Artifact[], '物件'),
    palette: enumValue(x.palette, Object.keys(palettes) as Palette[], '配色'),
    summary: str(x.summary, '一句意义', 80),
    context: str(x.context, '背景', 1000),
    challenge: str(x.challenge, '困难', 1000),
    actions: list(x.actions, '行动', 5).map((v) => str(v, '行动', 300, true)),
    outcome: str(x.outcome, '结果', 500, true),
    meaning: str(x.meaning, '意义', 1000),
    noteToSelf: str(x.noteToSelf, '给自己的话', 300),
    evidence,
    tags: list(x.tags, '标签', 5).map((v) => str(v, '标签', 12, true)),
    createdAt: timestamp(x.createdAt, '创建时间'),
    updatedAt: timestamp(x.updatedAt, '修改时间'),
  };
}
export function validateBackup(value: unknown): MuseumBackup {
  const x = object(value, '备份');
  if (x.schemaVersion !== 1)
    throw new Error('不支持此备份版本，请使用 schemaVersion 为 1 的来时路备份。');
  const owner = object(x.owner, '馆主设置');
  const exhibits = list(x.exhibits, '馆藏', 1000).map(validateExhibit);
  const ids = new Set(exhibits.map((e) => e.id));
  if (ids.size !== exhibits.length) throw new Error('备份包含重复的展品 ID。');
  const featuredIds = list(x.featuredIds, '精选', 3).map((v) =>
    str(v, '精选 ID', 36, true).toLowerCase(),
  );
  if (new Set(featuredIds).size !== featuredIds.length || featuredIds.some((id) => !ids.has(id)))
    throw new Error('精选引用必须唯一，并指向已有展品。');
  return {
    schemaVersion: 1,
    exportedAt: timestamp(x.exportedAt, '导出时间'),
    owner: {
      name: str(owner.name, '馆主名', 40, true),
      introduction: str(owner.introduction, '馆序', 1000),
    },
    exhibits,
    featuredIds,
  };
}
export function parseBackup(text: string): MuseumBackup {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new Error('备份文件不能超过 5 MiB。');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('无法读取 JSON，请选择来时路导出的备份文件。');
  }
  return validateBackup(value);
}
export function downloadFile(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
