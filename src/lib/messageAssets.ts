import { loadExFont, parsePalette0, type LoadedImage } from '@mywin/rm200x-renderer';
import type { FaceGraphicState } from './eventCommands';
import { resolveFile } from './file';
import { bundledRtp, type RtpSource } from './rtp';

const SYSTEM_PATH = 'System/System.png';

/** System 图 + 抠透明色 */
export interface MessageSystemAssets {
  image: LoadedImage;
  /** System 图的透明色（调色板 index 0），边框的透明像素据此抠除 */
  transparentColor: string;
  /** project = 工程自带；rtp = 内置 RTP 兜底 */
  source: 'project' | 'rtp';
}

/** 脸图配置 + 已加载的图（图缺失时为 null） */
export interface MessageFaceAssets extends FaceGraphicState {
  image: LoadedImage | null;
}

/**
 * 预览所需的素材来源：工程目录优先，缺的用 RTP 兜底。
 * 预览组件只依赖这个接口，以后换成 RMM 的素材库时不用改组件。
 */
export interface MessageAssetProvider {
  loadSystem(): Promise<MessageSystemAssets | null>;
  loadFace(name: string): Promise<LoadedImage | null>;
  /** ExFont 只影响 $A-$z 字形，加载失败不影响其它渲染 */
  ensureExFont(): void;
}

/** 从 URL 读图；System 图还需要原始字节来解析调色板透明色 */
async function loadFromUrl(
  url: string,
): Promise<{ image: LoadedImage; bytes: Uint8Array } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { image: await createImageBitmap(new Blob([bytes])), bytes };
  } catch {
    return null;
  }
}

function createProvider(
  root: FileSystemDirectoryHandle | null,
  rtp: RtpSource,
): MessageAssetProvider {
  let systemPromise: Promise<MessageSystemAssets | null> | undefined;
  const facePromises = new Map<string, Promise<LoadedImage | null>>();
  let exfontRequested = false;

  const loadSystem = () => {
    systemPromise ??= (async () => {
      if (root) {
        try {
          const file = await resolveFile(root, SYSTEM_PATH);
          // 透明色必须从原始字节里读调色板：解码后的位图已经不保留调色板信息
          const bytes = new Uint8Array(await file.arrayBuffer());
          return {
            image: await createImageBitmap(file),
            transparentColor: parsePalette0(bytes) ?? '#000000',
            source: 'project' as const,
          };
        } catch {
          // 工程里没有 System 图：回退到 RTP
        }
      }

      if (!rtp.systemUrl) return null;
      const loaded = await loadFromUrl(rtp.systemUrl);
      if (!loaded) return null;
      return {
        image: loaded.image,
        transparentColor: parsePalette0(loaded.bytes) ?? '#000000',
        source: 'rtp' as const,
      };
    })();
    return systemPromise;
  };

  const loadFace = (name: string) => {
    const cached = facePromises.get(name);
    if (cached) return cached;

    const task = (async () => {
      const fileName = /\.(png|bmp)$/i.test(name) ? name : `${name}.png`;

      if (root) {
        try {
          return await createImageBitmap(await resolveFile(root, `FaceSet/${fileName}`));
        } catch {
          // 工程里没有这张脸图：回退到 RTP
        }
      }

      const url = rtp.faceUrl(fileName);
      if (!url) return null;
      const loaded = await loadFromUrl(url);
      return loaded?.image ?? null;
    })();

    facePromises.set(name, task);
    return task;
  };

  return {
    loadSystem,
    loadFace,
    ensureExFont: () => {
      if (exfontRequested || !rtp.exfontUrl) return;
      exfontRequested = true;
      void loadExFont(rtp.exfontUrl).catch(() => undefined);
    },
  };
}

const providers = new WeakMap<FileSystemDirectoryHandle, MessageAssetProvider>();
let rootlessProvider: MessageAssetProvider | null = null;

/** 按工程缓存 provider：反复打开预览不会重复解码素材 */
export function getMessageAssetProvider(
  root: FileSystemDirectoryHandle | null,
  rtp: RtpSource = bundledRtp,
): MessageAssetProvider {
  if (!root) return (rootlessProvider ??= createProvider(null, rtp));

  const cached = providers.get(root);
  if (cached) return cached;
  const created = createProvider(root, rtp);
  providers.set(root, created);
  return created;
}
