import {
  digest,
  imagePath,
  validRepository,
  type Repository,
  type PendingPhoto,
  type HostedPhoto,
} from './model';
export class GitHubError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
function statusMessage(status: number) {
  if (status === 401) return 'GitHub 连接已失效，请重新连接有效令牌。';
  if (status === 403 || status === 429)
    return 'GitHub 拒绝了请求：请检查 Contents 写入权限、分支规则，或稍后重试。';
  if (status === 404) return '找不到仓库或分支，请检查名称，以及令牌是否允许访问该仓库。';
  if (status === 409 || status === 422)
    return '仓库写入发生冲突，请确认分支允许直接提交，然后重试。';
  return 'GitHub 暂时无法完成请求，图片和输入已保留，请稍后重试。';
}
export class GitHubPhotoClient {
  // 凭证只驻留实例内存；不会被序列化进 IndexedDB、备份、日志或构建文件。
  #token = '';
  #repository?: Repository;
  #queue: Promise<unknown> = Promise.resolve();
  disconnect() {
    this.#token = '';
    this.#repository = undefined;
  }
  async #request(path: string, token: string, init: RequestInit = {}) {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        ...init,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new GitHubError('无法连接 GitHub。请检查网络后重试；已经上传的图片不会重复覆盖。');
    }
    if (!res.ok) throw new GitHubError(statusMessage(res.status), res.status);
    return res.json();
  }
  async connect(repository: Repository, token: string) {
    const config = validRepository(repository);
    const secret = token.trim();
    if (!secret || /\s/.test(secret)) throw new Error('请填写有效的 GitHub 令牌。');
    const base = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
    const data = await this.#request(base, secret);
    if (data.private !== false || data.visibility === 'private')
      throw new Error('请选择公开仓库。私人仓库的图片不能作为无需登录的公开图片展示。');
    if (data.archived || data.permissions?.push !== true)
      throw new Error('当前账号没有此仓库的写入权限，或仓库已归档。');
    await this.#request(`${base}/branches/${encodeURIComponent(config.branch)}`, secret);
    this.#token = secret;
    this.#repository = config;
    return config;
  }
  upload(photo: PendingPhoto, exhibitId: string): Promise<HostedPhoto> {
    const config = this.#repository;
    const token = this.#token;
    if (!config || !token)
      return Promise.reject(new Error('请先连接图片仓库，再收入包含新照片的收藏。'));
    // GitHub Contents 写入必须串行；失败释放队列，让下一次手动重试仍然可用。
    const job = this.#queue
      .catch(() => {})
      .then(() => this.#upload(photo, exhibitId, config, token));
    this.#queue = job;
    return job;
  }
  async #upload(
    photo: PendingPhoto,
    exhibitId: string,
    config: Repository,
    token: string,
  ): Promise<HostedPhoto> {
    if (photo.blob.size !== photo.bytes || (await digest(photo.blob)) !== photo.hash)
      throw new Error('本地图片草稿不完整，请重新选择这张图片。');
    const path = imagePath(exhibitId, photo.hash);
    const base = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
    const fileEndpoint = `${base}/contents/${path}`;
    const blobSha = await digest(photo.blob, 'SHA-1');
    const finish = (commit: string): HostedPhoto => {
      if (!/^[a-f0-9]{40}$/.test(commit))
        throw new Error('GitHub 未返回有效图片版本，请重试以核对上传结果。');
      return {
        kind: 'github',
        id: photo.id,
        alt: photo.alt,
        width: photo.width,
        height: photo.height,
        bytes: photo.bytes,
        hash: photo.hash,
        owner: config.owner,
        repo: config.repo,
        path,
        commit,
        blobSha,
      };
    };
    async function base64(blob: Blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return btoa(binary);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const head = await this.#request(
        `${base}/branches/${encodeURIComponent(config.branch)}`,
        token,
      );
      const sha = head.commit?.sha;
      if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha))
        throw new Error('无法确认仓库分支版本。');
      try {
        const existing = await this.#request(`${fileEndpoint}?ref=${sha}`, token);
        if (existing.sha !== blobSha || existing.type !== 'file')
          throw new Error('仓库中存在同名但内容不同的文件。已停止上传，未覆盖任何文件。');
        // 重试时核对内容并复用；固定提交地址不会随分支更新改变，旧备份也能继续显示。
        return finish(sha);
      } catch (error) {
        if (!(error instanceof GitHubError) || error.status !== 404) throw error;
      }
      try {
        const result = await this.#request(fileEndpoint, token, {
          method: 'PUT',
          body: JSON.stringify({
            message: `media: add exhibit photo ${photo.hash.slice(0, 12)}`,
            content: await base64(photo.blob),
            branch: config.branch,
          }),
        });
        if (result.content?.sha !== blobSha)
          throw new Error('GitHub 返回的图片校验不一致，请重试核对。');
        return finish(result.commit?.sha);
      } catch (error) {
        if (attempt === 1 || !(error instanceof GitHubError) || ![409, 422].includes(error.status))
          throw error;
      }
    }
    throw new Error('上传尚未完成，请重试。');
  }
}
