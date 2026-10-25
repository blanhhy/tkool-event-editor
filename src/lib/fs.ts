export interface DirEntry {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
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

/**
 * 同一目录的枚举排队执行：部分内嵌浏览器（Trae 内置浏览器等）在并发调用
 * entries() 时会一直挂起，串行化后不会再卡住。
 */
const enumerationQueue = new WeakMap<FileSystemDirectoryHandle, Promise<unknown>>();

async function enumerate(
  dir: FileSystemDirectoryHandle,
): Promise<[string, FileSystemHandle][]> {
  const previous = enumerationQueue.get(dir) ?? Promise.resolve();
  const task = previous.then(async () => {
    const withEntries = dir as unknown as {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    const entries: [string, FileSystemHandle][] = [];
    for await (const entry of withEntries.entries()) entries.push(entry);
    return entries;
  });

  enumerationQueue.set(dir, task.catch(() => undefined));
  return task;
}

export async function* iteratorOf(
  dir: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle]> {
  yield* await enumerate(dir);
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

export interface TreeClipboard {
  mode: 'copy' | 'cut';
  path: string;
  name: string;
  kind: 'file' | 'directory';
}

export function splitPath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf('/');
  return index === -1
    ? { dir: '', name: path }
    : { dir: path.slice(0, index), name: path.slice(index + 1) };
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

export async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of path.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part);
  }
  return dir;
}

export async function resolveEntry(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemHandle | null> {
  const { dir: dirPath, name } = splitPath(path);
  const dir = await resolveDirectory(root, dirPath);
  try {
    return await dir.getFileHandle(name);
  } catch {
    try {
      return await dir.getDirectoryHandle(name);
    } catch {
      return null;
    }
  }
}

async function nameExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    try {
      await dir.getDirectoryHandle(name);
      return true;
    } catch {
      return false;
    }
  }
}

/** 冲突时生成「名称 (2)」这类不重名的名字 */
export async function uniqueName(
  dir: FileSystemDirectoryHandle,
  name: string,
  isDir: boolean,
): Promise<string> {
  if (!(await nameExists(dir, name))) return name;

  const dot = isDir ? -1 : name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} (${index})${ext}`;
    if (!(await nameExists(dir, candidate))) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

async function copyRecursive(
  source: FileSystemHandle,
  targetDir: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  if (source.kind === 'directory') {
    const dest = await targetDir.getDirectoryHandle(name, { create: true });
    for await (const [childName, child] of iteratorOf(source as FileSystemDirectoryHandle)) {
      await copyRecursive(child, dest, childName);
    }
    return;
  }

  const file = await (source as FileSystemFileHandle).getFile();
  const handle = await targetDir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

/** 复制到目标目录（自动避开重名），返回新路径 */
export async function copyEntry(
  root: FileSystemDirectoryHandle,
  path: string,
  targetDirPath: string,
): Promise<string> {
  if (targetDirPath === path || targetDirPath.startsWith(`${path}/`)) {
    throw new Error('不能复制到自身目录');
  }
  const source = await resolveEntry(root, path);
  if (!source) throw new Error('源文件不存在');
  const { name } = splitPath(path);
  const targetDir = await resolveDirectory(root, targetDirPath);
  const nextName = await uniqueName(targetDir, name, source.kind === 'directory');
  await copyRecursive(source, targetDir, nextName);
  return joinPath(targetDirPath, nextName);
}

/** 移动（剪切粘贴），返回新路径 */
export async function moveEntry(
  root: FileSystemDirectoryHandle,
  path: string,
  targetDirPath: string,
): Promise<string> {
  if (targetDirPath === path || targetDirPath.startsWith(`${path}/`)) {
    throw new Error('不能移动到自身目录');
  }
  const source = await resolveEntry(root, path);
  if (!source) throw new Error('源文件不存在');
  const { dir: sourceDirPath, name } = splitPath(path);
  if (sourceDirPath === targetDirPath) return path;

  const targetDir = await resolveDirectory(root, targetDirPath);
  const nextName = await uniqueName(targetDir, name, source.kind === 'directory');
  await copyRecursive(source, targetDir, nextName);
  await (await resolveDirectory(root, sourceDirPath)).removeEntry(name, { recursive: true });
  return joinPath(targetDirPath, nextName);
}

/** 重命名（同一目录内），返回新路径 */
export async function renameEntry(
  root: FileSystemDirectoryHandle,
  path: string,
  nextName: string,
): Promise<string> {
  const { dir: dirPath, name } = splitPath(path);
  if (nextName === name) return path;

  const source = await resolveEntry(root, path);
  if (!source) throw new Error('源文件不存在');
  const dir = await resolveDirectory(root, dirPath);
  if (await nameExists(dir, nextName)) throw new Error('同名文件已存在');

  await copyRecursive(source, dir, nextName);
  await dir.removeEntry(name, { recursive: true });
  return joinPath(dirPath, nextName);
}

export async function deleteEntry(root: FileSystemDirectoryHandle, path: string): Promise<void> {
  const { dir: dirPath, name } = splitPath(path);
  const dir = await resolveDirectory(root, dirPath);
  await dir.removeEntry(name, { recursive: true });
}
