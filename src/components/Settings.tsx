import { useEffect, useState, type ChangeEvent } from 'react';
import { Download, Upload, Database, Check, ArrowUpRight, BookOpen } from 'lucide-react';
import { Modal } from './Modal';
import { parseBackup, type MuseumBackup, type Mode } from '../model';
export function Settings({
  museum,
  mode,
  initialized,
  temporary,
  onSaveOwner,
  onRestore,
  onExport,
  onMode,
  onSetup,
}: {
  museum: MuseumBackup;
  mode: Mode;
  initialized: boolean;
  temporary: boolean;
  onSaveOwner: (owner: MuseumBackup['owner']) => Promise<void>;
  onRestore: (museum: MuseumBackup) => Promise<void>;
  onExport: () => void;
  onMode: (mode: Mode) => void;
  onSetup: () => void;
}) {
  const [owner, setOwner] = useState(museum.owner);
  // 恢复备份或首次建馆会更新设置，但保留当前页的成功提示和交互状态。
  useEffect(() => {
    setOwner(museum.owner);
  }, [museum.owner]);
  const [candidate, setCandidate] = useState<MuseumBackup>();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  async function read(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    setSuccess('');
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('备份文件不能超过 5 MiB。');
      setCandidate(parseBackup(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法读取文件。现有馆藏保持不变。');
    }
  }
  async function restore() {
    if (!candidate) return;
    setBusy(true);
    setError('');
    try {
      await onRestore(candidate);
      setOwner(candidate.owner);
      setCandidate(undefined);
      setSuccess('馆藏已完整恢复。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败，原馆藏保持不变。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page settings-page">
      <div className="page-heading">
        <span className="eyebrow">KEEP YOUR MEMORIES SAFE</span>
        <h1 tabIndex={-1}>数据与备份</h1>
        <p>让留下来的事，能够长久地被看见。</p>
      </div>
      <div className="storage-note">
        <Database size={25} />
        <div>
          <strong>
            {temporary ? '临时模式 · 当前无法使用浏览器存储' : '记录保存在当前浏览器'}
          </strong>
          <p>
            {temporary
              ? '临时收藏只在本次打开期间保留。请导出备份，恢复存储后再导入。'
              : '换设备前，请导出备份。清除站点数据可能会丢失记录。'}
          </p>
        </div>
        <span className={`storage-pill ${temporary ? 'warning' : ''}`}>
          {temporary ? '请及时备份' : '本地存储已就绪'}
        </span>
      </div>
      <div className="settings-grid">
        <section className="settings-box">
          <span className="eyebrow">01 / YOUR COLLECTION</span>
          <h2>把记忆好好保存</h2>
          <p>
            备份包含你的馆主设置、正式馆藏与精选。
            <br />
            不包含演示故事和未保存草稿。
          </p>
          <div className="backup-count">
            <strong>{museum.exhibits.length}</strong>
            <span>件个人藏品</span>
          </div>
          <div className="button-row">
            <button className="primary" onClick={onExport}>
              <Download size={17} /> 导出完整备份
            </button>
            <label className="secondary import-label">
              <Upload size={17} /> 导入备份
              <input
                type="file"
                accept=".json,application/json"
                onChange={read}
                aria-label="导入备份"
              />
            </label>
          </div>
          <small>仅支持来时路 JSON 备份，最大 5 MiB、1000 件展品。</small>
        </section>
        <section className="settings-box">
          <span className="eyebrow">02 / A PLACE OF YOUR OWN</span>
          <h2>馆主与馆序</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setSuccess('');
              setBusy(true);
              try {
                await onSaveOwner(owner);
                setSuccess('馆主设置已保存。');
              } catch (err) {
                setError(err instanceof Error ? err.message : '设置保存失败。');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="owner-name">馆主名</label>
            <input
              id="owner-name"
              required
              maxLength={40}
              value={owner.name}
              onChange={(e) => setOwner({ ...owner, name: e.target.value })}
            />
            <label htmlFor="introduction">
              写给这座展馆的一段话 <span className="optional">可选</span>
            </label>
            <textarea
              id="introduction"
              rows={4}
              maxLength={1000}
              value={owner.introduction}
              onChange={(e) => setOwner({ ...owner, introduction: e.target.value })}
            />
            {initialized ? (
              <button className="secondary" disabled={busy}>
                保存馆主设置
              </button>
            ) : (
              <button className="primary" type="button" onClick={onSetup}>
                建立我的展馆
              </button>
            )}
          </form>
        </section>
        <section className="settings-box mode-box">
          <div>
            <span className="eyebrow">03 / MUSEUM MODE</span>
            <h2>在两座展馆之间</h2>
            <p>演示只是一个参观示例。你的经历，始终留在自己的展馆里。</p>
          </div>
          <div className="mode-options">
            <button className={mode === 'demo' ? 'selected' : ''} onClick={() => onMode('demo')}>
              <BookOpen size={19} />
              <span>
                演示展馆<small>六件虚构故事 · 只读</small>
              </span>
              {mode === 'demo' && <Check size={18} />}
            </button>
            <button
              className={mode === 'personal' ? 'selected' : ''}
              onClick={() => (initialized ? onMode('personal') : onSetup())}
            >
              <Database size={19} />
              <span>
                我的展馆
                <small>
                  {initialized ? `${museum.exhibits.length} 件个人藏品` : '从第一件小事开始'}
                </small>
              </span>
              {mode === 'personal' ? <Check size={18} /> : <ArrowUpRight size={18} />}
            </button>
          </div>
        </section>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="success-message" role="status">
          {success}
        </p>
      )}
      <p className="privacy-note">
        你的故事不会自动上传。这座展馆没有分析追踪，也没有在线 AI 服务。
      </p>
      {candidate && (
        <Modal title="恢复这份馆藏备份？" onClose={() => !busy && setCandidate(undefined)}>
          <p>
            文件中有 <strong>{candidate.exhibits.length}</strong> 件展品，将替换当前{' '}
            <strong>{museum.exhibits.length}</strong> 件个人展品。
          </p>
          <div className="restore-preview">
            <span>馆主</span>
            <strong>{candidate.owner.name}</strong>
            <span>精选</span>
            <strong>{candidate.featuredIds.length} 件</strong>
          </div>
          <p className="muted">
            这是整体恢复，不会合并两份馆藏。先备份当前馆藏，可以保留一条回去的路。
          </p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="secondary" disabled={busy} onClick={onExport}>
              <Download size={16} /> 先备份当前馆藏
            </button>
            <button className="primary" disabled={busy} onClick={restore}>
              {busy ? '正在恢复…' : '确认整体恢复'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
