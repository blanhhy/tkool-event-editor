export interface DirEntry {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
}

export interface ProjectStats {
  files: number;
  dirs: number;
  truncated: boolean;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
};

/** 部分浏览器（Safari / Firefox / 移动端）没有目录选择器 */
export function canPickDirectory(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error('当前浏览器不支持目录访问，请使用桌面版 Chrome 或 Edge。');
  }
  return picker.call(window, { mode: 'read' });
}

/** 重新打开历史目录时，浏览器会收回权限，需要在用户点击后重新申请 */
export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const target = handle as unknown as {
    queryPermission?: (descriptor: { mode: 'read' }) => Promise<PermissionState>;
    requestPermission?: (descriptor: { mode: 'read' }) => Promise<PermissionState>;
  };

  const current = await target.queryPermission?.({ mode: 'read' });
  if (current === 'granted' || !target.requestPermission) return true;

  const next = await target.requestPermission({ mode: 'read' });
  return next === 'granted';
}

/** 写入前按需申请读写权限，用户拒绝时返回 false */
export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const target = handle as unknown as {
    queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>;
  };

  const current = await target.queryPermission?.({ mode: 'readwrite' });
  if (current === 'granted') return true;
  if (!target.requestPermission) return false;

  const next = await target.requestPermission({ mode: 'readwrite' });
  return next === 'granted';
}

function iteratorOf(dir: FileSystemDirectoryHandle): AsyncIterableIterator<[string, FileSystemHandle]> {
  const withEntries = dir as unknown as {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  };
  return withEntries.entries();
}

/** 读取一层目录，目录在前、按名称自然排序 */
export async function listDirectory(dir: FileSystemDirectoryHandle): Promise<DirEntry[]> {
  const entries: DirEntry[] = [];
  for await (const [name, handle] of iteratorOf(dir)) {
    entries.push({
      name,
      kind: handle.kind === 'directory' ? 'directory' : 'file',
      handle,
    });
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
  });
  return entries;
}

/** 递归统计工程内的文件 / 文件夹数量，避免超大工程把页面卡住 */
export async function countProject(root: FileSystemDirectoryHandle, limit = 20000): Promise<ProjectStats> {
  let files = 0;
  let dirs = 0;
  const stack: FileSystemDirectoryHandle[] = [root];

  while (stack.length > 0 && files + dirs < limit) {
    const current = stack.pop() as FileSystemDirectoryHandle;
    for await (const [, handle] of iteratorOf(current)) {
      if (handle.kind === 'directory') {
        dirs += 1;
        stack.push(handle as FileSystemDirectoryHandle);
      } else {
        files += 1;
      }
      if (files + dirs >= limit) break;
    }
  }

  return { files, dirs, truncated: files + dirs >= limit };
}
