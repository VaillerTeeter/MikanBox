import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDownload, type TaskStatus, type DownloadTask } from '../store/downloadStore';
const FILTERS: { label: string; key: TaskStatus | 'all' }[] = [
  { label: '全部', key: 'all' },
  { label: '下载中', key: '下载中' },
  { label: '已完成', key: '已完成' },
  { label: '暂停', key: '暂停' },
  { label: '错误', key: '错误' },
  { label: '中断', key: '中断' },
  { label: '已取消', key: '已取消' },
];

const PROGRESS_BAR_CLASS: Partial<Record<TaskStatus, string>> = {
  已完成: 'dl-progress-bar--done',
  错误: 'dl-progress-bar--error',
  暂停: 'dl-progress-bar--paused',
  中断: 'dl-progress-bar--interrupted',
  已取消: 'dl-progress-bar--cancelled',
};

const INDETERMINATE_SPEEDS = new Set(['正在解析元数据…', '正在校验文件完整性…']);

function ProgressBar({
  value,
  status,
  speed,
}: {
  value: number;
  status: TaskStatus;
  speed?: string;
}) {
  const cls = PROGRESS_BAR_CLASS[status] ?? '';
  const indeterminate = !!speed && INDETERMINATE_SPEEDS.has(speed);
  return (
    <div className="dl-progress-track">
      <div
        className={`dl-progress-bar ${cls}${indeterminate ? ' dl-progress-bar--indeterminate' : ''}`}
        style={indeterminate ? {} : { width: `${value}%` }}
      />
    </div>
  );
}

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  下载中: 'dl-badge--active',
  已完成: 'dl-badge--done',
  暂停: 'dl-badge--paused',
  错误: 'dl-badge--error',
  中断: 'dl-badge--interrupted',
  已取消: 'dl-badge--cancelled',
};

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`dl-badge ${STATUS_BADGE_CLASS[status]}`}>{status}</span>;
}

function TaskCard({
  task,
  onPause,
  onResume,
  onCancel,
  onRestart,
  onRemoveRecord,
}: {
  task: DownloadTask;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRestart: (id: string) => void;
  onRemoveRecord: (id: string) => void;
}) {
  const isErrorCard = task.status === '错误' || task.status === '中断';
  return (
    <div className={`dl-card${isErrorCard ? ' dl-card--error' : ''}`}>
      {/* 第一行：名称 + 状态徽章 */}
      <div className="dl-card-header">
        <span className="dl-card-name" title={task.name}>
          {task.name}
        </span>
        <StatusBadge status={task.status} />
      </div>

      {/* 进度条 */}
      <ProgressBar value={task.progress} status={task.status} speed={task.speed} />

      {/* 诊断行：下载中 / 暂停 / 中断 / 错误 时显示 */}
      {(task.status === '下载中' ||
        task.status === '暂停' ||
        task.status === '中断' ||
        task.status === '错误') && (
        <div className="dl-diag-row">
          <span className="dl-diag-item">
            阶段：{task.phase ?? (task.status === '下载中' ? '连接中' : task.status)}
          </span>
          <span className="dl-diag-sep">|</span>
          <span className="dl-diag-item">连接：{task.connections ?? '--'}</span>
          <span className="dl-diag-sep">|</span>
          <span className="dl-diag-item">做种：{task.seeders ?? '--'}</span>
        </div>
      )}

      {/* 第二行：元信息 + 操作按钮 */}
      <div className="dl-card-footer">
        <div className="dl-card-meta">
          <span className="dl-meta-item">{task.progress}%</span>
          {task.speed && (
            <>
              <span className="dl-meta-sep">·</span>
              {task.speed === '正在解析元数据…' || task.speed === '正在校验文件完整性…' ? (
                <span className="dl-meta-item dl-meta-resolving">{task.speed}</span>
              ) : (
                <span className="dl-meta-item dl-meta-speed">↓ {task.speed}</span>
              )}
            </>
          )}
          <span className="dl-meta-sep">·</span>
          <span
            className="dl-meta-item"
            title={task.saveDir}
            style={{
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-block',
            }}
          >
            {task.saveDir}
          </span>
        </div>
        <div className="dl-card-actions">
          {/* 主操作按钮 */}
          {task.status === '下载中' && (
            <button className="dl-action-btn" title="暂停" onClick={() => onPause(task.id)}>
              ⏸
            </button>
          )}
          {task.status === '暂停' && (
            <button className="dl-action-btn" title="继续" onClick={() => onResume(task.id)}>
              ▶
            </button>
          )}
          {(task.status === '中断' || task.status === '错误') && (
            <button className="dl-action-btn" title="重新开始" onClick={() => onRestart(task.id)}>
              ↺
            </button>
          )}
          {task.status === '已完成' && (
            <button
              className="dl-action-btn"
              title="打开文件夹"
              onClick={() =>
                invoke('reveal_in_folder', { path: task.saveDir }).catch(console.error)
              }
            >
              📁
            </button>
          )}
          {/* 右侧删除 / 取消按钮 */}
          {(task.status === '下载中' || task.status === '暂停') && (
            <button
              className="dl-action-btn dl-action-btn--danger"
              title="取消"
              onClick={() => onCancel(task.id)}
            >
              ✕
            </button>
          )}
          {(task.status === '已完成' ||
            task.status === '已取消' ||
            task.status === '中断' ||
            task.status === '错误') && (
            <button
              className="dl-action-btn"
              title="删除记录"
              onClick={() => onRemoveRecord(task.id)}
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  const { tasks, pauseTask, resumeTask, cancelTask, restartTask, removeRecord } = useDownload();
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const visibleTasks = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const counts = tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TaskStatus, number>,
  );

  return (
    <div className="dl-page">
      {/* 左侧分类导航 */}
      <aside className="dl-sidebar">
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? tasks.length : (counts[f.key as TaskStatus] ?? 0);
          return (
            <button
              key={f.key}
              className={`dl-nav-btn${filter === f.key ? ' dl-nav-btn--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              <span className="dl-nav-label">{f.label}</span>
              {count > 0 && <span className="dl-nav-count">{count}</span>}
            </button>
          );
        })}
      </aside>

      {/* 右侧任务列表 */}
      <main className="dl-main">
        {visibleTasks.length === 0 ? (
          <div className="dl-empty">暂无任务</div>
        ) : (
          <div className="dl-task-list">
            {visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPause={pauseTask}
                onResume={resumeTask}
                onCancel={cancelTask}
                onRestart={restartTask}
                onRemoveRecord={removeRecord}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
