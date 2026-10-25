import { useEffect, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { canPickDirectory } from '../lib/fs';
import { ENCODINGS, type Encoding } from '../lib/project';
import { listRecentProjects, removeRecentProject, type RecentProject } from '../lib/recent';
import { ChevronIcon, FolderIcon } from './icons';

interface Props {
  root: FileSystemDirectoryHandle | null;
  title: string | null;
  encoding: Encoding;
  busy: boolean;
  onOpen: () => void;
  onOpenRecent: (project: RecentProject) => void;
  onClose: () => void;
  onEncodingChange: (encoding: Encoding) => void;
}

export default function ProjectMenu({
  root,
  title,
  encoding,
  busy,
  onOpen,
  onOpenRecent,
  onClose,
  onEncodingChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentProject[] | null>(null);
  const menuRef = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const supported = canPickDirectory();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void listRecentProjects()
      .then((rows) => {
        if (!cancelled) setRecent(rows);
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function handleOpen() {
    setOpen(false);
    onOpen();
  }

  function handleClose() {
    setOpen(false);
    onClose();
  }

  function handleRemoveRecent(project: RecentProject) {
    setRecent((rows) => rows?.filter((row) => row.id !== project.id) ?? rows);
    void removeRecentProject(project.id).catch(() => undefined);
  }

  return (
    <div className="projectMenu" ref={menuRef}>
      <button
        type="button"
        className="projectTrigger"
        data-open={root ? 'true' : 'false'}
        data-empty={root ? undefined : 'true'}
        title={root ? root.name : '打开项目'}
        aria-label={root ? `项目：${root.name}` : '打开项目'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="projectTriggerIconWrap">
          <FolderIcon size={16} className="projectTriggerIcon" />
          {!root && (
            <span className="projectTriggerPlus" aria-hidden="true">
              +
            </span>
          )}
        </span>
        {root && (
          <>
            <span className="projectTriggerText">{root.name}</span>
            <ChevronIcon size={12} className="projectTriggerChevron" />
          </>
        )}
      </button>

      {open && (
        <div className="popupMenu projectPopup" role="menu">
          {root && (
            <section className="menuSection">
              <div className="projectHeader">
                <div className="projectTitle">{title ?? root.name}</div>
                <div className="projectPath" title={root.name}>
                  {root.name}
                </div>
              </div>
              <label className="projectConfigRow">
                <span className="statLabel">编码</span>
                <select
                  className="encodingSelect"
                  value={encoding}
                  onChange={(event) => onEncodingChange(event.target.value as Encoding)}
                >
                  {ENCODINGS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          <section className="menuSection menuSectionActions">
            {root ? (
              <>
                <button type="button" className="menuRow" onClick={handleOpen} disabled={busy}>
                  切换目录…
                </button>
                <button type="button" className="menuRow menuRowDanger" onClick={handleClose}>
                  关闭工程
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="menuRow"
                  onClick={handleOpen}
                  disabled={busy || !supported}
                >
                  {busy ? '正在打开…' : '选择目录…'}
                </button>
                {!supported && <div className="popupHint">当前浏览器不支持读取本地目录</div>}
                {recent && recent.length > 0 && (
                  <>
                    <div className="menuDivider" />
                    <div className="menuSectionLabel">最近打开</div>
                    {recent.map((project) => (
                      <div className="recentRow" key={project.id}>
                        <button
                          type="button"
                          className="recentItem"
                          onClick={() => {
                            setOpen(false);
                            onOpenRecent(project);
                          }}
                        >
                          <span className="recentName">{project.title ?? project.name}</span>
                          {project.title && project.title !== project.name && (
                            <span className="recentMeta">{project.name}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className="recentRemove"
                          title="从最近列表移除"
                          aria-label={`从最近列表移除 ${project.name}`}
                          onClick={() => handleRemoveRecent(project)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
