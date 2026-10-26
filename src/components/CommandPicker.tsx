import { useEffect, useMemo, useState } from 'react';
import { buildCommandPages, splitCommandColumns } from '../lib/commandCatalog';
import type { CommandEnvironment } from '../lib/commandSpec';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 当前工程环境：决定页数（2k 没有第 4 页）与是否追加扩展指令集页 */
  environment?: CommandEnvironment;
}

/**
 * 事件指令选择弹窗，顺序与 RPG Maker 2003 的「插入指令」面板一致。
 * 敌群事件页使用「战斗事件指令」面板；第三方指令集各自占新页。
 * 具体插入逻辑尚未接入。
 */
export default function CommandPicker({ open, onClose, environment }: Props) {
  const [activePage, setActivePage] = useState(0);

  const pages = useMemo(
    () =>
      buildCommandPages({
        engine: environment?.engine ?? '2k3',
        runtime: environment?.runtime ?? 'rpg_rt',
        scope: environment?.scope,
      }),
    [environment?.engine, environment?.runtime, environment?.scope],
  );

  const page = pages[Math.min(activePage, pages.length - 1)];
  const columns = page ? splitCommandColumns(page) : [];
  const isBattle = environment?.scope === 'troop';

  // 每次打开都回到第一页
  useEffect(() => {
    if (open) setActivePage(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !page) return null;

  return (
    <div
      className="commandPickerOverlay"
      onMouseDown={(event) => {
        // 只有点在遮罩本身时才关闭
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="commandPicker"
        role="dialog"
        aria-modal="true"
        aria-label={isBattle ? '战斗事件指令' : '插入指令'}
      >
        <div className="commandPickerHeader">
          <span>{isBattle ? '战斗事件指令' : '插入指令'}</span>
          <button
            type="button"
            className="commandPickerClose"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {pages.length > 1 && (
          <div className="commandPickerTabs" role="tablist">
            {pages.map((item, index) => (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="tab"
                aria-selected={index === activePage}
                className="commandPickerTab"
                data-active={index === activePage ? 'true' : undefined}
                onClick={() => setActivePage(index)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="commandPickerBody">
          <div className="commandPickerGrid">
            {columns.map((column, index) => (
              <div key={index} className="commandPickerColumn">
                {column.map((entry) => (
                  <button
                    key={entry.code}
                    type="button"
                    className="commandPickerItem"
                    title={entry.label}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
