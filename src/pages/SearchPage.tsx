import { useState, useEffect, useCallback, useRef } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useDownload } from '../store/downloadStore';

interface FloatToast {
  id: number;
  x: number;
  y: number;
  text: string;
}

function MagnetBtn({ magnet, name }: { magnet: string; name: string }) {
  const { addTask } = useDownload();
  const [toasts, setToasts] = useState<FloatToast[]>([]);
  const idRef = useRef(0);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      // Open native folder picker
      const dir = await openDialog({
        directory: true,
        multiple: false,
        title: '选择保存文件夹',
      });

      if (!dir) return; // user cancelled

      addTask({ name, magnet, saveDir: dir as string });

      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, x, y, text: '✓ 已添加' }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 1000);
    },
    [magnet, name, addTask],
  );

  return (
    <>
      <button className="search-magnet-btn" title="添加到下载列表" onClick={handleClick}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 4v6a6 6 0 0 0 12 0V4" />
          <line x1="6" y1="4" x2="6" y2="2" />
          <line x1="18" y1="4" x2="18" y2="2" />
          <line x1="3" y1="4" x2="6" y2="4" />
          <line x1="18" y1="4" x2="21" y2="4" />
        </svg>
      </button>
      {toasts.map((t) => (
        <div key={t.id} className="magnet-copy-toast" style={{ left: t.x, top: t.y }}>
          {t.text}
        </div>
      ))}
    </>
  );
}
import { invoke } from '@tauri-apps/api/core';
import { Table } from 'animal-island-ui';
import type { TableColumn } from 'animal-island-ui';
import { loadEntriesByStatus } from '../store/watchStore';

type LogicOp = 'AND' | 'OR' | 'NOT';

interface SearchTerm {
  id: number;
  op: LogicOp;
  value: string;
}

interface NyaaResult {
  [key: string]: unknown;
  key: string;
  name: string;
  magnet: string;
  size: string;
  date: string;
  seeders: number;
  leechers: number;
  completed: number;
}

const LOGIC_OPTIONS: LogicOp[] = ['AND', 'OR', 'NOT'];
const PRESET_PHRASES = ['简体', '繁体', '简繁', '1080p', '720p', '480p'];

let _termId = 0;

function parseNyaaHtml(html: string): NyaaResult[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('table.table tbody tr');
  const results: NyaaResult[] = [];
  rows.forEach((row, i) => {
    const tds = row.querySelectorAll('td');
    if (tds.length < 8) return;
    const nameEl = tds[1].querySelector('a[href^="/view/"]:not([href*="#"])');
    const name = nameEl?.textContent?.trim() ?? '';
    const magnetEl = tds[2].querySelector('a[href^="magnet:"]');
    const magnet = magnetEl?.getAttribute('href') ?? '';
    const size = tds[3].textContent?.trim() ?? '';
    const date = tds[4].textContent?.trim() ?? '';
    const seeders = parseInt(tds[5].textContent?.trim() ?? '0', 10);
    const leechers = parseInt(tds[6].textContent?.trim() ?? '0', 10);
    const completed = parseInt(tds[7].textContent?.trim() ?? '0', 10);
    if (name) {
      results.push({ key: String(i), name, magnet, size, date, seeders, leechers, completed });
    }
  });
  return results;
}

const columns: TableColumn[] = [
  {
    title: '名称',
    dataIndex: 'name',
    render: (val) => (
      <span className="search-result-name" title={val as string}>
        {val as string}
      </span>
    ),
  },
  {
    title: '大小',
    dataIndex: 'size',
    width: 95,
    align: 'center',
    render: (v) => <span style={{ whiteSpace: 'nowrap' }}>{v as string}</span>,
  },
  {
    title: '日期',
    dataIndex: 'date',
    width: 140,
    align: 'center',
    render: (v) => <span style={{ whiteSpace: 'nowrap' }}>{v as string}</span>,
  },
  {
    title: '做种 ↑',
    dataIndex: 'seeders',
    width: 65,
    align: 'center',
    render: (v) => (
      <span style={{ color: 'var(--theme-seeders-color)', fontWeight: 600 }}>{v as number}</span>
    ),
  },
  {
    title: '下载中 ↓',
    dataIndex: 'leechers',
    width: 70,
    align: 'center',
    render: (v) => (
      <span style={{ color: 'var(--theme-leechers-color)', fontWeight: 600 }}>{v as number}</span>
    ),
  },
  { title: '已完成 ✓', dataIndex: 'completed', width: 75, align: 'center' },
  {
    title: '磁力',
    dataIndex: 'magnet',
    width: 62,
    align: 'center',
    render: (v, record, index) => {
      if (!v) return '—';
      return <MagnetBtn magnet={v as string} name={(record as NyaaResult).name} key={index} />;
    },
  },
];

export default function SearchPage() {
  const [activeLogic, setActiveLogic] = useState<LogicOp | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [animeDropdown, setAnimeDropdown] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [watchingNames, setWatchingNames] = useState<string[]>([]);
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<NyaaResult[]>([]);
  const [savedQueries, setSavedQueries] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mikanbox-saved-queries') ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('mikanbox-saved-queries', JSON.stringify(savedQueries));
  }, [savedQueries]);

  useEffect(() => {
    const entries = loadEntriesByStatus('正在追番');
    setWatchingNames(entries.map((e) => e.subject.name_cn || e.subject.name));
  }, []);

  function addTerm(op: LogicOp, value: string) {
    setTerms((prev) => {
      if (prev.some((t) => t.value === value)) return prev;
      return [...prev, { id: _termId++, op, value }];
    });
    setActiveLogic(null);
    setSelectedPreset(null);
  }

  function removeTerm(id: number) {
    setTerms((prev) => prev.filter((t) => t.id !== id));
  }

  const keywordActive = !!(animeDropdown || customInput);
  const presetActive = !!selectedPreset;
  const presetDisabled = keywordActive;
  const keywordDisabled = presetActive;

  function toggleLogic(op: LogicOp) {
    const newLogic = activeLogic === op ? null : op;
    if (newLogic) {
      if (selectedPreset) {
        addTerm(newLogic, selectedPreset);
        return;
      }
      if (animeDropdown) {
        addTerm(newLogic, animeDropdown);
        setAnimeDropdown('');
        return;
      }
      if (customInput.trim()) {
        addTerm(newLogic, customInput.trim());
        setCustomInput('');
        return;
      }
    }
    setActiveLogic(newLogic);
  }

  function handlePresetClick(p: string) {
    if (presetDisabled) return;
    if (activeLogic) {
      addTerm(activeLogic, p);
    } else {
      setSelectedPreset((prev) => (prev === p ? null : p));
    }
  }

  function handleDropdownChange(val: string) {
    if (val && activeLogic) {
      addTerm(activeLogic, val);
      setAnimeDropdown('');
      setCustomInput('');
    } else {
      setAnimeDropdown(val);
      if (val) {
        setCustomInput('');
        setSelectedPreset(null);
      }
    }
  }

  function handleInputChange(val: string) {
    setCustomInput(val);
    if (val) {
      setAnimeDropdown('');
      setSelectedPreset(null);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && customInput.trim() && activeLogic) {
      addTerm(activeLogic, customInput.trim());
      setCustomInput('');
    }
  }

  const searchQuery = terms
    .map((t) => {
      if (t.op === 'OR') return `| ${t.value}`;
      if (t.op === 'NOT') return `- ${t.value}`;
      return t.value;
    })
    .join(' ');

  function tagOpSymbol(op: LogicOp) {
    if (op === 'OR') return '|';
    if (op === 'NOT') return '-';
    return '+';
  }

  function saveCurrentQuery() {
    if (!searchQuery.trim()) return;
    setSavedQueries((prev) => (prev.includes(searchQuery) ? prev : [searchQuery, ...prev]));
  }

  function removeSavedQuery(q: string) {
    setSavedQueries((prev) => prev.filter((x) => x !== q));
  }

  async function handleSearch(overrideQuery?: string) {
    const q = overrideQuery ?? searchQuery;
    if (!q.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const url = `https://nyaa.si/?q=${encodeURIComponent(q)}`;
      const html = await invoke<string>('fetch_html', { url });
      const results = parseNyaaHtml(html);
      if (results.length === 0) {
        setSearchError('没有找到相关资源');
      } else {
        setSearchResults(results);
      }
    } catch (e) {
      setSearchError(`查询失败：${e}`);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="search-page">
      <div className="search-panel">
        <div className="search-controls">
          {/* 逻辑操作符 */}
          <div className="search-row">
            <span className="search-label">逻辑</span>
            <div className="search-button-group">
              {LOGIC_OPTIONS.map((op) => (
                <button
                  key={op}
                  className={`search-logic-btn${activeLogic === op ? ' search-logic-btn--active' : ''}`}
                  onClick={() => toggleLogic(op)}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          {/* 预置词 */}
          <div className="search-row">
            <span className="search-label">预置词</span>
            <div className="search-button-group">
              {PRESET_PHRASES.map((p) => (
                <button
                  key={p}
                  className={`search-preset-btn${selectedPreset === p ? ' search-preset-btn--active' : ''}${presetDisabled ? ' search-preset-btn--muted' : ''}`}
                  onClick={() => handlePresetClick(p)}
                  disabled={presetDisabled}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 关键词：下拉与输入二选一 */}
          <div className="search-row search-row--keyword">
            <span className="search-label">关键词</span>
            <select
              className={`search-select${!!customInput || keywordDisabled ? ' search-select--disabled' : ''}`}
              value={animeDropdown}
              onChange={(e) => handleDropdownChange(e.target.value)}
              disabled={!!customInput || keywordDisabled}
            >
              <option value="">— 选择番剧 —</option>
              {watchingNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <span className="search-keyword-or">或</span>
            <input
              className={`search-custom-input${!!animeDropdown || keywordDisabled ? ' search-custom-input--disabled' : ''}`}
              type="text"
              placeholder={activeLogic ? '输入关键词后按 Enter 添加…' : '自由输入关键词…'}
              value={customInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={!!animeDropdown || keywordDisabled}
            />
          </div>

          {/* 已选 */}
          <div className="search-row search-row--tags">
            <span className="search-label">已选</span>
            <div className="search-tag-list">
              {terms.length === 0 ? (
                <span className="search-empty-hint">暂无</span>
              ) : (
                terms.map((t) => (
                  <span key={t.id} className="search-tag">
                    <span className="search-tag-op">{tagOpSymbol(t.op)}</span>
                    <span className="search-tag-value">{t.value}</span>
                    <button
                      className="search-tag-close"
                      onClick={() => removeTerm(t.id)}
                      title="删除"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 查询 */}
          <div className="search-row">
            <span className="search-label">查询</span>
            <div className="search-preview-box">
              <div className="search-query-preview">
                {searchQuery || <span className="search-empty-hint">—</span>}
              </div>
            </div>
            <button
              className="search-action-btn search-action-btn--primary"
              onClick={() => handleSearch()}
              disabled={terms.length === 0 || searching}
            >
              {searching ? '查询中…' : '查询'}
            </button>
            <button
              className="search-save-btn"
              title="保存此查询"
              onClick={saveCurrentQuery}
              disabled={!searchQuery || savedQueries.includes(searchQuery)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5 3h14a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2z" />
              </svg>
            </button>
          </div>

          {/* 常用查询 */}
          {savedQueries.length > 0 && (
            <div className="search-row search-row--saved">
              <span className="search-label">常用</span>
              <div className="search-saved-list">
                {savedQueries.map((q) => (
                  <span key={q} className="search-saved-chip">
                    <button
                      className="search-saved-chip-text"
                      onClick={() => handleSearch(q)}
                      disabled={searching}
                      title={q}
                    >
                      {q}
                    </button>
                    <button
                      className="search-tag-close"
                      onClick={() => removeSavedQuery(q)}
                      title="删除"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {searchError && <div className="search-error-msg">{searchError}</div>}
        </div>
      </div>

      {/* 结果表格 */}
      {(searching || searchResults.length > 0) && (
        <div className="search-results-area">
          <div className="search-results-table">
            <Table
              columns={columns}
              dataSource={searchResults}
              rowKey="key"
              striped
              loading={searching}
              emptyText="没有结果"
            />
          </div>
        </div>
      )}
    </div>
  );
}
