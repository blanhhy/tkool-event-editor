import { useEffect, useState, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

interface Props {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** 标题右侧的图标按钮等 */
  actions?: ReactNode;
  /** 与上一个栏目之间的分隔线 */
  divided?: boolean;
  children: ReactNode;
}

export default function SidePanelSection({
  title,
  open,
  onToggle,
  actions,
  divided,
  children,
}: Props) {
  return (
    <section
      className="panelSection"
      data-open={open ? 'true' : 'false'}
      data-divided={divided ? 'true' : undefined}
    >
      <div className="sidePanelHeader">
        <button
          type="button"
          className="sidePanelTitle"
          aria-expanded={open}
          title={open ? `折叠${title}` : `展开${title}`}
          onClick={onToggle}
        >
          <span className="chevron" data-expanded={open ? 'true' : 'false'}>
            <ChevronIcon size={12} />
          </span>
          <span className="sidePanelTitleText">{title}</span>
        </button>
        {actions && <div className="sidePanelActions">{actions}</div>}
      </div>
      <div className="sidePanelBody" data-collapsed={open ? undefined : 'true'}>
        {children}
      </div>
    </section>
  );
}

/** 可折叠的树节点行，事件管理器与后续栏目共用 */
export function TreeBranch({
  label,
  icon,
  depth,
  count,
  defaultOpen = false,
  expandSeq,
  children,
}: {
  label: string;
  icon: ReactNode;
  depth: number;
  count?: number;
  defaultOpen?: boolean;
  /** 外部要求展开的序号：变化时展开该分支（定位事件页时用） */
  expandSeq?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (expandSeq !== undefined) setOpen(true);
  }, [expandSeq]);

  return (
    <>
      <div
        className="treeRow"
        role="treeitem"
        aria-expanded={open}
        data-kind="directory"
        tabIndex={0}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => setOpen((value) => !value)}
        onMouseDown={(event) => event.currentTarget.focus()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
      >
        <span className="chevron" data-expanded={open ? 'true' : 'false'}>
          <ChevronIcon size={12} />
        </span>
        {icon}
        <span className="treeLabel" title={label}>
          {label}
        </span>
        {count !== undefined && <span className="treeCount">{count}</span>}
      </div>
      {open && children}
    </>
  );
}
