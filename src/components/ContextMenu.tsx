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
  /** 位置锚定到触发元素（如顶部菜单按钮），不再按光标做避让偏移 */
  anchored?: boolean;
}

const MARGIN = 6;
/** 菜单与光标（点击位置）之间的间距，保证弹出时不盖住点击点 */
const CURSOR_GAP = 6;

interface Bounds {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** 主区域（顶栏与状态栏之间）并内缩安全距离 */
function mainAreaBounds(): Bounds {
  const element = document.querySelector('[data-menu-boundary]');
  const rect = element?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      top: rect.top + MARGIN,
      left: rect.left + MARGIN,
      right: rect.right - MARGIN,
      bottom: rect.bottom - MARGIN,
    };
  }
  return {
    top: MARGIN,
    left: MARGIN,
    right: window.innerWidth - MARGIN,
    bottom: window.innerHeight - MARGIN,
  };
}

export default function ContextMenu({ x, y, items, onClose, anchorRef, anchored = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const area = mainAreaBounds();

    // 光标模式：靠近但不覆盖点击位置，空间不足时翻到另一侧
    // 锚定模式：位置由触发元素决定，仅在溢出主区域时收缩
    const gap = anchored ? 0 : CURSOR_GAP;

    let left = x + gap;
    if (!anchored && left + rect.width > area.right) left = x - gap - rect.width;
    left = Math.max(area.left, Math.min(left, area.right - rect.width));

    let top = y + gap;
    if (!anchored && top + rect.height > area.bottom) top = y - gap - rect.height;
    // 锚定模式允许贴着触发按钮（可略微压住顶栏下沿），其余情况限制在主区域内
    const minTop = anchored ? MARGIN : area.top;
    top = Math.max(minTop, Math.min(top, area.bottom - rect.height));

    setPosition({ left, top });
  }, [x, y, anchored]);

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
