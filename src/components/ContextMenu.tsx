import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  separatorBefore?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** 触发区域：点击其中不会关闭菜单，便于再次点击按钮切换 */
  anchorRef?: RefObject<HTMLElement | null>;
}

const MARGIN = 6;

export default function ContextMenu({ x, y, items, onClose, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - rect.width - MARGIN)),
      top: Math.max(MARGIN, Math.min(y, window.innerHeight - rect.height - MARGIN)),
    });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      closeRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    const close = () => closeRef.current();

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [anchorRef]);

  return (
    <div
      ref={ref}
      className="contextMenu"
      role="menu"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {item.separatorBefore && index > 0 && <div className="menuSeparator" />}
          <button
            type="button"
            className="menuRow"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            <span className="menuRowLabel">{item.label}</span>
            {item.shortcut && <span className="menuRowShortcut">{item.shortcut}</span>}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
