import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskStatus = '下载中' | '已完成' | '暂停' | '错误' | '中断' | '已取消';

export interface DownloadTask {
  id: string;
  name: string;
  magnet: string;
  saveDir: string;
  progress: number; // 0-100
  status: TaskStatus;
  speed?: string;
  /** aria2 transfer phase, e.g. 元数据解析 / 下载中 / 完整性校验 */
  phase?: string;
  /** Number of currently connected peers */
  connections?: number;
  /** Number of known seeders */
  seeders?: number;
}

// Payload emitted by Rust `download-progress` event
interface ProgressPayload {
  id: string;
  progress: number;
  speed?: string;
  aria2_status?: string; // "error" | "complete"
  phase?: string;
  connections?: number;
  seeders?: number;
}

// ── State machine ──────────────────────────────────────────────────────────

/**
 * Explicit allow-list of valid status transitions.
 * Any transition NOT listed here will be silently ignored by applyStatusTransition,
 * preventing stale async events from corrupting terminal states.
 *
 * State diagram:
 *   [start] ──────────────────────────────────────── 下载中
 *   下载中  → 暂停 | 错误 | 已取消 | 已完成
 *   暂停    → 下载中 | 错误 | 已取消
 *   中断    → 下载中 | 错误 | 已取消
 *   错误    → 下载中 | 已取消
 *   已取消  → (terminal)
 *   已完成  → (terminal)
 */
const STATUS_TRANSITIONS: Record<TaskStatus, ReadonlySet<TaskStatus>> = {
  下载中: new Set(['暂停', '错误', '已取消', '已完成']),
  暂停: new Set(['下载中', '错误', '已取消']),
  中断: new Set(['下载中', '错误', '已取消']),
  错误: new Set(['下载中', '已取消']),
  已取消: new Set([]),
  已完成: new Set([]),
};

function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return STATUS_TRANSITIONS[from].has(to);
}

function applyStatusTransition(
  task: DownloadTask,
  nextStatus: TaskStatus,
  patch?: Partial<DownloadTask>,
): DownloadTask {
  if (!canTransition(task.status, nextStatus)) {
    return task; // guard: illegal transition is a no-op
  }
  return { ...task, ...patch, status: nextStatus };
}

// ── Phase inference ────────────────────────────────────────────────────────

const PHASE_SPEED_META = new Set(['正在解析元数据…', '正在校验文件完整性…']);

function inferPhase(params: {
  status: TaskStatus;
  progress: number;
  speed?: string;
  incomingPhase?: string;
  currentPhase?: string;
}): string | undefined {
  const { status, progress, speed, incomingPhase, currentPhase } = params;
  if (incomingPhase) return incomingPhase;
  if (speed === '正在解析元数据…') return '元数据解析';
  if (speed === '正在校验文件完整性…') return '完整性校验';
  if (status === '下载中') {
    if (progress > 0 || (speed && !PHASE_SPEED_META.has(speed))) return '下载中';
    return currentPhase ?? '连接中';
  }
  if (status === '暂停') return '已暂停';
  if (status === '中断') return currentPhase ?? '中断';
  if (status === '错误') return currentPhase ?? '错误';
  if (status === '已取消') return '已取消';
  if (status === '已完成') return '已完成';
  return currentPhase;
}

// ── Persistence ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mikanbox-download-tasks';

function isValidTask(t: unknown): t is DownloadTask {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.magnet === 'string' &&
    typeof o.saveDir === 'string' &&
    typeof o.status === 'string'
  );
}

/** Load persisted tasks; any active download is marked as interrupted. */
function loadPersistedTasks(): DownloadTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidTask)
      .map((t) =>
        t.status === '下载中' || t.status === '暂停'
          ? { ...t, status: '中断' as TaskStatus, speed: undefined, eta: undefined }
          : t,
      );
  } catch {
    return [];
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface DownloadContextValue {
  tasks: DownloadTask[];
  addTask: (info: { name: string; magnet: string; saveDir: string }) => string;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  restartTask: (id: string) => void;
  removeRecord: (id: string) => void;
}

const DownloadContext = createContext<DownloadContextValue>({
  tasks: [],
  addTask: () => '',
  pauseTask: () => {},
  resumeTask: () => {},
  cancelTask: () => {},
  restartTask: () => {},
  removeRecord: () => {},
});

export function useDownload() {
  return useContext(DownloadContext);
}

// ── Provider ───────────────────────────────────────────────────────────────

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>(loadPersistedTasks);
  const seqRef = useRef(0);
  // Always-current snapshot of tasks for use outside render (avoids stale closures)
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Persist to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Helper: mark a task as error (used as the catch-path for all operations)
  const markTaskError = useCallback((id: string, phase = '请求失败') => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? applyStatusTransition(t, '错误', { speed: undefined, phase }) : t,
      ),
    );
  }, []);

  // Listen for progress events emitted by Rust background task
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ProgressPayload>('download-progress', (event) => {
      const {
        id,
        progress,
        speed,
        aria2_status,
        phase: inPhase,
        connections,
        seeders,
      } = event.payload;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;

          if (aria2_status === 'error') {
            return applyStatusTransition(t, '错误', { speed: undefined });
          }
          if (aria2_status === 'complete') {
            return applyStatusTransition(t, '已完成', {
              progress: 100,
              speed: undefined,
              phase: '已完成',
            });
          }

          // Guard: if task is already terminal, ignore further progress events
          if (t.status === '已取消' || t.status === '已完成') return t;

          // Keep the last valid progress (aria2 reports 0 during metadata resolution)
          const newProgress = Math.min(100, Math.max(0, progress > 0 ? progress : t.progress));
          // Paused: ignore noisy speed values from aria2 (takes ~1-2s to actually stop)
          const newSpeed = t.status === '暂停' ? undefined : (speed ?? undefined);
          const newPhase = inferPhase({
            status: t.status,
            progress: newProgress,
            speed: newSpeed,
            incomingPhase: inPhase,
            currentPhase: t.phase,
          });
          return {
            ...t,
            progress: newProgress,
            speed: newSpeed,
            phase: newPhase,
            // Preserve last-known values so display doesn't flicker to '--'
            connections: connections ?? t.connections,
            seeders: seeders ?? t.seeders,
          };
        }),
      );
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const addTask = useCallback(
    (info: { name: string; magnet: string; saveDir: string }): string => {
      const id = `dl-${Date.now()}-${++seqRef.current}`;
      const task: DownloadTask = {
        id,
        name: info.name,
        magnet: info.magnet,
        saveDir: info.saveDir,
        progress: 0,
        status: '下载中',
      };
      setTasks((prev) => [task, ...prev]);
      invoke('add_magnet', { taskId: id, magnet: info.magnet, saveDir: info.saveDir }).catch(() =>
        markTaskError(id, '添加任务失败'),
      );
      return id;
    },
    [markTaskError],
  );

  const pauseTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? applyStatusTransition(t, '暂停', { speed: undefined }) : t)),
    );
    invoke('pause_task', { taskId: id }).catch(() => {
      // Rollback: restore to 下载中
      setTasks((prev) => prev.map((t) => (t.id === id ? applyStatusTransition(t, '下载中') : t)));
    });
  }, []);

  const resumeTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? applyStatusTransition(t, '下载中') : t)));
    invoke('resume_task', { taskId: id }).catch(() => {
      // Rollback: restore to 暂停
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? applyStatusTransition(t, '暂停', { speed: undefined }) : t)),
      );
    });
  }, []);

  const cancelTask = useCallback(
    (id: string) => {
      // Commit backend first; only update UI on success to prevent phantom cancelled tasks
      invoke('cancel_task', { taskId: id })
        .then(() => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === id ? applyStatusTransition(t, '已取消', { speed: undefined }) : t,
            ),
          );
        })
        .catch(() => markTaskError(id, '取消失败'));
    },
    [markTaskError],
  );

  const restartTask = useCallback(
    (id: string) => {
      // Read task info from ref BEFORE touching state.
      // React Strict Mode calls setState callbacks twice in dev; invoking add_magnet
      // inside a setter would fire twice, killing the first poll with the second call.
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? applyStatusTransition(t, '下载中', {
                progress: 0,
                speed: undefined,
                phase: '连接中',
              })
            : t,
        ),
      );
      invoke('add_magnet', {
        taskId: id,
        magnet: task.magnet,
        saveDir: task.saveDir,
      }).catch(() => markTaskError(id, '重启失败'));
    },
    [markTaskError],
  );

  const removeRecord = useCallback((id: string) => {
    // Guard: active/paused tasks should be cancelled first, not silently removed
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task || task.status === '下载中' || task.status === '暂停') return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <DownloadContext.Provider
      value={{ tasks, addTask, pauseTask, resumeTask, cancelTask, restartTask, removeRecord }}
    >
      {children}
    </DownloadContext.Provider>
  );
}
