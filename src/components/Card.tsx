import { Artifact } from './Artifact';
import { PhotoView } from '../photos/PhotoView';
import { themes, formatDate, type Exhibit } from '../model';
export function Card({
  exhibit: e,
  index,
  onOpen,
}: {
  exhibit: Exhibit;
  index: number;
  onOpen: (e: Exhibit, trigger?: HTMLElement) => void;
}) {
  return (
    <button
      className="exhibit-card"
      onClick={(event) => onOpen(e, event.currentTarget)}
      data-exhibit-id={e.id}
    >
      <div className={`card-scene scene-${e.palette}`}>
        <span className="catalog-number">NO. {String(index + 1).padStart(3, '0')}</span>
        {e.photoCover !== false && e.photos?.[0] ? (
          <PhotoView photo={e.photos[0]} className="card-photo" />
        ) : (
          <Artifact kind={e.artifact} palette={e.palette} />
        )}
        <span className="approach">
          走近看看 <span>↗</span>
        </span>
      </div>
      <div className="plaque">
        <div className="card-meta">
          <time dateTime={e.occurredOn}>{formatDate(e)}</time>
          <span>{themes[e.theme]}</span>
        </div>
        <h3>{e.title}</h3>
        <p>{e.summary || e.outcome}</p>
      </div>
    </button>
  );
}
