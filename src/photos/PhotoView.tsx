import { useEffect, useState } from 'react';
import { ImageOff, RotateCw, ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { Modal } from '../components/Modal';
import { photoUrl, type DraftPhoto, type HostedPhoto } from './model';
export function PhotoView({
  photo,
  className = '',
  eager = false,
}: {
  photo: DraftPhoto;
  className?: string;
  eager?: boolean;
}) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    const url = photo.kind === 'github' ? photoUrl(photo) : URL.createObjectURL(photo.blob);
    setSource(url);
    // 草稿预览用对象 URL，替换或离开后及时释放，避免连续选图累积内存。
    return () => {
      if (photo.kind === 'pending') URL.revokeObjectURL(url);
    };
  }, [photo.kind, photo.id, photo.kind === 'github' ? photo.commit : photo.blob]);
  if (failed)
    return (
      <span className={`photo-unavailable ${className}`}>
        <ImageOff size={24} />
        <span>照片暂时无法加载</span>
        <small>请检查网络或仓库是否仍公开。</small>
      </span>
    );
  return source ? (
    <img
      className={`museum-photo ${className}`}
      src={source}
      alt={photo.alt || '这个瞬间的照片'}
      width={photo.width}
      height={photo.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={`photo-placeholder ${className}`} aria-label="正在准备照片" />
  );
}
export function PhotoGallery({ photos }: { photos: HostedPhoto[] }) {
  const [active, setActive] = useState<number>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (active === undefined) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setActive(
          (index) =>
            ((index ?? 0) + (e.key === 'ArrowRight' ? 1 : -1) + photos.length) % photos.length,
        );
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [active, photos.length]);
  if (!photos.length) return null;
  return (
    <section className="photo-gallery" aria-label="这个瞬间的照片">
      <div className="photo-gallery-heading">
        <div>
          <span className="eyebrow">THE MOMENT, IN PICTURES</span>
          <h2>当时的模样</h2>
        </div>
        <span>{photos.length} 张照片</span>
      </div>
      <div className={`photo-gallery-grid ${photos.length === 1 ? 'single' : ''}`}>
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`查看照片 ${i + 1}${photo.alt ? `：${photo.alt}` : ''}`}
          >
            <PhotoView photo={photo} />
            <span className="photo-expand">
              <Expand size={15} />
            </span>
            {photo.alt && <span className="photo-caption">{photo.alt}</span>}
          </button>
        ))}
      </div>
      {active !== undefined && (
        <Modal
          title={`当时的模样 · ${active + 1} / ${photos.length}`}
          wide
          onClose={() => setActive(undefined)}
        >
          <div className="photo-lightbox">
            <PhotoView key={`${photos[active].id}-${retry}`} photo={photos[active]} eager />
            <p>{photos[active].alt || '一个值得记住的瞬间。'}</p>
            <div className="lightbox-controls">
              <button
                type="button"
                className="secondary"
                disabled={photos.length < 2}
                aria-label="上一张照片"
                onClick={() => setActive((active + photos.length - 1) % photos.length)}
              >
                <ChevronLeft size={18} />
                上一张
              </button>
              <button type="button" className="text-button" onClick={() => setRetry((n) => n + 1)}>
                <RotateCw size={15} />
                重新加载
              </button>
              <button
                type="button"
                className="secondary"
                disabled={photos.length < 2}
                aria-label="下一张照片"
                onClick={() => setActive((active + 1) % photos.length)}
              >
                下一张
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
