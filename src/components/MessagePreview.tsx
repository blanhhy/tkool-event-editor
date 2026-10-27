import { useEffect, useMemo, useRef, useState } from 'react';
import { computeWindowSize, renderMessageWindow, type LoadedImage } from '@mywin/rm200x-renderer';
import { MESSAGE_LIMITS, splitCommandText, type FaceGraphicState } from '../lib/eventCommands';
import {
  buildMessageConfig,
  loadFaceImage,
  loadMessageSystemAssets,
  type MessageFaceAssets,
  type MessageSystemAssets,
} from '../lib/messagePreview';

interface Props {
  /** 对话框里正在编辑的文本 */
  text: string;
  /** 已打开的工程目录，用于读取 System 图 */
  root: FileSystemDirectoryHandle | null;
  /** 本页上方最近的「更改脸图」指令；null 表示没有脸图 */
  face?: FaceGraphicState | null;
}

/**
 * 显示文字指令的实时预览：直接调用 mywin 的渲染引擎，
 * 按引擎实际规则（4 行 × 64 半角、\c[n] 配色、像素字体、脸图）绘制消息窗口。
 * undefined 表示 System 图仍在加载。
 */
export default function MessagePreview({ text, root, face }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<MessageSystemAssets | null | undefined>(undefined);
  const [faceImage, setFaceImage] = useState<LoadedImage | null>(null);
  const [faceMissing, setFaceMissing] = useState(false);

  useEffect(() => {
    if (!root) {
      setAssets(null);
      return;
    }
    let cancelled = false;
    setAssets(undefined);
    void loadMessageSystemAssets(root).then((next) => {
      if (!cancelled) setAssets(next);
    });
    return () => {
      cancelled = true;
    };
  }, [root]);

  const faceName = face?.name ?? null;
  useEffect(() => {
    if (!root || !faceName) {
      setFaceImage(null);
      setFaceMissing(false);
      return;
    }
    let cancelled = false;
    setFaceImage(null);
    setFaceMissing(false);
    void loadFaceImage(root, faceName).then((image) => {
      if (cancelled) return;
      setFaceImage(image);
      setFaceMissing(!image);
    });
    return () => {
      cancelled = true;
    };
  }, [root, faceName]);

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
          未找到 System/System.png（可能使用 RTP 素材），仅显示文字
        </span>
      )}
      {faceMissing && faceName && (
        <span className="messagePreviewNote">未找到 FaceSet/{faceName}.png，未显示脸图</span>
      )}
    </div>
  );
}
