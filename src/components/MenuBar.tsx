import { useRef, useState, type MouseEvent } from 'react';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';

type MenuId = 'file' | 'edit';

interface Props {
  fileItems: ContextMenuItem[];
  editItems: ContextMenuItem[];
}

export default function MenuBar({ fileItems, editItems }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<MenuId | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const toggle = (id: MenuId, event: MouseEvent<HTMLButtonElement>) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom + 4 });
    setOpen(id);
  };

  const triggers: { id: MenuId; label: string }[] = [
    { id: 'file', label: '文件' },
    { id: 'edit', label: '编辑' },
  ];

  return (
    <div className="menuBar" ref={barRef} role="menubar">
      {triggers.map((trigger) => (
        <button
          key={trigger.id}
          type="button"
          className="menuBarItem"
          data-open={open === trigger.id ? 'true' : undefined}
          aria-haspopup="menu"
          aria-expanded={open === trigger.id}
          onClick={(event) => toggle(trigger.id, event)}
        >
          {trigger.label}
        </button>
      ))}

      {open && (
        <ContextMenu
          x={position.x}
          y={position.y}
          items={open === 'file' ? fileItems : editItems}
          onClose={() => setOpen(null)}
          anchorRef={barRef}
          anchored
        />
      )}
    </div>
  );
}
