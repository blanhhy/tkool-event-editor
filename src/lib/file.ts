import { decoderFor, type Encoding } from './project';

export type FileKind = 'text' | 'image' | 'audio' | 'lcf' | 'other';

const TEXT_EXTENSIONS = new Set([
  'txt',
  'ini',
  'json',
  'js',
  'mjs',
  'ts',
  'tsx',
  'jsx',
  'css',
  'html',
  'htm',
  'xml',
  'md',
  'csv',
  'cfg',
  'log',
  'yml',
  'yaml',
  'r3proj',
  'bat',
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']);

const AUDIO_EXTENSIONS = new Set(['ogg', 'wav', 'mp3', 'm4a', 'flac']);

const LCF_EXTENSIONS = new Set(['ldb', 'lmu', 'lmt', 'lsd', 'lcf']);

export function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index + 1).toLowerCase();
}

export function fileKind(name: string): FileKind {
  const ext = extensionOf(name);
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (LCF_EXTENSIONS.has(ext)) return 'lcf';
  return 'other';
}

export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case 'text':
      return '文本';
    case 'image':
      return '图片';
    case 'audio':
      return '音频';
    case 'lcf':
      return 'LCF 数据';
    default:
      return '二进制';
  }
}

export interface DecodedText {
  text: string;
  encoding: Encoding;
  editable: boolean;
}

/**
 * 优先按 UTF-8 严格解码，失败时回退到工程编码。
 * 浏览器只能编码 UTF-8，因此非 UTF-8 内容只读。
 */
export function decodeText(bytes: ArrayBuffer, fallback: Encoding): DecodedText {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: '65001', editable: true };
  } catch {
    return decodeTextAs(bytes, fallback);
  }
}

/** 按指定编码解码指定文件（用户手动选择的文件编码） */
export function decodeTextAs(bytes: ArrayBuffer, encoding: Encoding): DecodedText {
  return {
    text: new TextDecoder(decoderFor(encoding)).decode(bytes),
    encoding,
    editable: encoding === '65001',
  };
}

export async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle> {
  const parts = path.split('/');
  let dir = root;
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part);
  }
  return dir.getFileHandle(parts[parts.length - 1]);
}

export async function resolveFile(root: FileSystemDirectoryHandle, path: string): Promise<File> {
  return (await resolveFileHandle(root, path)).getFile();
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}
