import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

/* ─── Types ──────────────────────────────────────────────────── */

type TrackType = 'video' | 'audio' | 'subtitle';
type JobStatus = 'pending' | 'running' | 'done' | 'error';

interface Track {
  id: number;
  type: TrackType;
  codec: string;
  language: string;
  name: string;
  extra?: string; // e.g. "1920×1080" for video
}

interface SelectedTrack extends Track {
  selected: boolean;
  label: string; // output language tag
}

interface FileState {
  path: string | null;
  name: string | null;
  tracks: SelectedTrack[];
}
interface DraftState {
  fileA: FileState;
  fileB: FileState;
  outputDir: string | null;
  outputName: string;
}

interface MergeJob {
  id: string;
  fileA: FileState;
  fileB: FileState;
  outputDir: string;
  outputName: string;
  status: JobStatus;
  errorMsg?: string;
}
/* ─── Constants ──────────────────────────────────────────────── */

const DEFAULT_SELECTED_A: Record<TrackType, boolean> = {
  video: true,
  audio: true,
  subtitle: false,
};

const DEFAULT_SELECTED_B: Record<TrackType, boolean> = {
  video: false,
  audio: false,
  subtitle: true,
};

const TRACK_ICON: Record<TrackType, string> = {
  video: '🎬',
  audio: '🔊',
  subtitle: '💬',
};

const TRACK_TYPE_CN: Record<TrackType, string> = {
  video: '视频',
  audio: '音频',
  subtitle: '字幕',
};

const EMPTY_FILE: FileState = { path: null, name: null, tracks: [] };

const EMPTY_DRAFT: DraftState = {
  fileA: EMPTY_FILE,
  fileB: EMPTY_FILE,
  outputDir: null,
  outputName: '',
};

const JOB_STATUS_ICON: Record<JobStatus, string> = {
  pending: '⏳',
  running: '🔄',
  done: '✅',
  error: '❌',
};

const JOB_STATUS_CN: Record<JobStatus, string> = {
  pending: '待处理',
  running: '处理中',
  done: '已完成',
  error: '出错',
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Apply role-based default track selection to tracks returned from identify_tracks */
function applyDefaults(tracks: SelectedTrack[], role: 'a' | 'b'): SelectedTrack[] {
  const defaults = role === 'a' ? DEFAULT_SELECTED_A : DEFAULT_SELECTED_B;
  return tracks.map((t) => ({ ...t, selected: defaults[t.type] ?? false }));
}

/* ─── Root page ──────────────────────────────────────────────── */

export default function TracksPage() {
  const [jobs, setJobs] = useState<MergeJob[]>([]);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [fileLoading, setFileLoading] = useState<{ a: boolean; b: boolean }>({
    a: false,
    b: false,
  });
  const [progress, setProgress] = useState<Record<string, number>>({});

  /* ── Event listeners (merge progress & status from backend) ── */
  useEffect(() => {
    let unlisten1: (() => void) | undefined;
    let unlisten2: (() => void) | undefined;

    listen<{ job_id: string; percent: number }>('merge-progress', (e) => {
      setProgress((prev) => ({ ...prev, [e.payload.job_id]: e.payload.percent }));
    }).then((fn) => {
      unlisten1 = fn;
    });

    listen<{ job_id: string; status: string; error?: string }>('merge-status', (e) => {
      const { job_id, status, error } = e.payload;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job_id ? { ...j, status: status as JobStatus, errorMsg: error } : j,
        ),
      );
    }).then((fn) => {
      unlisten2 = fn;
    });

    return () => {
      unlisten1?.();
      unlisten2?.();
    };
  }, []);

  /* ── Navigation ── */

  function startNewDraft() {
    setEditingJobId(null);
    setDraft(EMPTY_DRAFT);
  }

  function loadJobIntoDraft(job: MergeJob) {
    setEditingJobId(job.id);
    setDraft({
      fileA: job.fileA,
      fileB: job.fileB,
      outputDir: job.outputDir,
      outputName: job.outputName,
    });
  }

  /* ── File picking ── */

  async function pickFile(role: 'a' | 'b') {
    const result = await open({
      title: `选择 ${role.toUpperCase()} 版文件`,
      filters: [{ name: '视频文件', extensions: ['mkv', 'mp4', 'avi', 'mov'] }],
      multiple: false,
    });
    if (!result || typeof result !== 'string') return;
    const name = result.split(/[\\/]/).pop() ?? result;
    const fileKey = role === 'a' ? 'fileA' : 'fileB';
    setFileLoading((prev) => ({ ...prev, [role]: true }));
    try {
      const raw = await invoke<SelectedTrack[]>('identify_tracks', { path: result });
      const tracks = applyDefaults(raw, role);
      setDraft((prev) => {
        const next: DraftState = { ...prev, [fileKey]: { path: result, name, tracks } };
        if (role === 'a') {
          // 默认输出目录 = A 版所在目录
          if (!prev.outputDir) {
            const dir = result.replace(/[\\/][^\\/]+$/, '');
            next.outputDir = dir;
          }
          if (!prev.outputName) {
            next.outputName = name.replace(/\.[^.]+$/, '') + '_merged.mkv';
          }
        }
        return next;
      });
    } catch (err) {
      setDraft((prev) => ({ ...prev, [fileKey]: { path: result, name, tracks: [] } }));
      console.error('identify_tracks failed:', err);
    } finally {
      setFileLoading((prev) => ({ ...prev, [role]: false }));
    }
  }

  async function pickOutputDir() {
    const result = await open({ title: '选择输出文件夹', directory: true });
    if (result && typeof result === 'string') {
      setDraft((prev) => ({ ...prev, outputDir: result }));
    }
  }

  /* ── Track editing ── */

  function updateTrack(
    role: 'a' | 'b',
    id: number,
    patch: Partial<Pick<SelectedTrack, 'selected' | 'label'>>,
  ) {
    const fileKey = role === 'a' ? 'fileA' : 'fileB';
    setDraft((prev) => ({
      ...prev,
      [fileKey]: {
        ...prev[fileKey],
        tracks: prev[fileKey].tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
    }));
  }

  function moveTrack(role: 'a' | 'b', id: number, dir: -1 | 1) {
    const fileKey = role === 'a' ? 'fileA' : 'fileB';
    setDraft((prev) => {
      const arr = [...prev[fileKey].tracks];
      const idx = arr.findIndex((t) => t.id === id);
      const next = idx + dir;
      if (next < 0 || next >= arr.length) return prev;
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return { ...prev, [fileKey]: { ...prev[fileKey], tracks: arr } };
    });
  }

  /* ── Queue operations ── */

  function addToQueue() {
    const name = draft.outputName.trim();
    if (!draft.fileA.path || !draft.fileB.path || !draft.outputDir || !name) return;
    setJobs((prev) => [
      ...prev,
      {
        id: genId(),
        fileA: draft.fileA,
        fileB: draft.fileB,
        outputDir: draft.outputDir!,
        outputName: name,
        status: 'pending',
      },
    ]);
    setDraft(EMPTY_DRAFT);
  }

  function updateJob() {
    const name = draft.outputName.trim();
    if (!editingJobId || !draft.fileA.path || !draft.fileB.path || !draft.outputDir || !name)
      return;
    setJobs((prev) =>
      prev.map((j) =>
        j.id === editingJobId
          ? {
              ...j,
              fileA: draft.fileA,
              fileB: draft.fileB,
              outputDir: draft.outputDir!,
              outputName: name,
            }
          : j,
      ),
    );
    setEditingJobId(null);
    setDraft(EMPTY_DRAFT);
  }

  function cancelEdit() {
    setEditingJobId(null);
    setDraft(EMPTY_DRAFT);
  }

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (editingJobId === id) cancelEdit();
  }

  function clearQueue() {
    setJobs((prev) => prev.filter((j) => j.status === 'running'));
    setEditingJobId(null);
    setDraft(EMPTY_DRAFT);
  }

  function startQueue() {
    const pending = jobs.filter((j) => j.status === 'pending');
    if (pending.length === 0) return;
    invoke('start_merge_queue', { jobs: pending }).catch((err) =>
      console.error('start_merge_queue failed:', err),
    );
  }

  /* ── Derived ── */

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;

  const canSubmit =
    !!draft.fileA.path &&
    !!draft.fileB.path &&
    !!draft.outputDir &&
    draft.outputName.trim() !== '' &&
    (draft.fileA.tracks.some((t) => t.selected) || draft.fileB.tracks.some((t) => t.selected));

  return (
    <div className="tw-root">
      {/* ── Left: Queue ── */}
      <div className="tw-queue">
        <div className="tw-queue-header">
          <span className="tw-queue-title">任务队列</span>
          <button className="tw-btn tw-btn--secondary tw-btn--sm" onClick={startNewDraft}>
            + 新建
          </button>
        </div>
        <div className="tw-queue-list">
          {jobs.length === 0 ? (
            <div className="tw-queue-empty">尚无任务</div>
          ) : (
            jobs.map((job, idx) => (
              <div
                key={job.id}
                className={[
                  'tw-job-item',
                  editingJobId === job.id ? 'tw-job-item--active' : '',
                  job.status !== 'pending' ? `tw-job-item--${job.status}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  if (job.status === 'pending') loadJobIntoDraft(job);
                }}
                title={job.outputName}
              >
                <span className="tw-job-index">{idx + 1}</span>
                <span className="tw-job-name">{job.outputName}</span>
                <span className="tw-job-status-icon" title={JOB_STATUS_CN[job.status]}>
                  {job.status === 'running' && progress[job.id] !== undefined
                    ? `${progress[job.id]}%`
                    : JOB_STATUS_ICON[job.status]}
                </span>
                {job.status === 'pending' && (
                  <button
                    className="tw-job-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeJob(job.id);
                    }}
                    title="移除"
                  >
                    ✕
                  </button>
                )}
                {job.status === 'running' && progress[job.id] !== undefined && (
                  <div className="tw-job-progress">
                    <div
                      className="tw-job-progress-bar"
                      style={{ width: `${progress[job.id]}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="tw-queue-footer">
          <button
            className="tw-btn tw-btn--secondary tw-btn--sm"
            onClick={clearQueue}
            disabled={pendingCount === 0}
          >
            清空
          </button>
          <button
            className="tw-btn tw-btn--primary tw-btn--sm tw-queue-start-btn"
            onClick={startQueue}
            disabled={pendingCount === 0}
          >
            ▶ 全部执行
          </button>
        </div>
      </div>

      <div className="tw-queue-divider" />

      {/* ── Right: Editor ── */}
      <div className="tw-editor">
        <div className="tw-panels">
          <FilePanel
            role="a"
            file={draft.fileA}
            onPickFile={() => pickFile('a')}
            onUpdateTrack={(id, patch) => updateTrack('a', id, patch)}
            onMoveTrack={(id, dir) => moveTrack('a', id, dir)}
            loading={fileLoading.a}
          />
          <div className="tw-divider" />
          <FilePanel
            role="b"
            file={draft.fileB}
            onPickFile={() => pickFile('b')}
            onUpdateTrack={(id, patch) => updateTrack('b', id, patch)}
            onMoveTrack={(id, dir) => moveTrack('b', id, dir)}
            loading={fileLoading.b}
          />
        </div>
        <div className="tw-output">
          <div className="tw-output-title">
            {editingJobId
              ? `编辑任务 — ${jobs.find((j) => j.id === editingJobId)?.outputName ?? ''}`
              : '新建任务'}
          </div>
          <div className="tw-output-row">
            <span className="tw-output-label">输出文件夹</span>
            <span className="tw-output-path" title={draft.outputDir ?? ''}>
              {draft.outputDir ?? <span className="tw-output-placeholder">未选择</span>}
            </span>
            <button className="tw-btn tw-btn--secondary" onClick={pickOutputDir}>
              选择文件夹
            </button>
          </div>
          <div className="tw-output-row">
            <span className="tw-output-label">文件名</span>
            <input
              className="tw-output-name-input"
              value={draft.outputName}
              onChange={(e) => setDraft((prev) => ({ ...prev, outputName: e.target.value }))}
              placeholder="合并后的文件名.mkv"
            />
          </div>
          <div className="tw-output-submit">
            {editingJobId ? (
              <>
                <button className="tw-btn tw-btn--secondary" onClick={cancelEdit}>
                  取消编辑
                </button>
                <button
                  className="tw-btn tw-btn--primary"
                  disabled={!canSubmit}
                  onClick={updateJob}
                >
                  更新任务
                </button>
              </>
            ) : (
              <button className="tw-btn tw-btn--primary" disabled={!canSubmit} onClick={addToQueue}>
                加入队列
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── FilePanel ──────────────────────────────────────────────── */

interface FilePanelProps {
  role: 'a' | 'b';
  file: FileState;
  onPickFile: () => void;
  onUpdateTrack: (id: number, patch: Partial<Pick<SelectedTrack, 'selected' | 'label'>>) => void;
  onMoveTrack: (id: number, dir: -1 | 1) => void;
  loading?: boolean;
}

function FilePanel({
  role,
  file,
  onPickFile,
  onUpdateTrack,
  onMoveTrack,
  loading = false,
}: FilePanelProps) {
  const label = role === 'a' ? 'A 版' : 'B 版';
  const hint = role === 'a' ? '取视频轨 + 音频轨' : '取字幕轨';

  return (
    <div className="tw-panel">
      <div className="tw-panel-header">
        <span className={`tw-panel-badge tw-panel-badge--${role}`}>{label}</span>
        <span className="tw-panel-hint">{hint}</span>
        <button className="tw-btn tw-btn--secondary" onClick={onPickFile} disabled={loading}>
          {loading ? '识别中…' : file.path ? '重新选择' : '选择文件'}
        </button>
      </div>

      {file.path ? (
        <>
          <div className="tw-file-name" title={file.path}>
            {file.name}
          </div>
          <div className="tw-track-list">
            {file.tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                isFirst={idx === 0}
                isLast={idx === file.tracks.length - 1}
                onToggle={() => onUpdateTrack(track.id, { selected: !track.selected })}
                onLabelChange={(lbl) => onUpdateTrack(track.id, { label: lbl })}
                onMoveUp={() => onMoveTrack(track.id, -1)}
                onMoveDown={() => onMoveTrack(track.id, 1)}
              />
            ))}
          </div>
        </>
      ) : (
        <button className="tw-empty" onClick={onPickFile}>
          <span className="tw-empty-icon">📂</span>
          <span className="tw-empty-text">点击选择文件</span>
          <span className="tw-empty-hint">.mkv · .mp4 · .avi</span>
        </button>
      )}
    </div>
  );
}

/* ─── TrackRow ───────────────────────────────────────────────── */

interface TrackRowProps {
  track: SelectedTrack;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function TrackRow({
  track,
  isFirst,
  isLast,
  onToggle,
  onLabelChange,
  onMoveUp,
  onMoveDown,
}: TrackRowProps) {
  return (
    <div className={`tw-track${track.selected ? ' tw-track--selected' : ''}`}>
      <input
        type="checkbox"
        className="tw-track-check"
        checked={track.selected}
        onChange={onToggle}
      />
      <span className="tw-track-icon">{TRACK_ICON[track.type]}</span>
      <span className="tw-track-type">{TRACK_TYPE_CN[track.type]}</span>
      <span className="tw-track-codec">{track.codec}</span>
      {track.extra && <span className="tw-track-meta">{track.extra}</span>}
      {track.language && track.language !== 'und' && (
        <span className="tw-track-meta">{track.language}</span>
      )}
      {track.name && <span className="tw-track-meta tw-track-name-cell">{track.name}</span>}

      {track.selected && (
        <label className="tw-track-label-group">
          <span className="tw-track-label-hint">标签</span>
          <input
            className="tw-track-label-input"
            value={track.label}
            onChange={(e) => onLabelChange(e.target.value)}
          />
        </label>
      )}

      <div className="tw-track-reorder">
        <button className="tw-reorder-btn" disabled={isFirst} onClick={onMoveUp} title="上移">
          ▲
        </button>
        <button className="tw-reorder-btn" disabled={isLast} onClick={onMoveDown} title="下移">
          ▼
        </button>
      </div>
    </div>
  );
}
