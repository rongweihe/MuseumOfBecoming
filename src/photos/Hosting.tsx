import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CloudUpload as Github, Link2, Unplug, ExternalLink } from 'lucide-react';
import { GitHubPhotoClient } from './github';
import { defaultRepository, validRepository, type Repository } from './model';
import { getStored, writeStored } from '../storage';
import { Modal } from '../components/Modal';
interface Hosting {
  client: GitHubPhotoClient;
  repository: Repository;
  connected: boolean;
  connect: (config: Repository, token: string) => Promise<void>;
  disconnect: () => void;
}
const HostingContext = createContext<Hosting | undefined>(undefined);
export function PhotoHostingProvider({ children }: { children: ReactNode }) {
  const client = useRef(new GitHubPhotoClient());
  const [repository, setRepository] = useState(defaultRepository);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let active = true;
    getStored<Repository>('photo-repository')
      .then((config) => {
        if (active && config) setRepository(validRepository(config));
      })
      .catch(() => {});
    const clear = () => {
      client.current.disconnect();
      setConnected(false);
    };
    window.addEventListener('pagehide', clear);
    return () => {
      active = false;
      window.removeEventListener('pagehide', clear);
      client.current.disconnect();
    };
  }, []);
  return (
    <HostingContext.Provider
      value={{
        client: client.current,
        repository,
        connected,
        connect: async (config, token) => {
          const verified = await client.current.connect(config, token);
          // 仓库地址可记住，凭证绝不进入存储；存储不可用时连接仍只在内存有效。
          await writeStored({ 'photo-repository': verified }).catch(() => {});
          setRepository(verified);
          setConnected(true);
        },
        disconnect: () => {
          client.current.disconnect();
          setConnected(false);
        },
      }}
    >
      {children}
    </HostingContext.Provider>
  );
}
export function usePhotoHosting() {
  const value = useContext(HostingContext);
  if (!value) throw new Error('图片托管环境尚未初始化。');
  return value;
}
export function RepositoryConnection({ compact = false }: { compact?: boolean }) {
  const hosting = usePhotoHosting();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(hosting.repository);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => {
    if (busy) return;
    setOpen(false);
    setToken('');
    setError('');
  };
  return (
    <div className={`repository-connection ${compact ? 'compact' : ''}`} data-focus-return>
      {!compact && (
        <>
          <span className="eyebrow">PHOTOGRAPHS / GITHUB</span>
          <h2>为照片安一个家</h2>
          <p>照片由你的 GitHub 仓库托管，文字记录仍保存在当前浏览器。</p>
        </>
      )}
      <div className="repository-status">
        <Github size={20} />
        <div>
          <strong>
            {hosting.connected
              ? `${hosting.repository.owner}/${hosting.repository.repo}`
              : '图片仓库尚未连接'}
          </strong>
          <small>
            {hosting.connected
              ? `${hosting.repository.branch} · 本次页面已连接`
              : '选好照片后，保存前连接即可'}
          </small>
        </div>
        {hosting.connected ? (
          <button type="button" className="text-button" onClick={hosting.disconnect}>
            <Unplug size={15} />
            断开
          </button>
        ) : (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setConfig(hosting.repository);
              setOpen(true);
            }}
          >
            <Link2 size={15} />
            连接图片仓库
          </button>
        )}
      </div>
      {!compact && (
        <p className="photo-fineprint">
          每次重新打开页面需要重新连接。已有照片无需连接即可展示。图片上传后即在公开仓库中，移除收藏不会清除
          Git 历史。
        </p>
      )}
      {open && (
        <Modal title="连接你的图片仓库" onClose={close}>
          <form
            className="repository-form"
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setBusy(true);
              setError('');
              try {
                await hosting.connect(config, token);
                setToken('');
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : '连接失败，请重试。');
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              仅有仓库写入权限的主人能上传照片。普通访客不会获得你的写入权限。
            </p>
            <fieldset disabled={busy}>
              <div className="repository-fields">
                <div>
                  <label htmlFor="repo-owner">仓库所有者</label>
                  <input
                    id="repo-owner"
                    required
                    maxLength={39}
                    value={config.owner}
                    onChange={(e) => setConfig({ ...config, owner: e.target.value.trim() })}
                  />
                </div>
                <div>
                  <label htmlFor="repo-name">仓库名</label>
                  <input
                    id="repo-name"
                    required
                    maxLength={100}
                    value={config.repo}
                    onChange={(e) => setConfig({ ...config, repo: e.target.value.trim() })}
                  />
                </div>
              </div>
              <label htmlFor="repo-branch">图片保存分支</label>
              <input
                id="repo-branch"
                required
                maxLength={100}
                value={config.branch}
                onChange={(e) => setConfig({ ...config, branch: e.target.value.trim() })}
              />
              <details className="token-help">
                <summary>如何创建专用 GitHub 令牌？</summary>
                <ol>
                  <li>
                    打开{' '}
                    <a
                      href="https://github.com/settings/personal-access-tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Fine-grained tokens <ExternalLink size={12} />
                    </a>
                    ，设置较短的有效期。
                  </li>
                  <li>Repository access 选择 Only select repositories，只选上面填写的仓库。</li>
                  <li>
                    Repository permissions 将 Contents 设为 Read and write，其他权限保持默认。
                  </li>
                  <li>生成后粘贴到下面。无需给 Workflows 写入权限。</li>
                </ol>
              </details>
              <label htmlFor="repo-token">GitHub 令牌</label>
              <input
                id="repo-token"
                required
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                aria-describedby="token-note"
                placeholder="仅保留在本次页面内存中"
              />
              <p id="token-note" className="photo-fineprint">
                令牌仅发送到
                api.github.com，不进入本地持久化、备份或仓库。仓库需允许向所选分支直接提交。
              </p>
              <label className="check-label">
                <input type="checkbox" required />
                <span>
                  我了解：保存时选中的照片会上传到公开仓库，任何获得图片链接的人都可以查看。
                </span>
              </label>
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  暂不连接
                </button>
                <button className="primary">{busy ? '正在验证连接…' : '验证并连接'}</button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
    </div>
  );
}
