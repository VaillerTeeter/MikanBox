import { useState, useMemo, useEffect } from 'react';
import { Select, Button, Divider, Modal } from 'animal-island-ui';
import { createBangumiClient } from 'bangumi-api-client';
import type { Subject, Episode, RelatedCharacter, RelatedPerson } from 'bangumi-api-client';
import {
  type WatchStatus,
  loadStatusMap,
  setWatchEntry,
  removeWatchEntry,
} from '../store/watchStore';

interface QueryPageProps {
  onLoadingChange?: (loading: boolean) => void;
  cancelRef?: { current: (() => void) | null };
  onTitleChange?: (parts: { yearSeason: string; count: number } | null) => void;
}

const bgm = createBangumiClient({ userAgent: 'MikanBox/0.1.0' });

const currentYear = new Date().getFullYear();
const _today = new Date();
const todayStr = `${_today.getFullYear()}-${String(_today.getMonth() + 1).padStart(2, '0')}-${String(_today.getDate()).padStart(2, '0')}`;

/**
 * Bangumi earliest anime entry: 1906.
 * Verified by scripts/scan-bgm-years.mjs on 2026-05-26:
 *   1900–1905 → 0 entries; 1906–2000 → continuous data every year.
 *   2001–present assumed complete (uninterrupted production).
 */
const EARLIEST_YEAR = 1906;

/** [currentYear, currentYear-1, …, 1906] — newest first */
const YEAR_OPTIONS = Array.from(
  { length: currentYear - EARLIEST_YEAR + 1 },
  (_, i) => currentYear - i,
).map((y) => ({ key: String(y), label: `${y} 年` }));

/**
 * Seasons in chronological order within a year.
 * months 1–3 → 冬   4–6 → 春   7–9 → 夏   10–12 → 秋
 */
const ALL_SEASONS = [
  { key: 'winter', label: '冬' },
  { key: 'spring', label: '春' },
  { key: 'summer', label: '夏' },
  { key: 'autumn', label: '秋' },
] as const;

type SeasonKey = (typeof ALL_SEASONS)[number]['key'];

function getCurrentSeason(): SeasonKey {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return 'winter';
  if (m <= 6) return 'spring';
  if (m <= 9) return 'summer';
  return 'autumn';
}

/**
 * For past years → all 4 seasons.
 * For the current year → only seasons that have already started (冬 up to the current one).
 */
function getAvailableSeasons(yearStr: string) {
  if (Number(yearStr) < currentYear) return [...ALL_SEASONS];
  const idx = ALL_SEASONS.findIndex((s) => s.key === getCurrentSeason());
  return ALL_SEASONS.slice(0, idx + 1);
}

function seasonToMonths(s: SeasonKey): [number, number, number] {
  switch (s) {
    case 'winter':
      return [1, 2, 3];
    case 'spring':
      return [4, 5, 6];
    case 'summer':
      return [7, 8, 9];
    case 'autumn':
      return [10, 11, 12];
  }
}

/* 粗体填充式放大镜 — 与 animal-island-ui 的 fill-based 图标风格一致 */
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 512 512" fill="currentColor">
    <path
      d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3
      s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208
      S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"
    />
  </svg>
);

const SEASON_LABELS: Record<SeasonKey, string> = {
  winter: '冬',
  spring: '春',
  summer: '夏',
  autumn: '秋',
};

/* ── 筛选项固化数据 ──────────────────────────────────────── */
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

/* ── 筛选药丸组件 ────────────────────────────────────────── */
interface FilterOption {
  value: string;
  label: string;
}
interface FilterGroupProps {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

function FilterGroup({ label, options, selected, onChange }: FilterGroupProps) {
  const allActive = selected.size === 0;
  function toggle(value: string) {
    if (value === '') {
      onChange(new Set());
      return;
    }
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="filter-pills">
        <button
          className={`filter-pill${allActive ? ' filter-pill--active' : ''}`}
          onClick={() => toggle('')}
        >
          全部
        </button>
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`filter-pill${selected.has(opt.value) ? ' filter-pill--active' : ''}`}
            onClick={() => toggle(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QueryPage({ onLoadingChange, cancelRef, onTitleChange }: QueryPageProps) {
  const [year, setYear] = useState(String(currentYear));
  const [season, setSeason] = useState<SeasonKey>(getCurrentSeason());
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Subject[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filterMonths, setFilterMonths] = useState<Set<string>>(new Set());
  const [filterPlatforms, setFilterPlatforms] = useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const [filterGenres, setFilterGenres] = useState<Set<string>>(new Set());
  const [filterRegions, setFilterRegions] = useState<Set<string>>(new Set());
  const [filterAudiences, setFilterAudiences] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [characters, setCharacters] = useState<RelatedCharacter[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [persons, setPersons] = useState<RelatedPerson[]>([]);
  const [personsLoading, setPersonsLoading] = useState(false);
  const [showPersons, setShowPersons] = useState(false);
  const [watchStatus, setWatchStatus] = useState<Record<number, WatchStatus>>(() =>
    loadStatusMap(),
  );

  const seasonOptions = getAvailableSeasons(year);

  function handleYearChange(newYear: string) {
    setYear(newYear);
    // When switching to the current year, clamp to the latest available season
    // if the currently selected season hasn't arrived yet.
    const available = getAvailableSeasons(newYear);
    if (!available.some((s) => s.key === season)) {
      setSeason(available[available.length - 1].key);
    }
  }

  function handleBack() {
    setResults([]);
    setSearchError(null);
  }

  async function handleSearch() {
    setIsLoading(true);
    onLoadingChange?.(true);
    setResults([]);
    setSearchError(null);
    setFilterMonths(new Set());
    setFilterPlatforms(new Set());
    setFilterSources(new Set());
    setFilterGenres(new Set());
    setFilterRegions(new Set());
    setFilterAudiences(new Set());
    setSelectedId(null);

    let cancelled = false;
    if (cancelRef) {
      cancelRef.current = () => {
        cancelled = true;
        setIsLoading(false);
        onLoadingChange?.(false);
        if (cancelRef) cancelRef.current = null;
      };
    }

    try {
      const yearNum = Number(year);
      const months = seasonToMonths(season);
      const limit = 25;
      const allResults: Subject[] = [];

      for (const month of months) {
        if (cancelled) break;
        let offset = 0;
        let total = Infinity;
        while (offset < total) {
          if (cancelled) break;
          const res = await bgm.subjects.getSubjects({
            type: 2,
            year: yearNum,
            month,
            limit,
            offset,
            sort: 'date',
          });
          if (!res.data) break;
          allResults.push(...res.data.data);
          total = res.data.total;
          offset += res.data.data.length;
          if (res.data.data.length === 0) break;
        }
      }

      if (!cancelled) {
        // 按首播日期升序排列
        allResults.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
        setResults(allResults);
      }
    } catch (err) {
      if (!cancelled) {
        console.error('Search failed:', err);
        setSearchError('搜索失败，请稍后重试');
      }
    } finally {
      if (!cancelled) {
        if (cancelRef) cancelRef.current = null;
        setIsLoading(false);
        onLoadingChange?.(false);
      }
    }
  }

  const hasResults = results.length > 0;

  /** 月份选项：仅当前季度的 3 个月 */
  const monthFilterOptions = seasonToMonths(season).map((m) => ({
    value: String(m),
    label: `${m}月`,
  }));

  /** 客户端筛选结果 */
  const filteredResults = useMemo(() => {
    if (results.length === 0) return results;
    return results.filter((item) => {
      if (filterMonths.size > 0 && item.date) {
        const m = String(parseInt(item.date.split('-')[1], 10));
        if (!filterMonths.has(m)) return false;
      }
      if (filterPlatforms.size > 0) {
        if (!item.platform || !filterPlatforms.has(item.platform)) return false;
      }
      if (
        filterSources.size > 0 ||
        filterGenres.size > 0 ||
        filterRegions.size > 0 ||
        filterAudiences.size > 0
      ) {
        const tagNames = new Set(item.tags.map((t) => t.name));
        if (filterSources.size > 0 && ![...filterSources].some((s) => tagNames.has(s)))
          return false;
        if (filterGenres.size > 0 && ![...filterGenres].some((g) => tagNames.has(g))) return false;
        if (filterRegions.size > 0 && ![...filterRegions].some((r) => tagNames.has(r)))
          return false;
        if (filterAudiences.size > 0 && ![...filterAudiences].some((a) => tagNames.has(a)))
          return false;
      }
      return true;
    });
  }, [
    results,
    filterMonths,
    filterPlatforms,
    filterSources,
    filterGenres,
    filterRegions,
    filterAudiences,
  ]);

  /** 当前选中番剧 */
  const selectedItem = useMemo(
    () => filteredResults.find((item) => item.id === selectedId) ?? null,
    [filteredResults, selectedId],
  );

  /** 右侧详情面板：按受众→地区→来源→分类→类型顺序排列的标签列表 */
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

  /** 切换选中条目时拉取章节列表 */
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

  /** 切换选中条目时拉取角色列表 */
  useEffect(() => {
    if (!selectedId) {
      setCharacters([]);
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

  /** 切换选中条目时拉取演职人员列表 */
  useEffect(() => {
    if (!selectedId) {
      setPersons([]);
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

  /** 将季度信息同步到顶栏标题 */
  useEffect(() => {
    if (results.length > 0) {
      onTitleChange?.({
        yearSeason: `${year}年${SEASON_LABELS[season]}季`,
        count: results.length,
      });
    } else {
      onTitleChange?.(null);
    }
  }, [results.length, year, season, onTitleChange]);

  return (
    <>
      <div className={`query-page${hasResults ? ' query-page--has-results' : ''}`}>
        {hasResults ? (
          <>
            <div className="query-header">
              <div className="query-header-inner">
                <Button type="primary" onClick={handleBack} className="query-back-btn">
                  返回
                </Button>
                <div className="query-filters">
                  {/* 列1行1 */}
                  <FilterGroup
                    label="月份"
                    options={monthFilterOptions}
                    selected={filterMonths}
                    onChange={setFilterMonths}
                  />
                  {/* 列2行1 */}
                  <FilterGroup
                    label="来源"
                    options={SOURCES.map((s) => ({ value: s, label: s }))}
                    selected={filterSources}
                    onChange={setFilterSources}
                  />
                  {/* 列1行2 */}
                  <FilterGroup
                    label="受众"
                    options={AUDIENCES.map((a) => ({ value: a, label: a }))}
                    selected={filterAudiences}
                    onChange={setFilterAudiences}
                  />
                  {/* 列2行2 */}
                  <FilterGroup
                    label="分类"
                    options={PLATFORMS.map((p) => ({ value: p, label: p }))}
                    selected={filterPlatforms}
                    onChange={setFilterPlatforms}
                  />
                  {/* 列1行3 */}
                  <FilterGroup
                    label="地区"
                    options={REGIONS.map((r) => ({ value: r, label: r }))}
                    selected={filterRegions}
                    onChange={setFilterRegions}
                  />
                  {/* 列2行3 */}
                  <FilterGroup
                    label="类型"
                    options={GENRES.map((g) => ({ value: g, label: g }))}
                    selected={filterGenres}
                    onChange={setFilterGenres}
                  />
                </div>
              </div>
              <Divider type="line-teal" />
            </div>
            <div className="query-results-area">
              <div className="query-results-left">
                {searchError && <p className="query-error">{searchError}</p>}
                {filteredResults.map((item) => (
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
              <div className="query-results-right">
                {selectedItem && (
                  <div className="query-detail">
                    {/* ── 固定顶部区域 ── */}
                    <div className="query-detail-fixed">
                      <img
                        className="query-detail-img"
                        src={selectedItem.images.large || selectedItem.images.medium}
                        alt={selectedItem.name_cn || selectedItem.name}
                      />
                      <div className="query-detail-basic">
                        {/* 主标题 */}
                        <h2 className="query-detail-main-title">
                          {selectedItem.name_cn || selectedItem.name}
                        </h2>
                        {/* 副标题：有中文主标题 且 原标题与中文标题不同 才显示 */}
                        {selectedItem.name_cn && selectedItem.name !== selectedItem.name_cn && (
                          <p className="query-detail-sub-title">{selectedItem.name}</p>
                        )}
                        {/* 追番状态 */}
                        <div className="query-detail-watch-status">
                          {(['无状态', '正在追番', '补番计划', '已完番剧'] as const).map(
                            (label) => (
                              <button
                                key={label}
                                className={`query-detail-watch-btn${
                                  (watchStatus[selectedItem.id] ?? '无状态') === label
                                    ? ' query-detail-watch-btn--active'
                                    : ''
                                }`}
                                onClick={() => {
                                  if (label === '无状态') {
                                    removeWatchEntry(selectedItem.id);
                                    setWatchStatus((prev) => {
                                      const next = { ...prev };
                                      delete next[selectedItem.id];
                                      return next;
                                    });
                                  } else {
                                    setWatchEntry(selectedItem, label);
                                    setWatchStatus((prev) => ({
                                      ...prev,
                                      [selectedItem.id]: label,
                                    }));
                                  }
                                }}
                              >
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                        {/* 标签：上映日期 → 受众 → 地区 → 来源 → 分类 → 类型 → 其他 */}
                        <div className="query-detail-tags">
                          {selectedItem.date && (
                            <span className="query-detail-tag query-detail-tag--date">
                              {selectedItem.date}
                            </span>
                          )}
                          {detailTags.map((label) => (
                            <span key={label} className="query-detail-tag">
                              {label}
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
                                const num =
                                  ep.sort % 1 === 0 ? String(ep.sort) : ep.sort.toFixed(1);
                                return (
                                  <span
                                    key={ep.id}
                                    className={`query-detail-ep-pill${
                                      aired ? ' query-detail-ep-pill--aired' : ''
                                    }`}
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
                        {/* 角色 / 演职人员 链接 */}
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
                            {personsLoading
                              ? '…'
                              : persons.length > 0
                                ? `（${persons.length}）`
                                : ''}
                          </button>
                        </div>
                        {/* 评分 */}
                        {selectedItem.rating.score > 0 && (
                          <span className="query-detail-score">
                            ★ {selectedItem.rating.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* ── 分隔线 ── */}
                    <Divider type="wave-yellow" />
                    {/* ── 可滚动区域 ── */}
                    <div className="query-detail-scroll">
                      {selectedItem.summary && (
                        <p className="query-detail-summary">{selectedItem.summary}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="query-toolbar">
              <Select options={YEAR_OPTIONS} value={year} onChange={handleYearChange} />
              <Select
                options={seasonOptions}
                value={season}
                onChange={(v) => setSeason(v as SeasonKey)}
              />
              <Button
                type="primary"
                icon={<SearchIcon />}
                onClick={handleSearch}
                className="query-search-btn"
                disabled={isLoading}
              />
            </div>
            {searchError && <p className="query-error">{searchError}</p>}
          </>
        )}
      </div>

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
