import { useEffect, useState } from 'react';
import { listDirectory, type DirEntry } from '../lib/fs';
import ContextMenu from './ContextMenu';
import FileTypeIcon from './FileTypeIcon';
import { ChevronIcon, FolderIcon, FolderOpenIcon } from './icons';

function copyPath(path: string) {
  if (!navigator.clipboard) return;
  void navigator.clipboard.writeText(path).catch(() => undefined);
}

interface Props {
  root: FileSystemDirectoryHandle | null;
  selected: string | null;
  busy: boolean;
  refreshToken: number;
  onSelect: (path: string, entry: DirEntry) => void;
  onDragStartFile: (path: string, entry: DirEntry) => void;
  onOpenProject: () => void;
}

export default function FileTree({
  root,
  selected,
  busy,
  refreshToken,
  onSelect,
  onDragStartFile,
  onOpenProject,
}: Props) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contextPath, setContextPath] = useState<string | null>(null);

  useEffect(() => {
    if (!root) {
      setEntries(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setEntries(null);
    setError(null);
    setLoading(true);

    listDirectory(root)
      .then((list) => {
        if (!cancelled) setEntries(list);
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

  if (!root) {
    return (
      <div className="treeEmpty">
        <p>未打开工程</p>
        <button type="button" className="primaryBtn" onClick={onOpenProject} disabled={busy}>
          {busy ? '正在打开…' : '打开工程'}
        </button>
      </div>
    );
  }

  if (error) {
    return <div className="treeEmpty">{error}</div>;
  }

  if (loading || entries === null) {
    return <div className="treeEmpty">读取目录…</div>;
  }

  if (entries.length === 0) {
    return <div className="treeEmpty">空目录</div>;
  }

  return (
    <div className="tree" role="tree" aria-label="工程文件">
      {entries.map((entry) => (
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
    </div>
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
  const isDir = entry.kind === 'directory';
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isDir || !expanded || children === null) return;

    let cancelled = false;
    setLoading(true);
    listDirectory(entry.handle as FileSystemDirectoryHandle)
      .then((list) => {
        if (!cancelled) setChildren(list);
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
      setChildren(await listDirectory(entry.handle as FileSystemDirectoryHandle));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '读取目录失败');
    } finally {
      setLoading(false);
    }
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
        tabIndex={0}
        draggable={!isDir}
        style={{ paddingLeft: 6 + depth * 14 }}
        onDragStart={(event) => {
          if (isDir) return;
          event.dataTransfer.setData('application/x-tkool-file', path);
          event.dataTransfer.effectAllowed = 'copy';
          onDragStartFile(path, entry);
        }}
        onMouseDown={(event) => {
          // 浏览器不会自动聚焦 tabindex 的 div，手动接管以便 :focus-within 生效
          event.currentTarget.focus();
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
        {isDir ? (
          expanded ? (
            <FolderOpenIcon size={16} className="treeIcon" />
          ) : (
            <FolderIcon size={16} className="treeIcon" />
          )
        ) : (
          <FileTypeIcon name={entry.name} size={16} />
        )}
        <span className="treeLabel" title={path}>
          {entry.name}
        </span>
      </div>

      {menuAt && (
        <ContextMenu
          x={menuAt.x}
          y={menuAt.y}
          onClose={() => {
            setMenuAt(null);
            onMenuClose();
          }}
          items={
            isDir
              ? [
                  {
                    id: 'toggle',
                    label: expanded ? '折叠' : '展开',
                    onSelect: () => void activate(),
                  },
                  {
                    id: 'copy',
                    label: '复制相对路径',
                    separatorBefore: true,
                    onSelect: () => copyPath(path),
                  },
                ]
              : [
                  { id: 'open', label: '打开', onSelect: () => onSelect(path, entry) },
                  {
                    id: 'copy',
                    label: '复制相对路径',
                    separatorBefore: true,
                    onSelect: () => copyPath(path),
                  },
                ]
          }
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
          {children?.length === 0 && (
            <div className="treeHint" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>空目录</div>
          )}
        </>
      )}
    </>
  );
}
