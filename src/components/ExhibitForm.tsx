import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, X, ChevronDown, Save, Download } from 'lucide-react';
import { Artifact } from './Artifact';
import {
  artifacts,
  palettes,
  themes,
  formatDate,
  newExhibit,
  validateExhibit,
  downloadFile,
  type Draft,
  type Exhibit,
  type MuseumBackup,
} from '../model';
export function ExhibitForm({
  initial,
  museum,
  onDraft,
  onSave,
  onLeave,
  draftStatus,
}: {
  initial?: Draft;
  museum: MuseumBackup;
  onDraft: (draft: Draft) => void;
  onSave: (draft: Draft) => Promise<void>;
  onLeave: () => void;
  draftStatus: string;
}) {
  const [draft, setDraft] = useState<Draft>(
    () => initial || { exhibit: newExhibit(), featured: false, replaces: '' },
  );
  const [expanded, setExpanded] = useState(!!initial?.editingId);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const e = draft.exhibit;
  const replaceRequired =
    draft.featured && !museum.featuredIds.includes(e.id) && museum.featuredIds.length >= 3;
  useEffect(() => {
    onDraft(draft);
  }, [draft, onDraft]);
  function update(patch: Partial<Exhibit>) {
    setDraft((d) => ({ ...d, exhibit: { ...d.exhibit, ...patch } }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (replaceRequired && !draft.replaces)
        throw new Error('已有三件精选，请明确选择要替换的一件。');
      const safe = validateExhibit({
        ...e,
        actions: e.actions.filter((a) => a.trim()),
        tags: e.tags.filter((t) => t.trim()),
        evidence: e.evidence.filter((v) => v.label.trim() || v.url?.trim()),
        updatedAt: new Date().toISOString(),
      });
      setBusy(true);
      await onSave({ ...draft, exhibit: safe });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败。输入已保留，请重试或下载草稿。');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page form-page">
      <button className="text-button back-button" onClick={onLeave}>
        〈 返回展厅
      </button>
      <div className="page-heading">
        <span className="eyebrow">A MOMENT WORTH KEEPING</span>
        <h1 tabIndex={-1}>{draft.editingId ? '再看看这个瞬间' : '收藏一个瞬间'}</h1>
        <p>小事也可以，不必写得像汇报。</p>
      </div>
      <button className="preview-toggle secondary" onClick={() => setPreview(!preview)}>
        {preview ? '继续填写' : '预览藏品'}
      </button>
      <div className={`form-grid ${preview ? 'show-preview' : ''}`}>
        <form onSubmit={submit} className="form-content" aria-describedby="form-error">
          <section className="form-section">
            <div className="section-label">
              <span>01</span>
              <h2>先留下这个瞬间</h2>
              <small>三个字段，就可以收藏</small>
            </div>
            <label htmlFor="title">
              我想怎样记住这件事？ <span className="required">必填</span>
            </label>
            <input
              id="title"
              value={e.title}
              required
              maxLength={40}
              placeholder="比如：终于把那个想法做了出来"
              onChange={(v) => update({ title: v.target.value })}
            />
            <div className="field-hint">
              用自己的话，为它起个名字。<span>{e.title.length}/40</span>
            </div>
            <div className="date-row">
              <div>
                <label htmlFor="precision">日期精度</label>
                <select
                  id="precision"
                  value={e.datePrecision}
                  onChange={(v) => {
                    const precision = v.target.value as 'day' | 'month';
                    /* 月精度不推断具体日，改为某天时请主人明确选择。 */ update({
                      datePrecision: precision,
                      occurredOn: precision === 'month' ? e.occurredOn.slice(0, 7) : '',
                    });
                  }}
                >
                  <option value="day">记得某一天</option>
                  <option value="month">只记得某个月</option>
                </select>
              </div>
              <div>
                <label htmlFor="date">
                  发生在什么时候？ <span className="required">必填</span>
                </label>
                <input
                  id="date"
                  type={e.datePrecision === 'day' ? 'date' : 'month'}
                  required
                  value={e.occurredOn}
                  onChange={(v) => update({ occurredOn: v.target.value })}
                />
              </div>
            </div>
            <label htmlFor="outcome">
              我做成了什么，或迈出了哪一步？ <span className="required">必填</span>
            </label>
            <textarea
              id="outcome"
              required
              maxLength={500}
              rows={4}
              value={e.outcome}
              onChange={(v) => update({ outcome: v.target.value })}
              placeholder="留下具体的结果。还没完全解决的部分，也可以写下来。"
            />
            <div className="field-hint">
              不需要很大，只需要真实。<span>{e.outcome.length}/500</span>
            </div>
            <label htmlFor="summary">
              用一句话记住它的意义 <span className="optional">可选</span>
            </label>
            <input
              id="summary"
              maxLength={80}
              value={e.summary || ''}
              onChange={(v) => update({ summary: v.target.value })}
              placeholder="这件小事，为什么值得留下？"
            />
          </section>
          <section className="form-section">
            <div className="section-label">
              <span>02</span>
              <h2>给记忆一个形状</h2>
            </div>
            <label htmlFor="theme">放在哪个主题里？</label>
            <select
              id="theme"
              value={e.theme}
              onChange={(v) => update({ theme: v.target.value as Exhibit['theme'] })}
            >
              {Object.entries(themes).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <fieldset className="object-choices">
              <legend>选择物件</legend>
              <div>
                {Object.entries(artifacts).map(([key, name]) => (
                  <button
                    type="button"
                    className={e.artifact === key ? 'selected' : ''}
                    key={key}
                    aria-pressed={e.artifact === key}
                    onClick={() => update({ artifact: key as Exhibit['artifact'] })}
                  >
                    <Artifact kind={key as Exhibit['artifact']} palette={e.palette} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="palette-choices">
              <legend>物件配色</legend>
              <div>
                {Object.entries(palettes).map(([key, name]) => (
                  <button
                    type="button"
                    key={key}
                    className={e.palette === key ? 'selected' : ''}
                    aria-pressed={e.palette === key}
                    onClick={() => update({ palette: key as Exhibit['palette'] })}
                  >
                    <i className={`swatch ${key}`} />
                    {name}
                    {e.palette === key && <Check size={14} />}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(v) => setDraft({ ...draft, featured: v.target.checked })}
              />
              <span>
                放在展厅入口的精选展台<small>精选最多三件，由你决定先看见哪段经历。</small>
              </span>
            </label>
            {replaceRequired && (
              <>
                <label htmlFor="replacement">请选择要替换的精选</label>
                <select
                  id="replacement"
                  required
                  value={draft.replaces}
                  onChange={(v) => setDraft({ ...draft, replaces: v.target.value })}
                >
                  <option value="">请选择一件</option>
                  {museum.featuredIds.map((id) => (
                    <option key={id} value={id}>
                      {museum.exhibits.find((v) => v.id === id)?.title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </section>
          <button
            type="button"
            className="expand-story"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <span>
              <Plus size={18} /> 补充这个故事 <small>背景、困难、行动，以及给自己的话</small>
            </span>
            <ChevronDown size={18} className={expanded ? 'rotated' : ''} />
          </button>
          {expanded && (
            <section className="form-section optional-story">
              {(
                [
                  ['context', '那时发生了什么'],
                  ['challenge', '难在哪里'],
                  ['meaning', '这件事留给了我什么'],
                  ['noteToSelf', '给那时的自己'],
                ] as const
              ).map(([key, name]) => (
                <div key={key}>
                  <label htmlFor={key}>
                    {name} <span className="optional">可选</span>
                  </label>
                  <textarea
                    id={key}
                    rows={3}
                    maxLength={key === 'noteToSelf' ? 300 : 1000}
                    value={e[key] || ''}
                    onChange={(v) => update({ [key]: v.target.value })}
                  />
                </div>
              ))}
              <label>
                我做了什么 <span className="optional">最多五项</span>
              </label>
              {e.actions.map((action, i) => (
                <div className="repeat-field" key={i}>
                  <textarea
                    aria-label={`行动 ${i + 1}`}
                    maxLength={300}
                    rows={2}
                    value={action}
                    onChange={(v) =>
                      update({ actions: e.actions.map((a, n) => (n === i ? v.target.value : a)) })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`移除行动 ${i + 1}`}
                    onClick={() => update({ actions: e.actions.filter((_, n) => n !== i) })}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              {e.actions.length < 5 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => update({ actions: [...e.actions, ''] })}
                >
                  <Plus size={16} /> 添加行动
                </button>
              )}
              <label htmlFor="tags">
                标签 <span className="optional">最多五个，每个 12 字</span>
              </label>
              <input
                id="tags"
                value={e.tags.join('，')}
                onChange={(v) => update({ tags: v.target.value.split(/[,，]/) })}
                placeholder="用逗号分隔，例如：第一次，重新开始"
              />
              <label>
                可选证据 <span className="optional">最多三条，不会自动访问链接</span>
              </label>
              {e.evidence.map((v, i) => (
                <div className="evidence-field" key={i}>
                  <input
                    aria-label={`证据 ${i + 1} 说明`}
                    placeholder="文字说明"
                    maxLength={300}
                    value={v.label}
                    onChange={(evt) =>
                      update({
                        evidence: e.evidence.map((a, n) =>
                          n === i ? { ...a, label: evt.target.value } : a,
                        ),
                      })
                    }
                  />
                  <div className="repeat-field">
                    <input
                      aria-label={`证据 ${i + 1} HTTPS 链接`}
                      placeholder="https://（可不填）"
                      maxLength={2048}
                      value={v.url || ''}
                      onChange={(evt) =>
                        update({
                          evidence: e.evidence.map((a, n) =>
                            n === i ? { ...a, url: evt.target.value } : a,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`移除证据 ${i + 1}`}
                      onClick={() => update({ evidence: e.evidence.filter((_, n) => n !== i) })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {e.evidence.length < 3 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => update({ evidence: [...e.evidence, { label: '' }] })}
                >
                  <Plus size={16} /> 添加证据
                </button>
              )}
            </section>
          )}
          {error && (
            <p role="alert" className="error-message" id="form-error">
              {error}
            </p>
          )}
          <div className="form-bottom">
            <span className="save-status" role="status">
              <Save size={15} />
              {draftStatus}
            </span>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? '正在收入馆藏…' : draft.editingId ? '保存修改' : '收入馆藏'}
            </button>
          </div>
          <button
            type="button"
            className="text-button draft-download"
            onClick={() =>
              downloadFile('来时路-未保存草稿.txt', JSON.stringify(draft, null, 2), 'text/plain')
            }
          >
            <Download size={15} /> 下载当前草稿
          </button>
        </form>
        <aside className="preview-pane">
          <div className="preview-sticky">
            <span className="eyebrow">YOUR NEXT EXHIBIT</span>
            <h2>它正在成为一件藏品</h2>
            <div className={`preview-scene scene-${e.palette}`}>
              <Artifact kind={e.artifact} palette={e.palette} />
              <div className="preview-plaque">
                <span>
                  {e.occurredOn ? formatDate(e) : '一个值得留下的时刻'} · {themes[e.theme]}
                </span>
                <h3>{e.title || '这个瞬间，等你命名'}</h3>
                <p>{e.summary || '那些走过的路，正在成为你。'}</p>
              </div>
            </div>
            <p className="preview-caption">
              每段经历，都有属于它的形状。
              <br />
              不必比较大小，也不必证明什么。
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
