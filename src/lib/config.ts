import { ensureWritePermission } from './fs';
import { DEFAULT_ENCODING, ENCODINGS, normalizeEncoding, type Encoding } from './project';

export const CONFIG_NAME = 'RPG_RT.json';

export interface ProjectConfig {
  version: 1;
  encoding: Encoding;
}

export async function readProjectConfig(root: FileSystemDirectoryHandle): Promise<ProjectConfig | null> {
  try {
    const file = await (await root.getFileHandle(CONFIG_NAME)).getFile();
    const data: unknown = JSON.parse(await file.text());
    if (typeof data !== 'object' || data === null) return null;
    const encoding = normalizeEncoding((data as { encoding?: unknown }).encoding);
    return {
      version: 1,
      encoding: encoding && ENCODINGS.some((item) => item.value === encoding) ? encoding : DEFAULT_ENCODING,
    };
  } catch {
    return null;
  }
}

/** 写入工程配置；没有写入权限或失败时返回 false */
export async function writeProjectConfig(
  root: FileSystemDirectoryHandle,
  encoding: Encoding,
): Promise<boolean> {
  if (!(await ensureWritePermission(root))) return false;

  try {
    const handle = await root.getFileHandle(CONFIG_NAME, { create: true });
    const writable = await handle.createWritable();
    const body = `${JSON.stringify({ version: 1, encoding }, null, 2)}\n`;
    await writable.write(new TextEncoder().encode(body));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
