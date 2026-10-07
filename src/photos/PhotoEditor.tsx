import { useState } from 'react';
import { ImagePlus, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { MAX_PHOTOS, type DraftPhoto } from './model';
import { preparePhoto } from './prepare';
import { PhotoView } from './PhotoView';
import { RepositoryConnection } from './Hosting';
export function PhotoEditor({
  photos,
  cover,
  disabled,
  onChange,
  onCoverChange,
  onWorking,
}: {
  photos: DraftPhoto[];
  cover: boolean;
  disabled: boolean;
  onChange: (photos: DraftPhoto[]) => void;
  onCoverChange: (value: boolean) => void;
  onWorking: (value: boolean) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const locked = disabled || processing;
  const move = (index: number, offset: number) => {
    const next = [...photos];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <section className="form-section photo-editor">
      <div className="section-label">
        <span>03</span>
        <h2>留下当时的模样</h2>
        <small>可选 · 最多 {MAX_PHOTOS} 张</small>
      </div>
      <p className="photo-description">
        一张现场的照片，也能让记忆变得具体。先选好，收入馆藏时再上传。
      </p>
      <RepositoryConnection compact />
      <label className={`photo-dropzone ${locked ? 'disabled' : ''}`}>
        <ImagePlus size={25} />
        <strong>{processing ? '正在整理照片…' : '选择照片'}</strong>
        <span>JPG、PNG、WebP · 每张原图最多 10 MiB</span>
        <input
          aria-label="选择收藏照片"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={locked || photos.length >= MAX_PHOTOS}
          onChange={async (event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = '';
            setError('');
            if (files.length + photos.length > MAX_PHOTOS) {
              setError(`每件收藏最多 ${MAX_PHOTOS} 张照片，请减少选择。`);
              return;
            }
            if (!files.length) return;
            setProcessing(true);
            onWorking(true);
            const next = [...photos];
            const problems: string[] = [];
            // 顺序解码限制内存峰值；某张失败不影响已完成的选图，也不会提前向网络发送图片。
            try {
              for (const file of files) {
                try {
                  const prepared = await preparePhoto(file);
                  if (next.some((p) => p.hash === prepared.hash)) {
                    problems.push('已跳过一张重复照片。');
                    continue;
                  }
                  next.push(prepared);
                } catch (err) {
                  problems.push(err instanceof Error ? err.message : '有一张照片无法处理。');
                }
              }
              onChange(next);
              setError([...new Set(problems)].join(' '));
            } finally {
              setProcessing(false);
              onWorking(false);
            }
          }}
        />
      </label>
      <p className="photo-fineprint">
        自动缩小至最长 1920px、每张最多 1 MiB，并移除原始定位等元数据。
      </p>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {photos.length > 0 && (
        <>
          <div className="photo-edit-grid">
            {photos.map((photo, i) => (
              <div className="photo-edit-item" key={photo.id}>
                <div className="photo-edit-preview">
                  <PhotoView photo={photo} />
                  <span className={`photo-state ${photo.kind === 'github' ? 'hosted' : ''}`}>
                    {photo.kind === 'github' ? (
                      <>
                        <Check size={12} />
                        已在仓库
                      </>
                    ) : (
                      '待上传'
                    )}
                  </span>
                  <button
                    type="button"
                    className="photo-remove"
                    disabled={locked}
                    aria-label={`移除照片 ${i + 1}`}
                    onClick={() => onChange(photos.filter((p) => p.id !== photo.id))}
                  >
                    <X size={16} />
                  </button>
                </div>
                <label htmlFor={`photo-alt-${photo.id}`}>照片 {i + 1} 的说明</label>
                <input
                  id={`photo-alt-${photo.id}`}
                  maxLength={160}
                  disabled={locked}
                  value={photo.alt}
                  placeholder="一句话，记住那一刻"
                  onChange={(e) =>
                    onChange(
                      photos.map((p) => (p.id === photo.id ? { ...p, alt: e.target.value } : p)),
                    )
                  }
                />
                <div className="photo-edit-controls">
                  <span>
                    {i === 0 && cover ? '列表封面' : `${i + 1} / ${photos.length}`} ·{' '}
                    {Math.ceil(photo.bytes / 1024)} KiB
                  </span>
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={locked || i === 0}
                      aria-label={`前移照片 ${i + 1}`}
                      onClick={() => move(i, -1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={locked || i === photos.length - 1}
                      aria-label={`后移照片 ${i + 1}`}
                      onClick={() => move(i, 1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              disabled={locked}
              checked={cover}
              onChange={(e) => onCoverChange(e.target.checked)}
            />
            <span>
              用第一张照片作为列表封面<small>详情页依然保留你选择的抽象藏品。</small>
            </span>
          </label>
          <p className="photo-fineprint">
            移除只取消本次收藏里的关联，仓库文件和 Git 历史仍会保留，已有备份也可继续使用。
          </p>
        </>
      )}
    </section>
  );
}
