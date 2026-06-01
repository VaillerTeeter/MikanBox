import { useState, useEffect, useMemo } from 'react';
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

interface Props {
  isActive?: boolean;
}

export default function FinishedPage({ isActive }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 详情弹窗
  const [selectedItem, setSelectedItem] = useState<Subject | null>(null);
  const [watchStatus, setWatchStatus] = useState<Record<number, WatchStatus>>({});
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [characters, setCharacters] = useState<RelatedCharacter[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [persons, setPersons] = useState<RelatedPerson[]>([]);
  const [personsLoading, setPersonsLoading] = useState(false);
  const [showPersons, setShowPersons] = useState(false);

  // 每次激活重读 localStorage，后台刷新
  useEffect(() => {
    if (!isActive) return;
    const entries = loadEntriesByStatus('已完番剧');
    setSubjects(entries.map((e) => e.subject));
    setWatchStatus(loadStatusMap());

    if (entries.length === 0) return;
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
            setWatchEntry(res.data, '已完番剧');
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
  }, [isActive]);

  // 按上映日期降序
  const sorted = useMemo(
    () =>
      [...subjects].sort((a, b) => {
        const da = a.date ?? '';
        const db = b.date ?? '';
        return db > da ? 1 : db < da ? -1 : 0;
      }),
    [subjects],
  );

  // 详情标签排序
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

  // 章节
  useEffect(() => {
    if (!selectedItem) {
      setEpisodes([]);
      setEpisodesLoading(false);
      return;
    }
    let cancelled = false;
    setEpisodes([]);
    setEpisodesLoading(true);
    bgm.episodes
      .getEpisodes(selectedItem.id, { limit: 200 })
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
  }, [selectedItem?.id]);

  // 角色
  useEffect(() => {
    if (!selectedItem) {
      setCharacters([]);
      setCharactersLoading(false);
      return;
    }
    let cancelled = false;
    setCharacters([]);
    setCharactersLoading(true);
    bgm.subjects
      .getRelatedCharactersBySubjectId(selectedItem.id)
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
  }, [selectedItem?.id]);

  // 演职人员
  useEffect(() => {
    if (!selectedItem) {
      setPersons([]);
      setPersonsLoading(false);
      return;
    }
    let cancelled = false;
    setPersons([]);
    setPersonsLoading(true);
    bgm.subjects
      .getRelatedPersonsBySubjectId(selectedItem.id)
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
  }, [selectedItem?.id]);

  function handleWatchStatusChange(label: WatchStatus | '无状态') {
    if (!selectedItem) return;
    if (label === '无状态') {
      removeWatchEntry(selectedItem.id);
      setWatchStatus((prev) => {
        const n = { ...prev };
        delete n[selectedItem.id];
        return n;
      });
      setSubjects((prev) => prev.filter((s) => s.id !== selectedItem.id));
      setSelectedItem(null);
    } else if (label !== '已完番剧') {
      setWatchEntry(selectedItem, label);
      setWatchStatus((prev) => ({ ...prev, [selectedItem.id]: label }));
      setSubjects((prev) => prev.filter((s) => s.id !== selectedItem.id));
      setSelectedItem(null);
    }
  }

  if (sorted.length === 0 && !refreshing) {
    return (
      <div className="watchlist-empty">
        <span>暂无已完番剧，去季度查询页面标记吧～</span>
      </div>
    );
  }

  return (
    <>
      <div className="finished-page">
        {refreshing && <div className="watchlist-refreshing">正在后台更新数据…</div>}
        <div className="finished-grid">
          {sorted.map((item) => (
            <div key={item.id} className="finished-card" onClick={() => setSelectedItem(item)}>
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
          onClose={() => setSelectedItem(null)}
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
                {/* 角色 / 演职人员 */}
                <div className="query-detail-links">
                  <button className="query-detail-link-btn" onClick={() => setShowCharacters(true)}>
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
