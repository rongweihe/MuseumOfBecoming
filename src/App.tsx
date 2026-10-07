import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Landmark,
  Plus,
  Menu,
  X,
  Search,
  Shuffle,
  ArrowUpRight,
  Sparkles,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Artifact } from './components/Artifact';
import { Card } from './components/Card';
import { Modal } from './components/Modal';
import { ExhibitForm } from './components/ExhibitForm';
import { Settings } from './components/Settings';
import { demoMuseum } from './demo';
import {
  emptyMuseum,
  themes,
  artifacts,
  formatDate,
  sortedExhibits,
  searchExhibit,
  validateBackup,
  downloadFile,
  today,
  type MuseumBackup,
  type Exhibit,
  type Mode,
  type Preferences,
  type Draft,
  type Theme,
} from './model';
import {
  loadMuseum,
  getStored,
  persistMuseum,
  persistDraft,
  finishDraftWrites,
  writeStored,
} from './storage';

const currentRoute = () => location.hash.slice(1) || '/museum';
export function App() {
  const [route, setRoute] = useState(currentRoute);
  const [museum, setMuseum] = useState<MuseumBackup>(emptyMuseum);
  const [preferences, setPreferences] = useState<Preferences>({ mode: 'demo', initialized: false });
  const [loading, setLoading] = useState(true);
  const [temporary, setTemporary] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme | 'all'>('all');
  const [draft, setDraft] = useState<Draft>();
  const [formInitial, setFormInitial] = useState<Draft>();
  const [draftStatus, setDraftStatus] = useState('正在保存草稿…');
  const [setup, setSetup] = useState(false);
  const [ownerName, setOwnerName] = useState('remy');
  const [intro, setIntro] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [resume, setResume] = useState(false);
  const [leaving, setLeaving] = useState<string>();
  const [pendingMode, setPendingMode] = useState<Mode>();
  const [reveal, setReveal] = useState<Exhibit>();
  const [deleting, setDeleting] = useState<Exhibit>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftRef = useRef<Draft | undefined>(undefined);
  const routeRef = useRef(route);
  const allowedPath = useRef<string | undefined>(undefined);
  const scroll = useRef({ y: 0, id: '', area: '.collection-grid' });
  const restoreScroll = useRef(false);
  const shown = preferences.mode === 'demo' ? demoMuseum : museum;
  const isForm = route === '/new' || route.startsWith('/edit/');
  const exhibit = shown.exhibits.find((e) => e.id === route.split('/')[2]);

  useEffect(() => {
    let active = true;
    Promise.all([loadMuseum(), getStored<Draft>('draft')])
      .then(([data, storedDraft]) => {
        if (!active) return;
        setMuseum(data.museum);
        setPreferences(data.preferences);
        setDraft(storedDraft);
        draftRef.current = storedDraft;
        if (currentRoute() === '/new' && storedDraft) setFormInitial(storedDraft);
        if (currentRoute().startsWith('/edit/')) {
          const id = currentRoute().split('/')[2];
          const e = data.museum.exhibits.find((v) => v.id === id);
          if (storedDraft && storedDraft.editingId !== id) {
            // 直达另一个编辑地址不能覆盖之前的草稿，先让主人明确恢复或丢弃。
            history.replaceState(null, '', '#/museum');
            setRoute('/museum');
            setResume(true);
          } else if (e)
            setFormInitial(
              storedDraft?.editingId === id
                ? storedDraft
                : {
                    exhibit: e,
                    editingId: e.id,
                    featured: data.museum.featuredIds.includes(e.id),
                    replaces: '',
                  },
            );
        }
      })
      .catch(() => {
        if (!active) return;
        setTemporary(true);
        setError(
          '浏览器存储暂时不可用。已进入临时模式，请及时导出备份；本次收藏关闭页面后可能丢失。',
        );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  function go(path: string, bypass = false) {
    if (isForm && draftRef.current && !bypass) {
      setLeaving(path);
      return;
    }
    setMenu(false);
    if (path === '/museum' && route.startsWith('/exhibit/')) restoreScroll.current = true;
    allowedPath.current = path;
    if (location.hash === `#${path}`) setRoute(path);
    else location.hash = path;
  }
  useEffect(() => {
    routeRef.current = route;
    const change = () => {
      const next = currentRoute();
      if (
        allowedPath.current !== next &&
        (routeRef.current === '/new' || routeRef.current.startsWith('/edit/')) &&
        draftRef.current
      ) {
        // 浏览器返回同样经过离开确认，避免绕过应用按钮导致草稿无提示消失。
        history.replaceState(null, '', `#${routeRef.current}`);
        setLeaving(next);
        return;
      }
      allowedPath.current = undefined;
      if (next === '/museum' && routeRef.current.startsWith('/exhibit/'))
        restoreScroll.current = true;
      setRoute(next);
      setMenu(false);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, [route]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (
        draftRef.current &&
        (routeRef.current === '/new' || routeRef.current.startsWith('/edit/'))
      ) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useLayoutEffect(() => {
    if (loading) return;
    if (route === '/museum' && restoreScroll.current) {
      restoreScroll.current = false;
      window.scrollTo(0, scroll.current.y);
      document
        .querySelector<HTMLButtonElement>(
          `${scroll.current.area} [data-exhibit-id="${scroll.current.id}"]`,
        )
        ?.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
    }
  }, [route, loading]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function commit(next: MuseumBackup, nextPreferences = preferences, clearDraft = false) {
    const safe = validateBackup({ ...next, exportedAt: new Date().toISOString() });
    if (!temporary) await persistMuseum(safe, nextPreferences, clearDraft);
    setMuseum(safe);
    setPreferences(nextPreferences);
  }
  async function changeMode(mode: Mode, bypass = false): Promise<boolean> {
    // 编辑中的模式切换也先保存或丢弃草稿，避免展馆切换绕过离开保护。
    if (isForm && draftRef.current && !bypass) {
      setPendingMode(mode);
      setLeaving('/museum');
      return false;
    }
    if (mode === 'personal' && !preferences.initialized) {
      setSetup(true);
      return false;
    }
    try {
      const next = { ...preferences, mode };
      if (!temporary) await writeStored({ preferences: next });
      setPreferences(next);
      setQuery('');
      setTheme('all');
      go('/museum', true);
      return true;
    } catch {
      setError('切换展馆失败，请重试。你的个人馆藏仍然保留。');
      return false;
    }
  }
  function openExhibit(e: Exhibit, trigger?: HTMLElement) {
    // 精选和普通列表可能展示同一件藏品，返回时必须找回实际触发的那张卡片。
    scroll.current = {
      y: route === '/museum' ? window.scrollY : 0,
      id: e.id,
      area: trigger?.closest('.featured-section') ? '.featured-section' : '.collection-grid',
    };
    go(`/exhibit/${e.id}`);
  }
  function random() {
    if (!shown.exhibits.length) {
      void changeMode('demo');
      return;
    }
    openExhibit(shown.exhibits[Math.floor(Math.random() * shown.exhibits.length)]);
  }
  function begin() {
    if (isForm) {
      setToast('这个瞬间正在等待收入馆藏。');
      return;
    }
    if (preferences.mode === 'demo') {
      if (!preferences.initialized) {
        setSetup(true);
        return;
      }
      void changeMode('personal').then((changed) => {
        if (!changed) return;
        if (draft) setResume(true);
        else {
          setFormInitial(undefined);
          go('/new', true);
        }
      });
      return;
    }
    if (draft) setResume(true);
    else {
      setFormInitial(undefined);
      go('/new');
    }
  }
  const onDraft = useCallback(
    (next: Draft) => {
      draftRef.current = next;
      setDraft(next);
      clearTimeout(draftTimer.current);
      setDraftStatus(temporary ? '临时草稿 · 请下载以保留' : '正在保存草稿…');
      draftTimer.current = setTimeout(() => {
        if (temporary) return;
        persistDraft(next)
          .then(() => setDraftStatus('草稿已保存在当前浏览器'))
          .catch(() => setDraftStatus('草稿保存失败 · 输入仍在，可下载或重试'));
      }, 450);
    },
    [temporary],
  );
  async function saveDraftNow() {
    clearTimeout(draftTimer.current);
    if (!temporary && draftRef.current) await persistDraft(draftRef.current);
  }
  async function discardDraft() {
    clearTimeout(draftTimer.current);
    await finishDraftWrites();
    if (!temporary) await persistDraft(undefined);
    setDraft(undefined);
    draftRef.current = undefined;
  }
  async function saveExhibit(next: Draft) {
    clearTimeout(draftTimer.current);
    await finishDraftWrites();
    let featuredIds = museum.featuredIds.filter((id) => id !== next.exhibit.id);
    if (next.featured) {
      if (featuredIds.length >= 3) {
        if (!featuredIds.includes(next.replaces)) throw new Error('请选择要替换的精选藏品。');
        featuredIds = featuredIds.filter((id) => id !== next.replaces);
      }
      featuredIds.push(next.exhibit.id);
    }
    const exists = museum.exhibits.some((e) => e.id === next.exhibit.id);
    const exhibits = exists
      ? museum.exhibits.map((e) => (e.id === next.exhibit.id ? next.exhibit : e))
      : [...museum.exhibits, next.exhibit];
    try {
      await commit(
        { ...museum, featuredIds, exhibits },
        { mode: 'personal', initialized: true },
        true,
      );
    } catch {
      throw new Error('未能保存到浏览器。输入已保留，请重试；也可以下载当前草稿。');
    }
    setDraft(undefined);
    draftRef.current = undefined;
    go(`/exhibit/${next.exhibit.id}`, true);
    // 只有提交成功的新建记录才揭幕；编辑和保存失败均不会播放庆祝。
    if (!exists) setReveal(next.exhibit);
    else setToast(temporary ? '修改保留在临时模式，请导出备份。' : '这个瞬间的修改已保存。');
  }
  function edit(e: Exhibit) {
    if (draft) {
      setResume(true);
      return;
    }
    setFormInitial({
      exhibit: e,
      editingId: e.id,
      featured: museum.featuredIds.includes(e.id),
      replaces: '',
    });
    go(`/edit/${e.id}`);
  }
  function exportMuseum() {
    downloadFile(
      `来时路-${today()}.json`,
      JSON.stringify({ ...museum, exportedAt: new Date().toISOString() }, null, 2),
    );
    setToast('备份文件已准备下载，请妥善保存。');
  }
  const all = sortedExhibits(shown.exhibits);
  const filtered = all.filter(
    (e) => (theme === 'all' || e.theme === theme) && searchExhibit(e, query),
  );
  const featured = shown.featuredIds
    .map((id) => shown.exhibits.find((e) => e.id === id))
    .filter((e): e is Exhibit => !!e);
  const years = shown.exhibits.map((e) => e.occurredOn.slice(0, 4)).sort();
  const yearRange = years.length ? `${years[0]} — ${years[years.length - 1]}` : '故事，刚刚开始';
  const uniqueThemes = new Set(shown.exhibits.map((e) => e.theme)).size;

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => go('/museum')} aria-label="来时路，返回展厅">
            <span className="brand-icon">
              <Landmark size={27} strokeWidth={1.3} />
            </span>
            <span>
              <strong>来时路</strong>
              <small>MUSEUM OF BECOMING</small>
            </span>
          </button>
          <nav aria-label="主导航" className={menu ? 'open' : ''}>
            <button
              aria-current={route === '/museum' ? 'page' : undefined}
              onClick={() => go('/museum')}
            >
              展厅
            </button>
            <button
              aria-current={route === '/timeline' ? 'page' : undefined}
              onClick={() => go('/timeline')}
            >
              时间长廊
            </button>
            <button
              aria-current={route === '/settings' ? 'page' : undefined}
              onClick={() => go('/settings')}
            >
              数据与备份
            </button>
            <button className="primary nav-collect" onClick={begin}>
              <Plus size={16} /> 收藏一个瞬间
            </button>
          </nav>
          <button
            className="menu-toggle icon-button"
            aria-label={menu ? '关闭菜单' : '打开菜单'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <div className="mode-banner">
        <span>
          {preferences.mode === 'demo' ? (
            <>
              <span className="mode-dot" />
              演示展馆<span className="banner-divider">/</span>以下故事为虚构示例
            </>
          ) : (
            <>
              <span className="mode-dot personal" />
              我的展馆<span className="banner-divider">/</span>
              {temporary ? '临时模式，请导出备份' : '记录保存在当前浏览器'}
            </>
          )}
        </span>
        <button
          onClick={() =>
            preferences.mode === 'demo'
              ? preferences.initialized
                ? changeMode('personal')
                : setSetup(true)
              : changeMode('demo')
          }
        >
          {preferences.mode === 'demo'
            ? preferences.initialized
              ? '回到我的展馆'
              : '建立我的展馆'
            : '参观演示展馆'}
          <ChevronRight size={14} />
        </button>
      </div>
      {error && (
        <div className="global-error" role="alert">
          <span>{error}</span>
          <button className="icon-button" aria-label="关闭提示" onClick={() => setError('')}>
            <X size={18} />
          </button>
        </div>
      )}
      <div id="main-content" tabIndex={-1}>
        {loading ? (
          <main className="page loading">
            <Landmark size={32} />
            <p>正在打开这座展馆…</p>
          </main>
        ) : route === '/museum' ? (
          <main className="museum-page">
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <i /> A MUSEUM OF YOUR OWN
                </span>
                <h1 tabIndex={-1}>
                  {shown.owner.name} 的<br />
                  <span>来时路</span>
                </h1>
                <p className="hero-subtitle">那些走过的路，正在成为你。</p>
                <div className="hero-stats">
                  <span>
                    已收藏 <strong>{shown.exhibits.length}</strong> 个瞬间
                  </span>
                  <i />
                  <span>
                    <strong>{uniqueThemes}</strong> 个主题
                  </span>
                  <i />
                  <span>{yearRange}</span>
                </div>
                <div className="button-row">
                  <button
                    className="primary"
                    onClick={() =>
                      document.getElementById('collection')?.scrollIntoView({
                        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                          ? 'instant'
                          : 'smooth',
                      })
                    }
                  >
                    走进展厅 <ArrowUpRight size={17} />
                  </button>
                  <button className="text-button" onClick={random}>
                    <Shuffle size={16} />
                    {shown.exhibits.length ? '随便看看' : '看看演示'}
                  </button>
                </div>
              </div>
              <div
                className={`hero-gallery ${!featured.length ? 'empty-gallery' : ''}`}
                aria-hidden="true"
              >
                <div className="gallery-wall">
                  <div className="wall-arch" />
                  <span className="wall-label">
                    EVERY STEP
                    <br />
                    BECOMES YOU.
                  </span>
                </div>
                <div className="gallery-floor" />
                {(featured.length ? featured : [undefined]).map((e, i) => (
                  <div className={`hero-pedestal pedestal-${i}`} key={e?.id || 'empty'}>
                    {e && <Artifact kind={e.artifact} palette={e.palette} />}
                    <div className="pedestal-top" />
                    <div className="pedestal-face">
                      <span>{e ? String(i + 1).padStart(2, '0') : '01'}</span>
                    </div>
                    <div className="pedestal-side" />
                  </div>
                ))}
                <div className="gallery-caption">
                  <span>THE PERMANENT COLLECTION</span>
                  <small>
                    {featured.length
                      ? '每一件，都曾真实地改变过一个人。'
                      : '第一件藏品，不必是大事。'}
                  </small>
                </div>
              </div>
              <div className="hero-bottom">
                <span>关于积累，关于成为。</span>
                <span>
                  慢慢看，这里不赶时间。
                  <i />
                </span>
              </div>
            </section>
            <div className="page museum-sections">
              <section className="featured-section" aria-labelledby="featured-heading">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">THE HIGHLIGHTS</span>
                    <h2 id="featured-heading">
                      值得停留的{featured.length === 3 ? '三个' : ''}瞬间
                    </h2>
                  </div>
                  <p>有些时刻，值得被再一次看见。</p>
                </div>
                {featured.length ? (
                  <div className="card-grid">
                    {featured.map((e) => (
                      <Card
                        key={e.id}
                        exhibit={e}
                        index={shown.exhibits.indexOf(e)}
                        onOpen={openExhibit}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="featured-empty">
                    <Sparkles size={24} />
                    <div>
                      <h3>选一件你想先看见的事</h3>
                      <p>收藏或编辑一个瞬间时，勾选「放在展厅入口的精选展台」。</p>
                    </div>
                    <button className="secondary" onClick={begin}>
                      收藏一个瞬间
                    </button>
                  </div>
                )}
              </section>
              <section
                id="collection"
                className="collection-section"
                aria-labelledby="collection-heading"
              >
                <div className="section-head">
                  <div>
                    <span className="eyebrow">THE COLLECTION</span>
                    <h2 id="collection-heading">
                      每一步，都算数
                      <span className="count-label">{shown.exhibits.length} 件馆藏</span>
                    </h2>
                  </div>
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="搜索馆藏标题或故事"
                      placeholder="寻找一个瞬间…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="清除搜索"
                        onClick={() => setQuery('')}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                </div>
                <div className="theme-filters" aria-label="主题筛选">
                  <button
                    className={theme === 'all' ? 'selected' : ''}
                    aria-pressed={theme === 'all'}
                    onClick={() => setTheme('all')}
                  >
                    全部瞬间 <span>{shown.exhibits.length}</span>
                  </button>
                  {Object.entries(themes).map(([key, name]) => (
                    <button
                      key={key}
                      className={theme === key ? 'selected' : ''}
                      aria-pressed={theme === key}
                      onClick={() => setTheme(key as Theme)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {filtered.length ? (
                  <div className="card-grid collection-grid">
                    {filtered.map((e) => (
                      <Card
                        key={e.id}
                        exhibit={e}
                        index={shown.exhibits.indexOf(e)}
                        onOpen={openExhibit}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Artifact kind="crystal" palette="sage" className="empty-artifact" />
                    <h3>
                      {shown.exhibits.length
                        ? '换一个词，或走到另一个展区'
                        : '第一件藏品，不必是大事'}
                    </h3>
                    <p>
                      {shown.exhibits.length
                        ? '这一次没有找到对应的瞬间，其他故事还在这里。'
                        : '一个解决了的问题，一次重新开始，或一个认真陪伴的下午。'}
                    </p>
                    <div className="button-row">
                      {shown.exhibits.length ? (
                        <button
                          className="secondary"
                          onClick={() => {
                            setQuery('');
                            setTheme('all');
                          }}
                        >
                          清除筛选
                        </button>
                      ) : (
                        <>
                          <button className="primary" onClick={begin}>
                            收藏一个瞬间
                          </button>
                          <button className="text-button" onClick={() => changeMode('demo')}>
                            看看演示
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </section>
              <section className="museum-intro">
                <span className="intro-symbol">“</span>
                <p>
                  {shown.owner.introduction || '这里收藏着我做成的事，也收藏着它们让我成为的自己。'}
                </p>
                <span className="eyebrow">A NOTE FROM THE CURATOR · {shown.owner.name}</span>
              </section>
            </div>
          </main>
        ) : route === '/timeline' ? (
          <main className="page timeline-page">
            <div className="page-heading">
              <span className="eyebrow">A WALK THROUGH TIME</span>
              <h1 tabIndex={-1}>时间长廊</h1>
              <p>一路走来，这些时刻留下了痕迹。</p>
            </div>
            {all.length ? (
              <div className="timeline">
                {[...new Set(all.map((e) => e.occurredOn.slice(0, 4)))].map((year) => (
                  <section className="timeline-year" key={year}>
                    <div className="year-label">
                      <h2>{year}</h2>
                      <span>{all.filter((e) => e.occurredOn.startsWith(year)).length} 个瞬间</span>
                    </div>
                    <div className="year-stories">
                      {[
                        ...new Set(
                          all
                            .filter((e) => e.occurredOn.startsWith(year))
                            .map((e) => e.occurredOn.slice(0, 7)),
                        ),
                      ].map((month) => (
                        <section key={month} className="timeline-month">
                          <h3>{Number(month.slice(5))} 月</h3>
                          {all
                            .filter((e) => e.occurredOn.startsWith(month))
                            .map((e) => (
                              <button
                                key={e.id}
                                className="timeline-node"
                                onClick={() => openExhibit(e)}
                              >
                                <div className={`timeline-art scene-${e.palette}`}>
                                  <Artifact kind={e.artifact} palette={e.palette} />
                                </div>
                                <div>
                                  <span className="card-meta">
                                    {formatDate(e, true)} · {themes[e.theme]}
                                  </span>
                                  <h3>{e.title}</h3>
                                  <p>{e.summary || e.outcome}</p>
                                </div>
                                <ArrowUpRight size={20} />
                              </button>
                            ))}
                        </section>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h2>来时路，从一个瞬间开始</h2>
                <p>不必填满每个月，只留下你想记住的事。</p>
                <button className="primary" onClick={begin}>
                  收藏一个瞬间
                </button>
              </div>
            )}
          </main>
        ) : route === '/settings' ? (
          <Settings
            museum={museum}
            mode={preferences.mode}
            initialized={preferences.initialized}
            temporary={temporary}
            onSaveOwner={async (owner) => {
              await commit({ ...museum, owner });
            }}
            onRestore={async (next) => {
              await finishDraftWrites();
              await commit(next, { mode: 'personal', initialized: true }, true);
              draftRef.current = undefined;
              setDraft(undefined);
              setQuery('');
              setTheme('all');
            }}
            onExport={exportMuseum}
            onMode={(mode) => {
              void changeMode(mode);
            }}
            onSetup={() => setSetup(true)}
          />
        ) : isForm &&
          preferences.mode === 'personal' &&
          preferences.initialized &&
          (!route.startsWith('/edit/') ||
            museum.exhibits.some((e) => e.id === route.split('/')[2])) ? (
          <ExhibitForm
            key={route}
            initial={formInitial}
            museum={museum}
            onDraft={onDraft}
            onSave={saveExhibit}
            onLeave={() => go('/museum')}
            draftStatus={draftStatus}
          />
        ) : route.startsWith('/exhibit/') && exhibit ? (
          <main className="page detail-page">
            <div className="detail-toolbar">
              <button className="text-button back-button" onClick={() => go('/museum')}>
                〈 返回展厅
              </button>
              <span>
                {preferences.mode === 'demo' ? '虚构演示故事' : '我的私人馆藏'} · NO.{' '}
                {String(shown.exhibits.indexOf(exhibit) + 1).padStart(3, '0')}
              </span>
              {preferences.mode === 'personal' && (
                <div className="button-row">
                  <button className="text-button" onClick={() => edit(exhibit)}>
                    <Pencil size={15} /> 编辑
                  </button>
                  <button
                    className="icon-button"
                    aria-label="删除这件展品"
                    onClick={() => {
                      setDeleteError('');
                      setDeleting(exhibit);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="detail-grid">
              <aside className="detail-object">
                <div className="detail-stage">
                  <span className="eyebrow">
                    {artifacts[exhibit.artifact]} / {themes[exhibit.theme]}
                  </span>
                  <Artifact kind={exhibit.artifact} palette={exhibit.palette} />
                  <div className="stage-ring" />
                </div>
                <div className="detail-plaque">
                  <span>{formatDate(exhibit, true)}</span>
                  <h2>{exhibit.title}</h2>
                  {exhibit.summary && <p>{exhibit.summary}</p>}
                </div>
                <p className="detail-object-caption">每一段来时路，都有它独有的形状。</p>
              </aside>
              <article className="detail-story">
                <span className="eyebrow">THE STORY BEHIND THE OBJECT</span>
                <h1 tabIndex={-1}>{exhibit.title}</h1>
                <div className="story-meta">
                  <time dateTime={exhibit.occurredOn}>{formatDate(exhibit, true)}</time>
                  <span>{themes[exhibit.theme]}</span>
                  {shown.featuredIds.includes(exhibit.id) && (
                    <span className="featured-tag">
                      <Sparkles size={13} /> 精选藏品
                    </span>
                  )}
                </div>
                {(
                  [
                    ['context', '那时发生了什么'],
                    ['challenge', '难在哪里'],
                    ['actions', '我做了什么'],
                    ['outcome', '后来怎样了'],
                    ['meaning', '这件事留给了我什么'],
                  ] as const
                ).map(([key, name], i) => {
                  const content = exhibit[key];
                  if (!content || (Array.isArray(content) && !content.length)) return null;
                  return (
                    <section className="story-section" key={key}>
                      <div className="story-section-title">
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        <h2>{name}</h2>
                      </div>
                      {Array.isArray(content) ? (
                        <ol>
                          {content.map((line, n) => (
                            <li key={n}>{line}</li>
                          ))}
                        </ol>
                      ) : (
                        <p>{content}</p>
                      )}
                      {key === 'outcome' && exhibit.evidence.length > 0 && (
                        <div className="evidence-links">
                          {exhibit.evidence.map((v, n) =>
                            v.url ? (
                              <a key={n} href={v.url} target="_blank" rel="noopener noreferrer">
                                {v.label}
                                <ExternalLink size={14} />
                              </a>
                            ) : (
                              <span key={n}>{v.label}</span>
                            ),
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
                {exhibit.noteToSelf && (
                  <section className="letter">
                    <span className="eyebrow">TO MY PAST SELF</span>
                    <h2>给那时的自己</h2>
                    <p>{exhibit.noteToSelf}</p>
                    <span className="letter-sign">来自，走到这里的你</span>
                  </section>
                )}
                {exhibit.tags.length > 0 && (
                  <div className="tags">
                    {exhibit.tags.map((tag, i) => (
                      <span key={i}>#{tag}</span>
                    ))}
                  </div>
                )}
                <button className="text-button story-back" onClick={() => go('/museum')}>
                  〈 回到展厅，看看其他瞬间
                </button>
              </article>
            </div>
          </main>
        ) : (
          <main className="page empty-state not-found">
            <Landmark size={45} />
            <h1 tabIndex={-1}>{isForm ? '先建立属于你的展馆' : '当前浏览器没有这件藏品'}</h1>
            <p>
              {isForm
                ? '演示故事只读，你可以从一座空展馆开始收藏。'
                : '个人藏品保存在收藏它的浏览器中。你也可以用备份恢复它。'}
            </p>
            <div className="button-row">
              <button className="primary" onClick={() => (isForm ? setSetup(true) : go('/museum'))}>
                {isForm ? '建立我的展馆' : '返回展厅'}
              </button>
              <button className="secondary" onClick={() => go('/settings')}>
                导入备份
              </button>
            </div>
          </main>
        )}
      </div>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">来时路</span>
          <small>那些走过的路，正在成为你。</small>
        </div>
        <span>
          MUSEUM OF BECOMING<span className="footer-separator">/</span>慢慢成为自己
        </span>
        <button className="text-button" onClick={() => go('/settings')}>
          好好保存这些记忆 <ArrowUpRight size={14} />
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {setup && (
        <Modal title="为自己，开一座展馆" onClose={() => !setupBusy && setSetup(false)}>
          <p className="muted">从一座空展馆开始。演示里的故事会留在演示展馆，不计入你的经历。</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSetupError('');
              setSetupBusy(true);
              try {
                await commit(
                  { ...museum, owner: { name: ownerName.trim(), introduction: intro } },
                  { initialized: true, mode: 'personal' },
                );
                setSetup(false);
                setFormInitial(undefined);
                go('/museum', true);
                setToast('欢迎来到你的来时路。第一件藏品，不必是大事。');
              } catch {
                setSetupError('未能建立展馆。请重试，或检查浏览器存储权限。');
              } finally {
                setSetupBusy(false);
              }
            }}
          >
            <label htmlFor="setup-name">馆主名</label>
            <input
              id="setup-name"
              required
              maxLength={40}
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
            <label htmlFor="setup-intro">
              馆序 <span className="optional">可选</span>
            </label>
            <textarea
              id="setup-intro"
              maxLength={1000}
              rows={3}
              placeholder="你想写给这座展馆的话…"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
            />
            {setupError && (
              <p className="error-message" role="alert">
                {setupError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={setupBusy}
                onClick={() => setSetup(false)}
              >
                再参观一会儿
              </button>
              <button className="primary" disabled={setupBusy}>
                {setupBusy ? '正在建立…' : '建立我的展馆'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {resume && (
        <Modal title="有一个瞬间，还等着你" onClose={() => setResume(false)}>
          <p>
            上次留下的{draft?.editingId ? '编辑' : '新建'}草稿：
            <strong>{draft?.exhibit.title || '尚未命名的瞬间'}</strong>
          </p>
          <p className="muted">它还没有收入正式馆藏。你可以接着写，或丢弃草稿后重新收藏。</p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await discardDraft();
                  setResume(false);
                  setFormInitial(undefined);
                  go('/new', true);
                } catch {
                  setError('未能丢弃草稿，请重试。');
                }
              }}
            >
              丢弃并新建
            </button>
            <button
              className="primary"
              onClick={() => {
                setFormInitial(draft);
                setResume(false);
                go(draft?.editingId ? `/edit/${draft.editingId}` : '/new', true);
              }}
            >
              继续这个瞬间
            </button>
          </div>
        </Modal>
      )}
      {leaving && (
        <Modal
          title="这个瞬间，还没有收入馆藏"
          onClose={() => {
            setLeaving(undefined);
            setPendingMode(undefined);
          }}
        >
          <p className="muted">
            {temporary
              ? '临时模式的草稿只能保留在本次打开期间。请先下载草稿，再离开页面。'
              : '保留草稿，下次可以接着写。正式馆藏不会因此增加。'}
          </p>
          {temporary && draft && (
            <button
              className="text-button"
              onClick={() =>
                downloadFile('来时路-临时草稿.txt', JSON.stringify(draft, null, 2), 'text/plain')
              }
            >
              <Download size={16} /> 下载当前草稿
            </button>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="leave-options">
            <button
              className="primary"
              onClick={async () => {
                try {
                  await saveDraftNow();
                  const next = leaving;
                  setLeaving(undefined);
                  draftRef.current = undefined;
                  if (pendingMode) {
                    const mode = pendingMode;
                    setPendingMode(undefined);
                    await changeMode(mode, true);
                  } else go(next, true);
                } catch {
                  setError('草稿未能保存，请继续填写或下载草稿后再离开。');
                }
              }}
            >
              保留草稿并离开
            </button>
            <button
              className="secondary"
              onClick={() => {
                setLeaving(undefined);
                setPendingMode(undefined);
              }}
            >
              继续填写
            </button>
            <button
              className="text-button danger-text"
              onClick={async () => {
                try {
                  await discardDraft();
                  const next = leaving;
                  setLeaving(undefined);
                  if (pendingMode) {
                    const mode = pendingMode;
                    setPendingMode(undefined);
                    await changeMode(mode, true);
                  } else go(next, true);
                } catch {
                  setError('未能丢弃草稿，请重试。');
                }
              }}
            >
              丢弃草稿并离开
            </button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="让这件藏品离开展馆？" onClose={() => !deleteBusy && setDeleting(undefined)}>
          <p>「{deleting.title}」将从馆藏和精选展台中移除。</p>
          <p className="muted">如果还想保留它，可以先导出一份备份。</p>
          {deleteError && (
            <p className="error-message" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal-actions">
            <button className="secondary" disabled={deleteBusy} onClick={exportMuseum}>
              <Download size={16} /> 先备份
            </button>
            <button
              className="danger-button"
              disabled={deleteBusy}
              onClick={async () => {
                setDeleteBusy(true);
                try {
                  await commit({
                    ...museum,
                    exhibits: museum.exhibits.filter((e) => e.id !== deleting.id),
                    featuredIds: museum.featuredIds.filter((id) => id !== deleting.id),
                  });
                  setDeleting(undefined);
                  go('/museum');
                  setToast('藏品已移除。');
                } catch {
                  setDeleteError('删除未能保存，原藏品仍在。请重试。');
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? '正在移除…' : '确认删除'}
            </button>
          </div>
        </Modal>
      )}
      {reveal && (
        <Modal title="这一刻，值得留下。" wide onClose={() => setReveal(undefined)}>
          <div className="unveiling">
            <span className="eyebrow">NOW PART OF YOUR STORY</span>
            <div className={`reveal-scene scene-${reveal.palette}`}>
              <Artifact kind={reveal.artifact} palette={reveal.palette} />
              <div className="reveal-ring" />
            </div>
            <div className="reveal-plaque">
              <span>
                {formatDate(reveal, true)} · {themes[reveal.theme]}
              </span>
              <h2>{reveal.title}</h2>
              <p>{reveal.summary || reveal.outcome}</p>
            </div>
            <p className="unveiling-caption">
              {temporary
                ? '已收入临时馆藏，请及时导出备份。'
                : '它已经在这里了。你可以随时回来，看看自己走过的路。'}
            </p>
            <div className="button-row">
              <button
                className="primary"
                onClick={() => {
                  setReveal(undefined);
                  document.querySelector<HTMLElement>('main h1')?.focus();
                }}
              >
                走近看看
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setReveal(undefined);
                  go('/museum');
                }}
              >
                回到展厅
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
