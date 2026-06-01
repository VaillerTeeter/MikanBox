import type { Subject } from 'bangumi-api-client';

export type WatchStatus = '正在追番' | '补番计划' | '已完番剧';

export interface WatchEntry {
  status: WatchStatus;
  subject: Subject;
  updatedAt: number;
}

const STORAGE_KEY = 'mikanbox-watch-store';

export function loadWatchStore(): Record<number, WatchEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function setWatchEntry(subject: Subject, status: WatchStatus): void {
  const store = loadWatchStore();
  store[subject.id] = { status, subject, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function removeWatchEntry(id: number): void {
  const store = loadWatchStore();
  delete store[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/** 返回所有已标记条目的 { id → status } 映射（不含无状态条目） */
export function loadStatusMap(): Record<number, WatchStatus> {
  const store = loadWatchStore();
  const map: Record<number, WatchStatus> = {};
  for (const [id, entry] of Object.entries(store)) {
    map[Number(id)] = entry.status;
  }
  return map;
}

/** 返回某个 status 下所有条目，按 updatedAt 降序（最新标记的在前） */
export function loadEntriesByStatus(status: WatchStatus): WatchEntry[] {
  const store = loadWatchStore();
  return Object.values(store)
    .filter((e) => e.status === status)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
