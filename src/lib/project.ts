export const ENCODINGS = [
  { value: 'shift_jis', label: 'Shift_JIS' },
  { value: 'gbk', label: 'GBK' },
  { value: 'euc-jp', label: 'EUC-JP' },
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'latin1', label: 'Latin-1' },
] as const;

export type Encoding = (typeof ENCODINGS)[number]['value'];

export interface ProjectInfo {
  title: string | null;
  encoding: Encoding;
}

const INI_NAME = 'RPG_RT.ini';

function decode(bytes: ArrayBuffer, encoding: Encoding): string {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** 用替换字符数量粗略判断工程文本编码 */
function detectEncoding(bytes: ArrayBuffer): Encoding {
  const candidates: Encoding[] = ['utf-8', 'shift_jis', 'gbk', 'euc-jp'];
  let best: Encoding = 'shift_jis';
  let bestInvalid = Number.POSITIVE_INFINITY;

  for (const encoding of candidates) {
    const text = decode(bytes, encoding);
    const invalid = (text.match(/\uFFFD/g) ?? []).length;
    if (invalid < bestInvalid) {
      bestInvalid = invalid;
      best = encoding;
    }
    if (invalid === 0) break;
  }

  return best;
}

function parseGameTitle(text: string): string | null {
  const titles: Record<string, string> = {};
  let section = '';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'gametitle' && value) titles[section] = value;
  }

  return titles['rpg_rt'] ?? titles['game'] ?? null;
}

export async function readProjectInfo(root: FileSystemDirectoryHandle): Promise<ProjectInfo> {
  try {
    const file = await (await root.getFileHandle(INI_NAME)).getFile();
    const bytes = await file.arrayBuffer();
    const encoding = detectEncoding(bytes);
    return { title: parseGameTitle(decode(bytes, encoding)), encoding };
  } catch {
    return { title: null, encoding: 'shift_jis' };
  }
}

export async function readGameTitle(
  root: FileSystemDirectoryHandle,
  encoding: Encoding,
): Promise<string | null> {
  try {
    const file = await (await root.getFileHandle(INI_NAME)).getFile();
    return parseGameTitle(decode(await file.arrayBuffer(), encoding));
  } catch {
    return null;
  }
}
