import {
  DEFAULT_CONFIG,
  parsePalette0,
  type LoadedImage,
  type MessageWindowConfig,
} from '@mywin/rm200x-renderer';
import type { FaceGraphicState } from './eventCommands';
import { resolveFile } from './file';

/** 消息窗口渲染所需、且由工程目录提供的资源 */
export interface MessageSystemAssets {
  image: LoadedImage;
  /** System 图的透明色（调色板 index 0），边框的透明像素据此抠除 */
  transparentColor: string;
}

/** 脸图配置 + 已加载的图（图缺失时为 null） */
export interface MessageFaceAssets extends FaceGraphicState {
  image: LoadedImage | null;
}

const SYSTEM_PATH = 'System/System.png';

/**
 * 同一工程只加载一次 System 图。
 * 工程内容在打开期间不会变（改了也会重新打开工程），因此按 handle 缓存即可。
 */
const cache = new WeakMap<FileSystemDirectoryHandle, Promise<MessageSystemAssets | null>>();

export function loadMessageSystemAssets(
  root: FileSystemDirectoryHandle,
): Promise<MessageSystemAssets | null> {
  const cached = cache.get(root);
  if (cached) return cached;

  const task = (async () => {
    try {
      const file = await resolveFile(root, SYSTEM_PATH);
      // 透明色必须从原始字节里读调色板：解码后的位图已经不保留调色板信息
      const bytes = new Uint8Array(await file.arrayBuffer());
      const transparentColor = parsePalette0(bytes) ?? '#000000';
      const image = await createImageBitmap(file);
      return { image, transparentColor };
    } catch {
      return null;
    }
  })();

  cache.set(root, task);
  return task;
}

/** 按工程 + 脸图名缓存；同一张脸图会被多条消息复用 */
const faceCache = new WeakMap<
  FileSystemDirectoryHandle,
  Map<string, Promise<LoadedImage | null>>
>();

export function loadFaceImage(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<LoadedImage | null> {
  let byName = faceCache.get(root);
  if (!byName) {
    byName = new Map();
    faceCache.set(root, byName);
  }

  const cached = byName.get(name);
  if (cached) return cached;

  const task = (async () => {
    try {
      const path = /\.(png|bmp)$/i.test(name) ? `FaceSet/${name}` : `FaceSet/${name}.png`;
      return await createImageBitmap(await resolveFile(root, path));
    } catch {
      return null;
    }
  })();

  byName.set(name, task);
  return task;
}

/**
 * 按引擎实际渲染规则生成预览配置。
 * 缺 System 图时退化为无边框文字，便于看清换行与配色。
 */
export function buildMessageConfig(
  text: string,
  assets: MessageSystemAssets | null,
  face?: MessageFaceAssets | null,
): MessageWindowConfig {
  const system = {
    name: assets ? 'System' : null,
    image: assets?.image ?? null,
    transparentColor: assets?.transparentColor ?? '#000000',
  };
  return {
    ...DEFAULT_CONFIG,
    text,
    backgroundMode: assets ? 'system' : 'transparent',
    backgroundSystem: system,
    colorSystem: system,
    faceMode: face?.image ? 'face' : 'none',
    faceSet: { name: face?.name ?? null, image: face?.image ?? null },
    faceIndex: face?.index ?? 0,
    facePosition: face?.atRight ? 'right' : 'left',
    faceFlipX: face?.flipped ?? false,
  };
}
