import { useState, useMemo, useEffect } from 'react';
import { Divider, Modal } from 'animal-island-ui';
import { createBangumiClient } from 'bangumi-api-client';
import type { Subject, Episode, RelatedCharacter, RelatedPerson } from 'bangumi-api-client';
import {
  type WatchStatus,
  loadEntriesByStatus,
  setWatchEntry,
  removeWatchEntry,
  loadStatusMap,
} from '../store/watchStore';

const bgm = createBangumiClient({ userAgent: 'MikanBox/0.1.0' });

const _today = new Date();
const todayStr = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`;

const PLATFORMS = ['TV', 'WEB', 'OVA', '剧场版', '动态漫画', '其他'];
const SOURCES = ['原创', '漫画改', '游戏改', '小说改', '动画改', '影视改'];
const GENRES = [
  '科幻',
  '喜剧',
  '同人',
  '百合',
  '校园',
  '惊悚',
  '后宫',
  '机战',
  '悬疑',
  '恋爱',
  '奇幻',
  '推理',
  '运动',
  '耽美',
  '音乐',
  '战斗',
  '冒险',
  '萌系',
  '穿越',
  '玄幻',
  '乙女',
  '恐怖',
  '历史',
  '日常',
  '剧情',
  '武侠',
  '美食',
  '职场',
];
const REGIONS = [
  '日本',
  '欧美',
  '中国',
  '美国',
  '法国',
  '韩国',
  '英国',
  '中国香港',
  '俄罗斯',
  '苏联',
  '捷克',
  '中国台湾',
  '马来西亚',
];
const AUDIENCES = ['BL', 'GL', '子供向', '女性向', '少女向', '少年向', '青年向'];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DAY_JP = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

interface WatchListPageProps {
  status: WatchStatus;
  isActive?: boolean;
  layout?: 'list' | 'grid' | 'weekday';
}

export default function WatchListPage({ status, isActive, layout = 'list' }: WatchListPageProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [watchStatus, setWatchStatus] = useState<Record<number, WatchStatus>>({});
  const [viewMode, setViewMode] = useState<'weekday' | 'grid'>(
    layout === 'weekday' ? 'weekday' : 'grid',
  );

  // Detail panel state
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [characters, setCharacters] = useState<RelatedCharacter[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [persons, setPersons] = useState<RelatedPerson[]>([]);
  const [personsLoading, setPersonsLoading] = useState(false);
  const [showPersons, setShowPersons] = useState(false);

  // 切换到本页时（isActive 变为 true）再从 localStorage 加载
  useEffect(() => {
    if (!isActive) return;

    const entries = loadEntriesByStatus(status);
    setSubjects(entries.map((e) => e.subject));
    setWatchStatus(loadStatusMap());
    setSelectedId(null);

    if (entries.length === 0) return;

    // Background refresh
    setRefreshing(true);
    let cancelled = false;

    (async () => {
      const refreshed: Subject[] = [];
      for (const entry of entries) {
        if (cancelled) break;
        try {
          const res = await bgm.subjects.getSubjectById(entry.subject.id);
          if (res.data) {
            refreshed.push(res.data);
            setWatchEntry(res.data, entry.status);
          } else {
            refreshed.push(entry.subject);
          }
        } catch {
          refreshed.push(entry.subject);
        }
      }
      if (!cancelled) {
        setSubjects(refreshed);
        setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, isActive]);

  const selectedItem = useMemo(
    () => subjects.find((s) => s.id === selectedId) ?? null,
    [subjects, selectedId],
  );

  const detailTags = useMemo(() => {
    if (!selectedItem) return [];
    const tagNames = new Set(selectedItem.tags.map((t) => t.name));
    const knownTags = new Set([...AUDIENCES, ...REGIONS, ...SOURCES, ...GENRES, ...PLATFORMS]);
    const ordered: string[] = [];
    AUDIENCES.forEach((a) => {
      if (tagNames.has(a)) ordered.push(a);
    });
    REGIONS.forEach((r) => {
      if (tagNames.has(r)) ordered.push(r);
    });
    SOURCES.forEach((s) => {
      if (tagNames.has(s)) ordered.push(s);
    });
    GENRES.forEach((g) => {
      if (tagNames.has(g)) ordered.push(g);
    });
    PLATFORMS.forEach((p) => {
      if (tagNames.has(p)) ordered.push(p);
    });
    selectedItem.tags.forEach((t) => {
      if (!knownTags.has(t.name)) ordered.push(t.name);
    });
    return ordered;
  }, [selectedItem]);

  function handleWatchStatusChange(label: WatchStatus | '无状态') {
    if (!selectedItem) return;
    if (label === '无状态') {
      removeWatchEntry(selectedItem.id);
      setWatchStatus((prev) => {
        const next = { ...prev };
        delete next[selectedItem.id];
        return next;
      });
      setSubjects((prev) => prev.filter((s) => s.id !== selectedItem.id));
      setSelectedId(null);
    } else if (label !== status) {
      // Move to another status
      setWatchEntry(selectedItem, label);
      setWatchStatus((prev) => ({ ...prev, [selectedItem.id]: label }));
      setSubjects((prev) => prev.filter((s) => s.id !== selectedItem.id));
      setSelectedId(null);
    }
    // Same status: do nothing (already marked)
  }

  // Episodes
  useEffect(() => {
    if (!selectedId) {
      setEpisodes([]);
      setEpisodesLoading(false);
      return;
    }
    let cancelled = false;
    setEpisodes([]);
    setEpisodesLoading(true);
    bgm.episodes
      .getEpisodes(selectedId, { limit: 200 })
      .then(({ data }) => {
        if (!cancelled) {
          setEpisodes(data?.data ?? []);
          setEpisodesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEpisodes([]);
          setEpisodesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Characters
  useEffect(() => {
    if (!selectedId) {
      setCharacters([]);
      setCharactersLoading(false);
      return;
    }
    let cancelled = false;
    setCharacters([]);
    setCharactersLoading(true);
    bgm.subjects
      .getRelatedCharactersBySubjectId(selectedId)
      .then(({ data }) => {
        if (!cancelled) {
          setCharacters(data ?? []);
          setCharactersLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCharacters([]);
          setCharactersLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Persons
  useEffect(() => {
    if (!selectedId) {
      setPersons([]);
      setPersonsLoading(false);
      return;
    }
    let cancelled = false;
    setPersons([]);
    setPersonsLoading(true);
    bgm.subjects
      .getRelatedPersonsBySubjectId(selectedId)
      .then(({ data }) => {
        if (!cancelled) {
          setPersons(data ?? []);
          setPersonsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersons([]);
          setPersonsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // ── 按星期分组（必须在 early return 前调用，遵守 Hooks 规则）──
  const weekdayGroups = useMemo(() => {
    const groups: Record<number, typeof subjects> = {};
    const unknown: typeof subjects = [];
    subjects.forEach((s) => {
      if (!s.date || s.date === '0000-00-00') {
        unknown.push(s);
        return;
      }
      const d = new Date(s.date).getDay();
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return { groups, unknown };
  }, [subjects]);

  if (subjects.length === 0 && !refreshing) {
    return (
      <div className="watchlist-empty">
        <span>暂无{status}的番剧，去季度查询页面标记吧～</span>
      </div>
    );
  }

  // ── 按星期布局（正在追番等）──
  if (layout === 'weekday') {
    const renderCards = (items: typeof subjects) =>
      items.map((item) => (
        <div key={item.id} className="finished-card" onClick={() => setSelectedId(item.id)}>
          <div className="finished-card-cover">
            <img
              src={item.images.large || item.images.medium}
              alt={item.name_cn || item.name}
              loading="lazy"
            />
          </div>
          <div className="finished-card-info">
            <span className="finished-card-title">{item.name_cn || item.name}</span>
            <div className="finished-card-meta">
              {item.date && <span className="finished-card-date">{item.date}</span>}
              {item.rating.score > 0 && (
                <span className="finished-card-score">★ {item.rating.score.toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>
      ));

    return (
      <>
        <div className="finished-page">
          <div className="watchlist-view-toggle">
            <button
              className={`watchlist-view-btn${viewMode === 'weekday' ? ' watchlist-view-btn--active' : ''}`}
              onClick={() => setViewMode('weekday')}
            >
              按星期
            </button>
            <button
              className={`watchlist-view-btn${viewMode === 'grid' ? ' watchlist-view-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              全部
            </button>
          </div>
          {refreshing && <div className="watchlist-refreshing">正在后台更新数据…</div>}
          {viewMode === 'grid' ? (
            <div className="finished-grid">{renderCards(subjects)}</div>
          ) : (
            <>
              {DAY_ORDER.map((day) => {
                const items = weekdayGroups.groups[day] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={day} className="watchlist-weekday-section">
                    <div className="watchlist-weekday-header">
                      <span className="watchlist-weekday-cn">{DAY_CN[day]}</span>
                      <span className="watchlist-weekday-jp">{DAY_JP[day]}</span>
                    </div>
                    <div className="finished-grid">{renderCards(items)}</div>
                  </div>
                );
              })}
              {weekdayGroups.unknown.length > 0 && (
                <div className="watchlist-weekday-section">
                  <div className="watchlist-weekday-header">
                    <span className="watchlist-weekday-cn">未知日期</span>
                  </div>
                  <div className="finished-grid">{renderCards(weekdayGroups.unknown)}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 详情弹窗 ── */}
        {selectedItem && (
          <Modal
            open
            title={selectedItem.name_cn || selectedItem.name}
            onClose={() => setSelectedId(null)}
            footer={null}
            typewriter={false}
            width={720}
            maskClosable
          >
            <div className="finished-modal-detail">
              <div className="finished-modal-top">
                <img
                  className="query-detail-img"
                  src={selectedItem.images.large || selectedItem.images.medium}
                  alt={selectedItem.name_cn || selectedItem.name}
                />
                <div className="query-detail-basic">
                  {selectedItem.name_cn && selectedItem.name !== selectedItem.name_cn && (
                    <p className="query-detail-sub-title">{selectedItem.name}</p>
                  )}
                  <div className="query-detail-watch-status">
                    {(['无状态', '正在追番', '补番计划', '已完番剧'] as const).map((label) => (
                      <button
                        key={label}
                        className={`query-detail-watch-btn${(watchStatus[selectedItem.id] ?? '无状态') === label ? ' query-detail-watch-btn--active' : ''}`}
                        onClick={() => handleWatchStatusChange(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="query-detail-tags">
                    {selectedItem.date && (
                      <span className="query-detail-tag query-detail-tag--date">
                        {selectedItem.date}
                      </span>
                    )}
                    {detailTags.map((tag) => (
                      <span key={tag} className="query-detail-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {(episodes.length > 0 || episodesLoading) && (
                    <div className="query-detail-ep-row">
                      <span className="query-detail-ep-label">章节列表：</span>
                      {episodesLoading ? (
                        <span className="query-detail-ep-loading">加载中…</span>
                      ) : (
                        episodes.map((ep) => {
                          const validAirdate = !!ep.airdate && ep.airdate !== '0000-00-00';
                          const aired =
                            ep.comment > 0 ||
                            (validAirdate && ep.airdate <= todayStr) ||
                            (!validAirdate && !!selectedItem.date && selectedItem.date <= todayStr);
                          const typePrefix: Record<number, string> = {
                            1: 'SP',
                            2: 'OP',
                            3: 'ED',
                            4: 'PV',
                          };
                          const prefix = typePrefix[ep.type] ?? '';
                          const num = ep.sort % 1 === 0 ? String(ep.sort) : ep.sort.toFixed(1);
                          return (
                            <span
                              key={ep.id}
                              className={`query-detail-ep-pill${aired ? ' query-detail-ep-pill--aired' : ''}`}
                              title={ep.name_cn || ep.name || undefined}
                            >
                              {prefix}
                              {num}
                            </span>
                          );
                        })
                      )}
                    </div>
                  )}
                  <div className="query-detail-links">
                    <button
                      className="query-detail-link-btn"
                      onClick={() => setShowCharacters(true)}
                    >
                      角色
                      {charactersLoading
                        ? '…'
                        : characters.length > 0
                          ? `（${characters.length}）`
                          : ''}
                    </button>
                    <button className="query-detail-link-btn" onClick={() => setShowPersons(true)}>
                      演职人员
                      {personsLoading ? '…' : persons.length > 0 ? `（${persons.length}）` : ''}
                    </button>
                  </div>
                  {selectedItem.rating.score > 0 && (
                    <span className="query-detail-score">
                      ★ {selectedItem.rating.score.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <Divider type="wave-yellow" />
              <div className="finished-modal-summary">
                {selectedItem.summary && (
                  <p className="query-detail-summary">{selectedItem.summary}</p>
                )}
              </div>
            </div>
          </Modal>
        )}

        <Modal
          open={showCharacters}
          title="角色"
          onClose={() => setShowCharacters(false)}
          footer={null}
          typewriter={false}
          width={680}
          maskClosable
        >
          {charactersLoading ? (
            <p className="modal-loading">加载中…</p>
          ) : (
            <div className="modal-character-scroll">
              <div className="modal-character-grid">
                {characters.map((ch) => (
                  <div key={ch.id} className="modal-character-card">
                    {ch.images?.medium && (
                      <img className="modal-character-img" src={ch.images.medium} alt={ch.name} />
                    )}
                    <div className="modal-character-info">
                      <span className="modal-character-name">{ch.name}</span>
                      <span className="modal-character-relation">{ch.relation}</span>
                      {ch.actors && ch.actors.length > 0 && (
                        <span className="modal-character-cv">
                          CV：{ch.actors.map((a) => a.name).join(' / ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={showPersons}
          title="演职人员"
          onClose={() => setShowPersons(false)}
          footer={null}
          typewriter={false}
          width={600}
          maskClosable
        >
          {personsLoading ? (
            <p className="modal-loading">加载中…</p>
          ) : (
            <div className="modal-person-scroll">
              <div className="modal-person-list">
                {persons.map((p) => (
                  <div key={p.id} className="modal-person-row">
                    {p.images?.medium && (
                      <img className="modal-person-img" src={p.images.medium} alt={p.name} />
                    )}
                    <div className="modal-person-info">
                      <span className="modal-person-name">{p.name}</span>
                      <span className="modal-person-relation">{p.relation}</span>
                      {p.eps && <span className="modal-person-eps">{p.eps}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      </>
    );
  }

  // ── 网格布局（补番计划等）──
  if (layout === 'grid') {
    return (
      <>
        <div className="finished-page">
          {refreshing && <div className="watchlist-refreshing">正在后台更新数据…</div>}
          <div className="finished-grid">
            {subjects.map((item) => (
              <div key={item.id} className="finished-card" onClick={() => setSelectedId(item.id)}>
                <div className="finished-card-cover">
                  <img
                    src={item.images.large || item.images.medium}
                    alt={item.name_cn || item.name}
                    loading="lazy"
                  />
                </div>
                <div className="finished-card-info">
                  <span className="finished-card-title">{item.name_cn || item.name}</span>
                  <div className="finished-card-meta">
                    {item.date && <span className="finished-card-date">{item.date}</span>}
                    {item.rating.score > 0 && (
                      <span className="finished-card-score">★ {item.rating.score.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 详情弹窗 ── */}
        {selectedItem && (
          <Modal
            open
            title={selectedItem.name_cn || selectedItem.name}
            onClose={() => setSelectedId(null)}
            footer={null}
            typewriter={false}
            width={720}
            maskClosable
          >
            <div className="finished-modal-detail">
              <div className="finished-modal-top">
                <img
                  className="query-detail-img"
                  src={selectedItem.images.large || selectedItem.images.medium}
                  alt={selectedItem.name_cn || selectedItem.name}
                />
                <div className="query-detail-basic">
                  {selectedItem.name_cn && selectedItem.name !== selectedItem.name_cn && (
                    <p className="query-detail-sub-title">{selectedItem.name}</p>
                  )}
                  <div className="query-detail-watch-status">
                    {(['无状态', '正在追番', '补番计划', '已完番剧'] as const).map((label) => (
                      <button
                        key={label}
                        className={`query-detail-watch-btn${
                          (watchStatus[selectedItem.id] ?? '无状态') === label
                            ? ' query-detail-watch-btn--active'
                            : ''
                        }`}
                        onClick={() => handleWatchStatusChange(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="query-detail-tags">
                    {selectedItem.date && (
                      <span className="query-detail-tag query-detail-tag--date">
                        {selectedItem.date}
                      </span>
                    )}
                    {detailTags.map((tag) => (
                      <span key={tag} className="query-detail-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {(episodes.length > 0 || episodesLoading) && (
                    <div className="query-detail-ep-row">
                      <span className="query-detail-ep-label">章节列表：</span>
                      {episodesLoading ? (
                        <span className="query-detail-ep-loading">加载中…</span>
                      ) : (
                        episodes.map((ep) => {
                          const validAirdate = !!ep.airdate && ep.airdate !== '0000-00-00';
                          const aired =
                            ep.comment > 0 ||
                            (validAirdate && ep.airdate <= todayStr) ||
                            (!validAirdate && !!selectedItem.date && selectedItem.date <= todayStr);
                          const typePrefix: Record<number, string> = {
                            1: 'SP',
                            2: 'OP',
                            3: 'ED',
                            4: 'PV',
                          };
                          const prefix = typePrefix[ep.type] ?? '';
                          const num = ep.sort % 1 === 0 ? String(ep.sort) : ep.sort.toFixed(1);
                          return (
                            <span
                              key={ep.id}
                              className={`query-detail-ep-pill${aired ? ' query-detail-ep-pill--aired' : ''}`}
                              title={ep.name_cn || ep.name || undefined}
                            >
                              {prefix}
                              {num}
                            </span>
                          );
                        })
                      )}
                    </div>
                  )}
                  <div className="query-detail-links">
                    <button
                      className="query-detail-link-btn"
                      onClick={() => setShowCharacters(true)}
                    >
                      角色
                      {charactersLoading
                        ? '…'
                        : characters.length > 0
                          ? `（${characters.length}）`
                          : ''}
                    </button>
                    <button className="query-detail-link-btn" onClick={() => setShowPersons(true)}>
                      演职人员
                      {personsLoading ? '…' : persons.length > 0 ? `（${persons.length}）` : ''}
                    </button>
                  </div>
                  {selectedItem.rating.score > 0 && (
                    <span className="query-detail-score">
                      ★ {selectedItem.rating.score.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              <Divider type="wave-yellow" />
              <div className="finished-modal-summary">
                {selectedItem.summary && (
                  <p className="query-detail-summary">{selectedItem.summary}</p>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* ── 角色弹窗 ── */}
        <Modal
          open={showCharacters}
          title="角色"
          onClose={() => setShowCharacters(false)}
          footer={null}
          typewriter={false}
          width={680}
          maskClosable
        >
          {charactersLoading ? (
            <p className="modal-loading">加载中…</p>
          ) : (
            <div className="modal-character-scroll">
              <div className="modal-character-grid">
                {characters.map((ch) => (
                  <div key={ch.id} className="modal-character-card">
                    {ch.images?.medium && (
                      <img className="modal-character-img" src={ch.images.medium} alt={ch.name} />
                    )}
                    <div className="modal-character-info">
                      <span className="modal-character-name">{ch.name}</span>
                      <span className="modal-character-relation">{ch.relation}</span>
                      {ch.actors && ch.actors.length > 0 && (
                        <span className="modal-character-cv">
                          CV：{ch.actors.map((a) => a.name).join(' / ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>

        {/* ── 演职人员弹窗 ── */}
        <Modal
          open={showPersons}
          title="演职人员"
          onClose={() => setShowPersons(false)}
          footer={null}
          typewriter={false}
          width={600}
          maskClosable
        >
          {personsLoading ? (
            <p className="modal-loading">加载中…</p>
          ) : (
            <div className="modal-person-scroll">
              <div className="modal-person-list">
                {persons.map((p) => (
                  <div key={p.id} className="modal-person-row">
                    {p.images?.medium && (
                      <img className="modal-person-img" src={p.images.medium} alt={p.name} />
                    )}
                    <div className="modal-person-info">
                      <span className="modal-person-name">{p.name}</span>
                      <span className="modal-person-relation">{p.relation}</span>
                      {p.eps && <span className="modal-person-eps">{p.eps}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      </>
    );
  }

  return (
    <>
      <div className="query-page">
        <div className="query-results">
          {/* ── 左侧列表 ── */}
          <div className="query-results-left">
            {refreshing && <div className="watchlist-refreshing">正在后台更新数据…</div>}
            {subjects.map((item) => (
              <div
                key={item.id}
                className={`query-result-card${selectedId === item.id ? ' query-result-card--selected' : ''}`}
                onClick={() => setSelectedId(item.id)}
              >
                <img
                  className="query-result-img"
                  src={item.images.medium}
                  alt={item.name_cn || item.name}
                  loading="lazy"
                />
                <div className="query-result-info">
                  <span className="query-result-cn">{item.name_cn || item.name}</span>
                  {item.rating.score > 0 && (
                    <span className="query-result-score">★ {item.rating.score.toFixed(1)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── 右侧详情 ── */}
          <div className="query-results-right">
            {selectedItem && (
              <div className="query-detail">
                <div className="query-detail-fixed">
                  <img
                    className="query-detail-img"
                    src={selectedItem.images.large || selectedItem.images.medium}
                    alt={selectedItem.name_cn || selectedItem.name}
                  />
                  <div className="query-detail-basic">
                    <h2 className="query-detail-main-title">
                      {selectedItem.name_cn || selectedItem.name}
                    </h2>
                    {selectedItem.name_cn && selectedItem.name !== selectedItem.name_cn && (
                      <p className="query-detail-sub-title">{selectedItem.name}</p>
                    )}

                    {/* 追番状态 */}
                    <div className="query-detail-watch-status">
                      {(['无状态', '正在追番', '补番计划', '已完番剧'] as const).map((label) => (
                        <button
                          key={label}
                          className={`query-detail-watch-btn${
                            (watchStatus[selectedItem.id] ?? '无状态') === label
                              ? ' query-detail-watch-btn--active'
                              : ''
                          }`}
                          onClick={() => handleWatchStatusChange(label)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* 标签 */}
                    <div className="query-detail-tags">
                      {selectedItem.date && (
                        <span className="query-detail-tag query-detail-tag--date">
                          {selectedItem.date}
                        </span>
                      )}
                      {detailTags.map((tag) => (
                        <span key={tag} className="query-detail-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* 章节列表 */}
                    {(episodes.length > 0 || episodesLoading) && (
                      <div className="query-detail-ep-row">
                        <span className="query-detail-ep-label">章节列表：</span>
                        {episodesLoading ? (
                          <span className="query-detail-ep-loading">加载中…</span>
                        ) : (
                          episodes.map((ep) => {
                            const validAirdate = !!ep.airdate && ep.airdate !== '0000-00-00';
                            const aired =
                              ep.comment > 0 ||
                              (validAirdate && ep.airdate <= todayStr) ||
                              (!validAirdate &&
                                !!selectedItem.date &&
                                selectedItem.date <= todayStr);
                            const typePrefix: Record<number, string> = {
                              1: 'SP',
                              2: 'OP',
                              3: 'ED',
                              4: 'PV',
                            };
                            const prefix = typePrefix[ep.type] ?? '';
                            const num = ep.sort % 1 === 0 ? String(ep.sort) : ep.sort.toFixed(1);
                            return (
                              <span
                                key={ep.id}
                                className={`query-detail-ep-pill${aired ? ' query-detail-ep-pill--aired' : ''}`}
                                title={ep.name_cn || ep.name || undefined}
                              >
                                {prefix}
                                {num}
                              </span>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* 角色 / 演职人员 */}
                    <div className="query-detail-links">
                      <button
                        className="query-detail-link-btn"
                        onClick={() => setShowCharacters(true)}
                      >
                        角色
                        {charactersLoading
                          ? '…'
                          : characters.length > 0
                            ? `（${characters.length}）`
                            : ''}
                      </button>
                      <button
                        className="query-detail-link-btn"
                        onClick={() => setShowPersons(true)}
                      >
                        演职人员
                        {personsLoading ? '…' : persons.length > 0 ? `（${persons.length}）` : ''}
                      </button>
                    </div>

                    {selectedItem.rating.score > 0 && (
                      <span className="query-detail-score">
                        ★ {selectedItem.rating.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                <Divider type="wave-yellow" />

                <div className="query-detail-scroll">
                  {selectedItem.summary && (
                    <p className="query-detail-summary">{selectedItem.summary}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 角色弹窗 */}
      <Modal
        open={showCharacters}
        title="角色"
        onClose={() => setShowCharacters(false)}
        footer={null}
        typewriter={false}
        width={680}
        maskClosable
      >
        {charactersLoading ? (
          <p className="modal-loading">加载中…</p>
        ) : (
          <div className="modal-character-scroll">
            <div className="modal-character-grid">
              {characters.map((ch) => (
                <div key={ch.id} className="modal-character-card">
                  {ch.images?.medium && (
                    <img className="modal-character-img" src={ch.images.medium} alt={ch.name} />
                  )}
                  <div className="modal-character-info">
                    <span className="modal-character-name">{ch.name}</span>
                    <span className="modal-character-relation">{ch.relation}</span>
                    {ch.actors && ch.actors.length > 0 && (
                      <span className="modal-character-cv">
                        CV：{ch.actors.map((a) => a.name).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 演职人员弹窗 */}
      <Modal
        open={showPersons}
        title="演职人员"
        onClose={() => setShowPersons(false)}
        footer={null}
        typewriter={false}
        width={600}
        maskClosable
      >
        {personsLoading ? (
          <p className="modal-loading">加载中…</p>
        ) : (
          <div className="modal-person-scroll">
            <div className="modal-person-list">
              {persons.map((p) => (
                <div key={p.id} className="modal-person-row">
                  {p.images?.medium && (
                    <img className="modal-person-img" src={p.images.medium} alt={p.name} />
                  )}
                  <div className="modal-person-info">
                    <span className="modal-person-name">{p.name}</span>
                    <span className="modal-person-relation">{p.relation}</span>
                    {p.eps && <span className="modal-person-eps">{p.eps}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
