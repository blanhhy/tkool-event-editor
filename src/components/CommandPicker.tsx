import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildCommandPages, splitCommandColumns, type CommandEntry } from '../lib/commandCatalog';
import type { CommandEnvironment } from '../lib/commandSpec';
import type { CommandDraft, FaceGraphicState } from '../lib/eventCommands';
import CommandParamsForm from './CommandParamsForm';

/** 条目高度与间距，用于把面板撑到「堆满一列指令」的高度 */
const ITEM_HEIGHT = 26;
const ITEM_GAP = 3;
/** 条目左右内边距 8×2 + 边框 1×2 + 少量余量 */
const ITEM_CHROME = 32;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 当前工程环境：决定页数（2k 没有第 4 页）与是否追加扩展指令集页 */
  environment?: CommandEnvironment;
  /** 工程目录：参数面板的渲染预览需要读取 System 图 */
  projectRoot?: FileSystemDirectoryHandle | null;
  /** 编辑态：双击的指令（含原参数与文本），打开时默认选中同码指令并回填 */
  editing?: CommandDraft | null;
  /** 本页上方最近的「更改脸图」指令：显示文字的预览据此渲染脸图 */
  face?: FaceGraphicState | null;
  /** 参数表单点「确定」：把配置好的指令交给事件页插入 */
  onInsert?: (draft: CommandDraft) => void;
}

/**
 * 事件指令选择弹窗，顺序与 RPG Maker 2003 的「插入指令」面板一致。
 * 敌群事件页使用「战斗事件指令」面板；第三方指令集各自占新页。
 * 固定两列、固定高度；条目宽度取所有页里最长的指令名。
 * 选中指令后右侧显示参数表单，确定后交给事件页插入。
 */
export default function CommandPicker({
  open,
  onClose,
  environment,
  projectRoot,
  editing,
  face,
  onInsert,
}: Props) {
  const [activePage, setActivePage] = useState(0);
  const [selected, setSelected] = useState<CommandEntry | null>(null);
  const [itemWidth, setItemWidth] = useState<number | null>(null);
  const probeRef = useRef<HTMLDivElement>(null);

  const engine = environment?.engine ?? '2k3';
  const pages = useMemo(
    () =>
      buildCommandPages({
        engine,
        runtime: environment?.runtime ?? 'rpg_rt',
        scope: environment?.scope,
      }),
    [engine, environment?.runtime, environment?.scope],
  );

  const page = pages[Math.min(activePage, pages.length - 1)];
  const columns = page ? splitCommandColumns(page) : [[], []];
  const isBattle = environment?.scope === 'troop';

  /** 所有页的指令名：条目宽度按其中最长的一条来定 */
  const allLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const item of pages) {
      for (const entry of item.entries) labels.add(entry.label);
    }
    return [...labels];
  }, [pages]);

  // 用一个隐藏的探针量出「所有页」里最长指令名的实际文本宽度（字体与条目一致）。
  // 探针只在 open 时挂载，因此依赖里必须带上 open，否则首次打开时测不到，
  // 条目会退回自然宽度，导致切换页时整个窗口跟着变宽变窄。
  useLayoutEffect(() => {
    if (!open) return;
    const probe = probeRef.current;
    if (!probe) return;
    setItemWidth(Math.ceil(probe.getBoundingClientRect().width) + ITEM_CHROME);
  }, [open, allLabels]);

  // 编辑态：在所有页里找同码指令，定位到它所在的页并选中
  const editEntry = useMemo(() => {
    if (!editing) return null;
    for (let index = 0; index < pages.length; index += 1) {
      const entry = pages[index].entries.find((item) => item.code === editing.code);
      if (entry) return { page: index, entry };
    }
    return null;
  }, [editing, pages]);

  // 每次打开都回到第一页，并清掉上一次选中的指令；编辑态直接选中原指令
  useEffect(() => {
    if (!open) return;
    if (editEntry) {
      setActivePage(editEntry.page);
      setSelected(editEntry.entry);
      return;
    }
    setActivePage(0);
    setSelected(null);
  }, [open, editEntry]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !page) return null;

  // 面板高度按「一列堆满 maxRows 条」计算，内容多少都不影响
  const rows = Math.max(1, page.maxRows);
  const gridHeight = rows * ITEM_HEIGHT + (rows - 1) * ITEM_GAP;

  return (
    // 点击外部不关闭：只能通过右上角关闭、取消或 Esc 退出
    <div className="commandPickerOverlay">
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

        <div className="commandPickerBody" style={{ height: gridHeight }}>
          <div className="commandPickerList">
            <div className="commandPickerGrid">
              {columns.map((column, index) => (
                <div key={index} className="commandPickerColumn">
                  {column.map((entry) => (
                    <button
                      key={entry.code}
                      type="button"
                      className="commandPickerItem"
                      style={itemWidth ? { width: itemWidth } : undefined}
                      data-selected={selected?.code === entry.code ? 'true' : undefined}
                      title={entry.label}
                      onClick={() => setSelected(entry)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="commandParamsPane">
            {selected ? (
              <CommandParamsForm
                key={`${selected.code}-${engine}-${editing ? 'edit' : 'new'}`}
                code={selected.code}
                label={selected.label}
                engine={engine}
                root={projectRoot}
                face={face}
                initial={
                  editing && selected.code === editing.code
                    ? { parameters: editing.parameters, text: editing.text }
                    : null
                }
                onCancel={onClose}
                onConfirm={(draft) => {
                  onInsert?.(draft);
                  onClose();
                }}
              />
            ) : (
              <div className="commandParamsPlaceholder">选择一个指令以配置参数</div>
            )}
          </div>
        </div>

        {/* 隐藏的测量节点：宽度等于最长指令名 */}
        <div className="commandPickerMeasure" aria-hidden="true" ref={probeRef}>
          {allLabels.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
