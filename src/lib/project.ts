export interface EncodingOption {
  /** 与 RPG_RT.ini / EasyRPG [EasyRPG] Encoding 一致的代码页值 */
  value: string;
  /** TextDecoder 使用的编码标签 */
  decoder: string;
  label: string;
}

/**
 * 取自 R48 启动器的 RM2k/2k3 编码列表（CP1252 / UTF-8 / MS932 / CP1251 /
 * CP1250 / MS949 / MS936 / CP950），其中 CP950 即繁体中文。
 */
export const ENCODINGS: readonly EncodingOption[] = [
  { value: '1252', decoder: 'windows-1252', label: '西欧 (CP1252)' },
  { value: '65001', decoder: 'utf-8', label: 'UTF-8 (65001)' },
  { value: '932', decoder: 'shift_jis', label: '日文 (MS932)' },
  { value: '1251', decoder: 'windows-1251', label: '俄文 (CP1251)' },
  { value: '1250', decoder: 'windows-1250', label: '中欧 (CP1250)' },
  { value: '949', decoder: 'euc-kr', label: '韩文 (MS949)' },
  { value: '936', decoder: 'gbk', label: '简体中文 (MS936)' },
  { value: '950', decoder: 'big5', label: '繁体中文 (CP950)' },
];

export type Encoding = (typeof ENCODINGS)[number]['value'];

export const DEFAULT_ENCODING: Encoding = '932';

export function decoderFor(encoding: Encoding): string {
  return ENCODINGS.find((item) => item.value === encoding)?.decoder ?? 'utf-8';
}

/** RPG_RT.ini / EasyRPG 允许的编码写法（代码页数字或常见别名），旧版本配置里的名字也在这里兼容 */
const ENCODING_ALIASES: Record<string, Encoding> = {
  '1252': '1252',
  cp1252: '1252',
  'windows-1252': '1252',
  latin1: '1252',
  'latin-1': '1252',
  'iso-8859-1': '1252',
  '65001': '65001',
  'utf-8': '65001',
  utf8: '65001',
  '932': '932',
  ms932: '932',
  cp932: '932',
  sjis: '932',
  shift_jis: '932',
  'shift-jis': '932',
  '1251': '1251',
  cp1251: '1251',
  'windows-1251': '1251',
  '1250': '1250',
  cp1250: '1250',
  'windows-1250': '1250',
  '949': '949',
  ms949: '949',
  cp949: '949',
  'euc-kr': '949',
  euckr: '949',
  '936': '936',
  ms936: '936',
  cp936: '936',
  gbk: '936',
  gb2312: '936',
  '950': '950',
  ms950: '950',
  cp950: '950',
  big5: '950',
};

/** 把 RPG_RT.ini / 旧配置里的任意写法规范成内部编码值 */
export function normalizeEncoding(value: unknown): Encoding | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().replace(/^["']|["']$/g, '').toLowerCase();
  return ENCODING_ALIASES[key] ?? null;
}

export interface ProjectInfo {
  title: string | null;
  encoding: Encoding;
}

const INI_NAME = 'RPG_RT.ini';

function decode(bytes: ArrayBuffer, encoding: Encoding): string {
  try {
    return new TextDecoder(decoderFor(encoding)).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** 用替换字符数量粗略判断工程文本编码；CP1252 作为最后的兜底 */
function detectEncoding(bytes: ArrayBuffer): Encoding {
  const candidates: Encoding[] = ['65001', '932', '936', '950', '949', '1251', '1250', '1252'];
  let best: Encoding = DEFAULT_ENCODING;
  let bestInvalid = Number.POSITIVE_INFINITY;

  for (const encoding of candidates) {
    const text = new TextDecoder(decoderFor(encoding)).decode(bytes);
    const invalid = (text.match(/\uFFFD/g) ?? []).length;
    if (invalid < bestInvalid) {
      bestInvalid = invalid;
      best = encoding;
    }
    if (invalid === 0) break;
  }

  return best;
}

interface IniInfo {
  title: string | null;
  encoding: Encoding | null;
}

function parseIni(text: string): IniInfo {
  const titles: Record<string, string> = {};
  let section = '';
  let encoding: Encoding | null = null;

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
    if (key === 'encoding' && section === 'easyrpg' && !encoding) {
      encoding = normalizeEncoding(value);
    }
  }

  return {
    title: titles['rpg_rt'] ?? titles['game'] ?? null,
    encoding,
  };
}

function parseGameTitle(text: string): string | null {
  return parseIni(text).title;
}

export async function readProjectInfo(root: FileSystemDirectoryHandle): Promise<ProjectInfo> {
  try {
    const file = await (await root.getFileHandle(INI_NAME)).getFile();
    const bytes = await file.arrayBuffer();
    // 键名是 ASCII，先用 CP1252 读出结构，再看 [EasyRPG] 是否显式声明编码
    const ini = parseIni(decode(bytes, '1252'));
    const encoding = ini.encoding ?? detectEncoding(bytes);
    return { title: parseGameTitle(decode(bytes, encoding)), encoding };
  } catch {
    return { title: null, encoding: DEFAULT_ENCODING };
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
