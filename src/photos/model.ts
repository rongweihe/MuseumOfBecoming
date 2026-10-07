export const MAX_PHOTOS = 6;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1920;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface Repository {
  owner: string;
  repo: string;
  branch: string;
}
interface PhotoBase {
  id: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  hash: string;
}
export interface HostedPhoto extends PhotoBase {
  kind: 'github';
  owner: string;
  repo: string;
  path: string;
  commit: string;
  blobSha: string;
}
export interface PendingPhoto extends PhotoBase {
  kind: 'pending';
  blob: Blob;
}
export type DraftPhoto = HostedPhoto | PendingPhoto;
export const defaultRepository: Repository = {
  owner: 'rongweihe',
  repo: 'MuseumOfBecoming',
  branch: 'main',
};
export function validRepository(value: Repository) {
  if (
    !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value.owner) ||
    !/^[\w.-]{1,100}$/.test(value.repo) ||
    ['.', '..'].includes(value.repo)
  )
    throw new Error('请填写有效的 GitHub 所有者和仓库名。');
  if (
    !value.branch ||
    value.branch.length > 100 ||
    /[\s~^:?*\[\\]/.test(value.branch) ||
    value.branch.includes('..') ||
    value.branch.includes('@{') ||
    value.branch.includes('//') ||
    /^[/.]|[/.]$/.test(value.branch)
  )
    throw new Error('请填写有效的分支名。');
  return { owner: value.owner, repo: value.repo, branch: value.branch };
}
export function imagePath(exhibitId: string, hash: string) {
  if (!UUID.test(exhibitId) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('图片标识不正确。');
  return `public/uploads/${exhibitId.toLowerCase()}/${hash}.webp`;
}
export function photoUrl(photo: HostedPhoto) {
  // 地址由受限元数据构造，不接受备份传入的任意主机、data URL 或 SVG。
  return `https://raw.githubusercontent.com/${encodeURIComponent(photo.owner)}/${encodeURIComponent(photo.repo)}/${photo.commit}/${photo.path.split('/').map(encodeURIComponent).join('/')}`;
}
export function validatePhotos(value: unknown, exhibitId: string): HostedPhoto[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PHOTOS)
    throw new Error(`每件收藏最多 ${MAX_PHOTOS} 张照片。`);
  const result = value.map((x: unknown): HostedPhoto => {
    if (!x || typeof x !== 'object') throw new Error('照片信息不完整。');
    const p = x as Record<string, unknown>;
    if (
      p.kind !== 'github' ||
      typeof p.id !== 'string' ||
      !UUID.test(p.id) ||
      typeof p.alt !== 'string' ||
      p.alt.length > 160
    )
      throw new Error('照片标识或说明不正确。');
    for (const key of ['width', 'height', 'bytes'] as const) {
      const max = key === 'bytes' ? MAX_IMAGE_BYTES : MAX_IMAGE_EDGE;
      if (typeof p[key] !== 'number' || !Number.isInteger(p[key]) || p[key] < 1 || p[key] > max)
        throw new Error('照片尺寸或大小超出限制。');
    }
    if (typeof p.owner !== 'string' || typeof p.repo !== 'string')
      throw new Error('照片仓库信息不正确。');
    validRepository({ owner: p.owner, repo: p.repo, branch: 'main' });
    if (
      typeof p.hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(p.hash) ||
      p.path !== imagePath(exhibitId, p.hash) ||
      typeof p.commit !== 'string' ||
      !/^[a-f0-9]{40}$/.test(p.commit) ||
      typeof p.blobSha !== 'string' ||
      !/^[a-f0-9]{40}$/.test(p.blobSha)
    )
      throw new Error('照片的仓库路径或固定版本不正确。');
    return {
      kind: 'github',
      id: p.id.toLowerCase(),
      alt: p.alt,
      width: p.width as number,
      height: p.height as number,
      bytes: p.bytes as number,
      hash: p.hash,
      owner: p.owner,
      repo: p.repo,
      path: p.path as string,
      commit: p.commit,
      blobSha: p.blobSha,
    };
  });
  if (
    new Set(result.map((p) => p.id)).size !== result.length ||
    new Set(result.map((p) => p.hash)).size !== result.length
  )
    throw new Error('照片列表包含重复图片。');
  return result;
}
export async function digest(blob: Blob, algorithm: 'SHA-256' | 'SHA-1' = 'SHA-256') {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Git blob 的 SHA 包含对象头，用它核实同名文件，避免覆盖仓库中不同的内容。
  const input =
    algorithm === 'SHA-1'
      ? new Uint8Array([...new TextEncoder().encode(`blob ${bytes.length}\0`), ...bytes])
      : bytes;
  return Array.from(new Uint8Array(await crypto.subtle.digest(algorithm, input)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
}
