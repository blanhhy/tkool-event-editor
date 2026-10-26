import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 事件指令选择弹窗（仿 RPG Maker 的「插入指令」对话框）。
 * 目前只有外壳，指令列表与插入逻辑后续接入。
 */
export default function CommandPicker({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="commandPickerOverlay"
      onMouseDown={(event) => {
        // 只有点在遮罩本身时才关闭
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="commandPicker" role="dialog" aria-modal="true" aria-label="插入指令">
        <div className="commandPickerHeader">
          <span>插入指令</span>
          <button
            type="button"
            className="commandPickerClose"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="commandPickerBody" />
      </div>
    </div>
  );
}
