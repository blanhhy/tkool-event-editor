import systemUrl from '../assets/rtp/System/System.png';
import exfontUrl from '../assets/rtp/Exfont.png';

/**
 * RTP 素材来源的抽象层。
 *
 * 现在只内置一套精简 RTP（来自 mywin），路径写死；以后 RMM 接入后，
 * 由它提供 RTP 映射与完整素材库，替换这里的实现即可，预览组件无需改动。
 */
export interface RtpSource {
  /** System 图（窗口边框 + 配色）的 URL */
  systemUrl: string | null;
  /** 按 FaceSet 名称取脸图 URL（不带扩展名也可）；找不到返回 null */
  faceUrl: (name: string) => string | null;
  /** ExFont 图 URL（只有 $A-$z 字形需要） */
  exfontUrl: string | null;
}

const faceModules = import.meta.glob('../assets/rtp/FaceSet/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** 文件名（不区分大小写）→ URL */
const faceUrls = new Map<string, string>();
for (const [path, url] of Object.entries(faceModules)) {
  const file = path.split('/').pop() ?? '';
  faceUrls.set(file.replace(/\.png$/i, '').toLowerCase(), url);
}

/** 内置精简 RTP（System + 5 套 FaceSet + ExFont） */
export const bundledRtp: RtpSource = {
  systemUrl,
  faceUrl: (name) => faceUrls.get(name.replace(/\.png$/i, '').toLowerCase()) ?? null,
  exfontUrl,
};
