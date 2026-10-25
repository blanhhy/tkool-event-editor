import type { Encoding } from './project';

export interface RecentProject {
  id: string;
  name: string;
  title: string | null;
  encoding: Encoding;
  openedAt: number;
  handle: FileSystemDirectoryHandle;
}

const DB_NAME = 'tkool-event-editor';
const STORE = 'recent-projects';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地记录'));
  });
}

export async function listRecentProjects(limit = 6): Promise<RecentProject[]> {
  const db = await openDb();
  try {
    return await new Promise<RecentProject[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => {
        const rows = (request.result as RecentProject[]).sort((a, b) => b.openedAt - a.openedAt);
        resolve(rows.slice(0, limit));
      };
      request.onerror = () => reject(request.error ?? new Error('无法读取最近工程'));
    });
  } finally {
    db.close();
  }
}

export async function saveRecentProject(project: RecentProject): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('无法保存最近工程'));
    });
  } finally {
    db.close();
  }
}

export async function removeRecentProject(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('无法移除最近工程'));
    });
  } finally {
    db.close();
  }
}
