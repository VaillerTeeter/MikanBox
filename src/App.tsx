import { useState, useRef, useEffect } from 'react';
import './App.css';
import { Button, Icon, Loading, type IconName } from 'animal-island-ui';
import { getCurrentWindow } from '@tauri-apps/api/window';
import QueryPage from './pages/QueryPage';
import WatchingPage from './pages/WatchingPage';
import BacklogPage from './pages/BacklogPage';
import FinishedPage from './pages/FinishedPage';
import SearchPage from './pages/SearchPage';
import DownloadPage from './pages/DownloadPage';
import TracksPage from './pages/TracksPage';
import { DownloadProvider } from './store/downloadStore';

const appWindow = getCurrentWindow();

type PageKey = 'query' | 'watching' | 'backlog' | 'finished' | 'search' | 'download' | 'tracks';

const NAV_ITEMS: { key: PageKey; label: string; icon: IconName }[] = [
  { key: 'query', label: '季度查询', icon: 'icon-critterpedia' },
  { key: 'watching', label: '正在追番', icon: 'icon-camera' },
  { key: 'backlog', label: '补番计划', icon: 'icon-map' },
  { key: 'finished', label: '已完番剧', icon: 'icon-miles' },
  { key: 'search', label: '搜索资源', icon: 'icon-shopping' },
  { key: 'download', label: '下载', icon: 'icon-helicopter' },
  { key: 'tracks', label: '轨道工坊', icon: 'icon-diy' },
];

const PAGE_COMPONENTS: Record<PageKey, React.ComponentType> = {
  query: QueryPage,
  watching: WatchingPage,
  backlog: BacklogPage,
  finished: FinishedPage,
  search: SearchPage,
  download: DownloadPage,
  tracks: TracksPage,
};

/** 独立计时组件：每秒只重渲染自身，不波及兄弟节点 Loading 的动画 */
function LoadingTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="query-loading-timer">{seconds} s</span>;
}

export default function App() {
  return (
    <DownloadProvider>
      <AppInner />
    </DownloadProvider>
  );
}

function AppInner() {
  const [page, setPage] = useState<PageKey>('query');
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryTitleParts, setQueryTitleParts] = useState<{
    yearSeason: string;
    count: number;
  } | null>(null);
  const queryCancelRef = useRef<(() => void) | null>(null);

  function handleQueryCancel() {
    queryCancelRef.current?.();
  }

  const currentLabel = NAV_ITEMS.find((item) => item.key === page)!.label;

  return (
    <>
      {isQueryLoading && page === 'query' && (
        <div className="query-loading-overlay">
          <button className="query-loading-cancel" onClick={handleQueryCancel} title="取消搜索">
            ✕
          </button>
          <LoadingTimer />
          <Loading active className="query-loading-inner" />
        </div>
      )}
      <div className="app-shell">
        <header className="topbar" data-tauri-drag-region>
          <div className="topbar-controls">
            <Button type="primary" size="small" onClick={() => appWindow.minimize()}>
              -
            </Button>
            <Button type="primary" size="small" onClick={() => appWindow.close()}>
              X
            </Button>
          </div>
          <span className="topbar-title">
            MikanBox - {currentLabel}
            {page === 'query' && queryTitleParts && (
              <>
                {' '}
                - <span className="topbar-highlight">{queryTitleParts.yearSeason}</span>番剧共
                <span className="topbar-highlight">{queryTitleParts.count}</span>部
              </>
            )}
          </span>
        </header>
        <div className="app-body">
          <nav className="sidebar" data-tauri-drag-region>
            <div className="nav-items">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  className={`nav-btn${page === item.key ? ' nav-btn--active' : ''}`}
                  onClick={() => setPage(item.key)}
                  title={item.label}
                >
                  <Icon name={item.icon} size={24} />
                </button>
              ))}
            </div>
          </nav>
          <main className="main-content">
            {NAV_ITEMS.map((item) => {
              const PageComponent = PAGE_COMPONENTS[item.key];
              return (
                <div
                  key={item.key}
                  className={`page-container${page === item.key ? ' page-container--active' : ''}`}
                >
                  {item.key === 'query' ? (
                    <QueryPage
                      onLoadingChange={setIsQueryLoading}
                      cancelRef={queryCancelRef}
                      onTitleChange={setQueryTitleParts}
                    />
                  ) : item.key === 'watching' ? (
                    <WatchingPage isActive={page === 'watching'} />
                  ) : item.key === 'backlog' ? (
                    <BacklogPage isActive={page === 'backlog'} />
                  ) : item.key === 'finished' ? (
                    <FinishedPage isActive={page === 'finished'} />
                  ) : (
                    <PageComponent />
                  )}
                </div>
              );
            })}
          </main>
        </div>
      </div>
    </>
  );
}
