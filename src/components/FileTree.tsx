import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { listDirectory, type DirEntry, type TreeClipboard } from '../lib/fs';
import ContextMenu, { type ContextMenuItem } from './ContextMenu';
import FileTypeIcon from './FileTypeIcon';
import { ChevronIcon } from './icons';

function copyPath(path: string) {
  if (!navigator.clipboard) return;
  void navigator.clipboard.writeText(path).catch(() => undefined);
}

/** 刷新时内容没变化就复用旧数组，避免整棵子树白白重渲染造成闪烁 */
function sameEntries(prev: DirEntry[] | null, next: DirEntry[]): boolean {
  if (!prev || prev.length !== next.length) return false;
  return prev.every((entry, index) => entry.name === next[index].name && entry.kind === next[index].kind);
}

/**
 * 同一目录同一时刻只跑一次读取。
 * 并行遍历同一个目录句柄在部分浏览器（含内置浏览器）里会让后发起的遍历一直挂起，
 * 而 StrictMode 的双次 effect 恰好会制造这种并行读取。
 */
const pendingLoads = new WeakMap<FileSystemDirectoryHandle, Promise<DirEntry[]>>();

function loadDirectory(handle: FileSystemDirectoryHandle): Promise<DirEntry[]> {
  const pending = pendingLoads.get(handle);
  if (pending) return pending;

  const promise = listDirectory(handle);
  pendingLoads.set(handle, promise);
  const clear = () => {
    if (pendingLoads.get(handle) === promise) pendingLoads.delete(handle);
  };
  promise.then(clear, clear);
  return promise;
}

export interface TreeActions {
  clipboard: TreeClipboard | null;
  renamingPath: string | null;
  onCopy: (path: string, entry: DirEntry) => void;
  onCut: (path: string, entry: DirEntry) => void;
  onPaste: (targetDir: string) => void;
  onStartRename: (path: string) => void;
  onCommitRename: (path: string, nextName: string) => void;
  onCancelRename: () => void;
  onDelete: (path: string, entry: DirEntry) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onCloseProject: () => void;
  onOpenProject: () => void;
}

const TreeActionsContext = createContext<TreeActions | null>(null);

function useTreeActions(): TreeActions {
  const actions = useContext(TreeActionsContext);
  if (!actions) throw new Error('TreeActions 未提供');
  return actions;
}

/** 不允许把条目粘贴到自身或自身子目录（否则会自我递归复制） */
function canPasteInto(clipboard: TreeClipboard | null, targetDir: string): boolean {
  if (!clipboard) return false;
  return targetDir !== clipboard.path && !targetDir.startsWith(`${clipboard.path}/`);
}

interface Props {
  root: FileSystemDirectoryHandle | null;
  selected: string | null;
  busy: boolean;
  refreshToken: number;
  actions: TreeActions;
  onSelect: (path: string, entry: DirEntry) => void;
  onDragStartFile: (path: string, entry: DirEntry) => void;
}

export default function FileTree({
  root,
  selected,
  busy,
  refreshToken,
  actions,
  onSelect,
  onDragStartFile,
}: Props) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextPath, setContextPath] = useState<string | null>(null);
  const [blankMenuAt, setBlankMenuAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!root) {
      setEntries(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // 刷新时保留当前列表，避免行组件卸载导致展开状态与滚动位置重置
    setError(null);
    setLoading(true);

    loadDirectory(root)
      .then((list) => {
        if (!cancelled) setEntries((prev) => (sameEntries(prev, list) ? prev : list));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '读取目录失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [root, refreshToken]);

  const blankItems: ContextMenuItem[] = [
    { id: 'new-file', label: '新建文件', onSelect: actions.onNewFile },
    { id: 'new-folder', label: '新建文件夹', onSelect: actions.onNewFolder },
    {
      id: 'paste',
      label: '粘贴',
      separatorBefore: true,
      disabled: !canPasteInto(actions.clipboard, ''),
      onSelect: () => actions.onPaste(''),
    },
    {
      id: 'close',
      label: '关闭工程',
      separatorBefore: true,
      onSelect: actions.onCloseProject,
    },
  ];

  return (
    <TreeActionsContext.Provider value={actions}>
      <div
        className="tree"
        role="tree"
        aria-label="工程文件"
        aria-busy={loading || undefined}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!root) return;
          if ((event.target as HTMLElement).closest('.treeRow')) return;
          setContextPath(null);
          setBlankMenuAt({ x: event.clientX, y: event.clientY });
        }}
      >
        {!root && (
          <div className="treeEmpty">
            <p>未打开工程</p>
            <button type="button" className="primaryBtn" onClick={actions.onOpenProject} disabled={busy}>
              {busy ? '正在打开…' : '打开工程'}
            </button>
          </div>
        )}
        {root && error && <div className="treeEmpty">{error}</div>}
        {root && !error && entries === null && <div className="treeEmpty">读取目录…</div>}
        {root && !error && entries?.length === 0 && <div className="treeEmpty">空目录</div>}
        {root &&
          !error &&
          entries?.map((entry) => (
            <TreeRow
              key={entry.name}
              entry={entry}
              path={entry.name}
              depth={0}
              selected={selected}
              refreshToken={refreshToken}
              contextPath={contextPath}
              onMenuOpen={setContextPath}
              onMenuClose={() => setContextPath(null)}
              onSelect={onSelect}
              onDragStartFile={onDragStartFile}
            />
          ))}

        {blankMenuAt && (
          <ContextMenu
            x={blankMenuAt.x}
            y={blankMenuAt.y}
            items={blankItems}
            onClose={() => setBlankMenuAt(null)}
          />
        )}
      </div>
    </TreeActionsContext.Provider>
  );
}

interface RowProps {
  entry: DirEntry;
  path: string;
  depth: number;
  selected: string | null;
  refreshToken: number;
  contextPath: string | null;
  onMenuOpen: (path: string) => void;
  onMenuClose: () => void;
  onSelect: (path: string, entry: DirEntry) => void;
  onDragStartFile: (path: string, entry: DirEntry) => void;
}

function TreeRow({
  entry,
  path,
  depth,
  selected,
  refreshToken,
  contextPath,
  onMenuOpen,
  onMenuClose,
  onSelect,
  onDragStartFile,
}: RowProps) {
  const actions = useTreeActions();
  const isDir = entry.kind === 'directory';
  const isRenaming = actions.renamingPath === path;
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameCancelledRef = useRef(false);

  useEffect(() => {
    if (!isDir || !expanded || children === null) return;

    let cancelled = false;
    // 静默刷新子项：不显示「读取中」，也不替换未变化的数组，避免列表闪烁
    loadDirectory(entry.handle as FileSystemDirectoryHandle)
      .then((list) => {
        if (!cancelled) setChildren((prev) => (sameEntries(prev, list) ? prev : list));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '读取目录失败');
      });

    return () => {
      cancelled = true;
    };
    // 仅在刷新令牌变化时重新读取，保留展开状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  async function activate() {
    onSelect(path, entry);
    if (!isDir) return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    if (children !== null) return;

    setLoading(true);
    setError(null);
    try {
      setChildren(await loadDirectory(entry.handle as FileSystemDirectoryHandle));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '读取目录失败');
    } finally {
      setLoading(false);
    }
  }

  const items: ContextMenuItem[] = isDir
    ? [
        {
          id: 'toggle',
          label: expanded ? '折叠' : '展开',
          onSelect: () => void activate(),
        },
        {
          id: 'cut',
          label: '剪切',
          separatorBefore: true,
          onSelect: () => actions.onCut(path, entry),
        },
        { id: 'copy', label: '复制', onSelect: () => actions.onCopy(path, entry) },
        {
          id: 'paste',
          label: '粘贴到此处',
          disabled: !canPasteInto(actions.clipboard, path),
          onSelect: () => actions.onPaste(path),
        },
        {
          id: 'copy-relative',
          label: '复制相对路径',
          onSelect: () => copyPath(path),
        },
        {
          id: 'rename',
          label: '重命名',
          separatorBefore: true,
          onSelect: () => {
            renameCancelledRef.current = false;
            actions.onStartRename(path);
          },
        },
        {
          id: 'delete',
          label: '删除',
          onSelect: () => actions.onDelete(path, entry),
        },
      ]
    : [
        { id: 'open', label: '打开', onSelect: () => onSelect(path, entry) },
        {
          id: 'cut',
          label: '剪切',
          separatorBefore: true,
          onSelect: () => actions.onCut(path, entry),
        },
        { id: 'copy', label: '复制', onSelect: () => actions.onCopy(path, entry) },
        {
          id: 'copy-relative',
          label: '复制相对路径',
          onSelect: () => copyPath(path),
        },
        {
          id: 'rename',
          label: '重命名',
          separatorBefore: true,
          onSelect: () => {
            renameCancelledRef.current = false;
            actions.onStartRename(path);
          },
        },
        {
          id: 'delete',
          label: '删除',
          onSelect: () => actions.onDelete(path, entry),
        },
      ];

  function commitRename(value: string) {
    if (renameCancelledRef.current) return;
    const nextName = value.trim();
    if (!nextName || nextName === entry.name) {
      actions.onCancelRename();
      return;
    }
    actions.onCommitRename(path, nextName);
  }

  return (
    <>
      <div
        className="treeRow"
        role="treeitem"
        aria-expanded={isDir ? expanded : undefined}
        aria-selected={contextPath !== null ? contextPath === path : selected === path}
        data-kind={entry.kind}
        data-selected={
          (contextPath !== null ? contextPath === path : selected === path) ? 'true' : undefined
        }
        data-cut={actions.clipboard?.mode === 'cut' && actions.clipboard.path === path ? 'true' : undefined}
        tabIndex={0}
        draggable={!isDir && !isRenaming}
        style={{ paddingLeft: 6 + depth * 14 }}
        onDragStart={(event) => {
          if (isDir) return;
          event.dataTransfer.setData('application/x-tkool-file', path);
          event.dataTransfer.effectAllowed = 'copy';
          onDragStartFile(path, entry);
        }}
        onMouseDown={(event) => {
          // 浏览器不会自动聚焦 tabindex 的 div，手动接管以便 :focus-within 生效
          if (!isRenaming) event.currentTarget.focus();
        }}
        onClick={activate}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onMenuOpen(path);
          setMenuAt({ x: event.clientX, y: event.clientY });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void activate();
          }
        }}
      >
        {isDir ? (
          <span className="chevron" data-expanded={expanded ? 'true' : 'false'}>
            <ChevronIcon size={12} />
          </span>
        ) : (
          <span className="chevronPlaceholder" />
        )}
        <FileTypeIcon name={entry.name} kind={isDir ? 'directory' : 'file'} size={16} />
        {isRenaming ? (
          <input
            ref={inputRef}
            className="treeRenameInput"
            defaultValue={entry.name}
            autoFocus
            spellCheck={false}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onFocus={(event) => {
              const target = event.currentTarget;
              const dot = isDir ? -1 : entry.name.lastIndexOf('.');
              target.setSelectionRange(0, dot > 0 ? dot : entry.name.length);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                renameCancelledRef.current = true;
                actions.onCancelRename();
              }
            }}
            onBlur={(event) => commitRename(event.currentTarget.value)}
          />
        ) : (
          <span className="treeLabel" title={path}>
            {entry.name}
          </span>
        )}
      </div>

      {menuAt && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          items={items}
          onClose={() => {
            setMenuAt(null);
            onMenuClose();
          }}
        />
      )}

      {isDir && expanded && (
        <>
          {loading && <div className="treeHint" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>读取中…</div>}
          {error && <div className="treeHint treeHintError" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>{error}</div>}
          {children?.map((child) => (
            <TreeRow
              key={child.name}
              entry={child}
              path={`${path}/${child.name}`}
              depth={depth + 1}
              selected={selected}
              refreshToken={refreshToken}
              contextPath={contextPath}
              onMenuOpen={onMenuOpen}
              onMenuClose={onMenuClose}
              onSelect={onSelect}
              onDragStartFile={onDragStartFile}
            />
          ))}
        </>
      )}
    </>
  );
}
