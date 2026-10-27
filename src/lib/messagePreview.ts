import { DEFAULT_CONFIG, type MessageWindowConfig } from '@mywin/rm200x-renderer';
import type { MessageFaceAssets, MessageSystemAssets } from './messageAssets';

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
