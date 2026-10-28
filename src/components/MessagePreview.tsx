import { useEffect, useMemo, useRef, useState } from 'react';
import { computeWindowSize, renderMessageWindow, type LoadedImage } from '@mywin/rm200x-renderer';
import {
  MESSAGE_LIMITS,
  splitCommandText,
  type FaceGraphicState,
  type SystemGraphicState,
} from '../lib/eventCommands';
import {
  getMessageAssetProvider,
  type MessageAssetProvider,
  type MessageFaceAssets,
  type MessageSystemAssets,
} from '../lib/messageAssets';
import { buildMessageConfig } from '../lib/messagePreview';

interface Props {
  /** 对话框里正在编辑的文本 */
  text: string;
  /** 已打开的工程目录，用于读取工程素材 */
  root: FileSystemDirectoryHandle | null;
  /** 本页上方最近的「更改脸图」指令；null 表示没有脸图 */
  face?: FaceGraphicState | null;
  /** 本页上方最近的「更改系统图像」指令；null 表示用数据库默认值 */
  system?: SystemGraphicState | null;
  /** 数据库设定的默认 System 图文件名 */
  systemGraphic?: string;
  /** 素材来源；默认按工程目录 + 内置 RTP 组合，可替换成别家实现 */
  provider?: MessageAssetProvider;
}

/**
 * 显示文字指令的实时预览：直接调用 mywin 的渲染引擎，
 * 按引擎实际规则（4 行 × 64 半角、\c[n] 配色、像素字体、脸图）绘制消息窗口。
 * undefined 表示 System 图仍在加载。
 */
export default function MessagePreview({
  text,
  root,
  face,
  system,
  systemGraphic,
  provider: injected,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const provider = useMemo(
    () => injected ?? getMessageAssetProvider(root),
    [injected, root],
  );
  const [assets, setAssets] = useState<MessageSystemAssets | null | undefined>(undefined);
  const [faceImage, setFaceImage] = useState<LoadedImage | null>(null);
  const [faceMissing, setFaceMissing] = useState(false);

  /** 本页最近的「更改系统图像」优先；没有就用数据库默认（再兜底 System） */
  const systemName = system?.name || systemGraphic || 'System';

  useEffect(() => {
    let cancelled = false;
    setAssets(undefined);
    provider.ensureExFont();
    void provider.loadSystem(systemName).then((next) => {
      if (!cancelled) setAssets(next);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, systemName]);

  const faceName = face?.name ?? null;
  useEffect(() => {
    if (!faceName) {
      setFaceImage(null);
      setFaceMissing(false);
      return;
    }
    let cancelled = false;
    setFaceImage(null);
    setFaceMissing(false);
    void provider.loadFace(faceName).then((image) => {
      if (cancelled) return;
      setFaceImage(image);
      setFaceMissing(!image);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, faceName]);

  /** 预览按写回时的换行规则排版，长行折行、超出 4 行的部分不会出现 */
  const previewText = useMemo(
    () => splitCommandText(text, MESSAGE_LIMITS).join('\n'),
    [text],
  );
  const faceAssets = useMemo<MessageFaceAssets | null>(
    () => (face ? { ...face, image: faceImage } : null),
    [face, faceImage],
  );
  const config = useMemo(
    () => (assets === undefined ? null : buildMessageConfig(previewText, assets, faceAssets)),
    [previewText, assets, faceAssets],
  );
  const size = useMemo(
    () => (config ? computeWindowSize(config) : { width: 320, height: 80 }),
    [config],
  );

  useEffect(() => {
    const out = canvasRef.current;
    if (!out || !config) return;
    const { canvas } = renderMessageWindow(config);
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
  }, [config]);

  if (!root) return null;

  return (
    <div className="messagePreview">
      <span className="messagePreviewLabel">预览</span>
      <div className="messagePreviewScreen">
        {config && (
          <canvas
            ref={canvasRef}
            className="messagePreviewCanvas"
            width={size.width}
            height={size.height}
          />
        )}
      </div>
      {assets === null && (
        <span className="messagePreviewNote">
          缺少 System 图{systemName === 'System' ? '' : ` ${systemName}`}，仅显示文字
        </span>
      )}
      {faceMissing && faceName && (
        <span className="messagePreviewNote">缺少脸图 {faceName}</span>
      )}
    </div>
  );
}
