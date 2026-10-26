import { isEngine, isRuntime, type Engine, type Runtime } from './environment';
import { ensureWritePermission } from './fs';
import { DEFAULT_ENCODING, ENCODINGS, normalizeEncoding, type Encoding } from './project';

export const CONFIG_NAME = 'RPG_RT.json';

export interface ProjectConfig {
  version: 1;
  encoding: Encoding;
  /** 数据库引擎；null 表示配置中未存储（读取时会自动探测并写回） */
  engine: Engine | null;
  /** 第三方运行环境；null 表示配置中未存储（扫描指令后自动发现并写回） */
  runtime: Runtime | null;
}

export interface ProjectConfigInput {
  encoding: Encoding;
  engine?: Engine | null;
  runtime?: Runtime | null;
}

export async function readProjectConfig(root: FileSystemDirectoryHandle): Promise<ProjectConfig | null> {
  try {
    const file = await (await root.getFileHandle(CONFIG_NAME)).getFile();
    const data: unknown = JSON.parse(await file.text());
    if (typeof data !== 'object' || data === null) return null;
    const record = data as { encoding?: unknown; engine?: unknown; runtime?: unknown };
    const encoding = normalizeEncoding(record.encoding);
    return {
      version: 1,
      encoding: encoding && ENCODINGS.some((item) => item.value === encoding) ? encoding : DEFAULT_ENCODING,
      engine: isEngine(record.engine) ? record.engine : null,
      runtime: isRuntime(record.runtime) ? record.runtime : null,
    };
  } catch {
    return null;
  }
}

/** 写入工程配置；没有写入权限或失败时返回 false */
export async function writeProjectConfig(
  root: FileSystemDirectoryHandle,
  config: ProjectConfigInput,
): Promise<boolean> {
  if (!(await ensureWritePermission(root))) return false;

  try {
    const handle = await root.getFileHandle(CONFIG_NAME, { create: true });
    const writable = await handle.createWritable();
    const body = `${JSON.stringify(
      {
        version: 1,
        encoding: config.encoding,
        // 未探测到的字段不写进配置，下次打开时会再次尝试
        ...(config.engine ? { engine: config.engine } : {}),
        ...(config.runtime ? { runtime: config.runtime } : {}),
      },
      null,
      2,
    )}\n`;
    await writable.write(new TextEncoder().encode(body));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
