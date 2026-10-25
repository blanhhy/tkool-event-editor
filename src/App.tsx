import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import EditorArea, { type EditorTab } from './components/EditorArea';
import FileTree from './components/FileTree';
import MenuBar from './components/MenuBar';
import ProjectMenu from './components/ProjectMenu';
import type { ContextMenuItem } from './components/ContextMenu';
import type { TextEditorApi } from './components/TextEditor';
import { ChevronIcon, ExplorerIcon, NewFileIcon, NewFolderIcon, RefreshIcon } from './components/icons';
import {
  readProjectConfig,
  writeProjectConfig,
} from './lib/config';
import {
  decodeText,
  decodeTextAs,
  extensionOf,
  fileKind,
  kindLabel,
  resolveFile,
  resolveFileHandle,
} from './lib/file';
import {
  canPickDirectory,
  countProject,
  ensureReadPermission,
  ensureWritePermission,
  pickDirectory,
  type DirEntry,
  type ProjectStats,
} from './lib/fs';
import { DEFAULT_ENCODING, ENCODINGS, normalizeEncoding, readGameTitle, readProjectInfo, type Encoding } from './lib/project';
import { saveRecentProject, type RecentProject } from './lib/recent';

const DEFAULT_PANEL_WIDTH = 248;
const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 520;

function isUserCancellation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

export default function App() {
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<Encoding>(DEFAULT_ENCODING);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [resizingPanel, setResizingPanel] = useState(false);
  const resizeSessionRef = useRef<{
    /** 侧栏收起时的边缘位置，开合阈值都以它为基准 */
    closedEdgeX: number;
  } | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);
  const [projectSeq, setProjectSeq] = useState(0);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ line: number; column: number } | null>(null);
  const activationRef = useRef(0);
  const dragSourceRef = useRef<{ path: string; entry: DirEntry } | null>(null);
  const editorApiRef = useRef<TextEditorApi | null>(null);

  const closeAllTabs = useCallback(() => {
    tabs.forEach((tab) => {
      if (tab.objectUrl) URL.revokeObjectURL(tab.objectUrl);
    });
    setTabs([]);
    setActiveTab(null);
  }, [tabs]);

  const activateProject = useCallback(
    async (handle: FileSystemDirectoryHandle, preferred?: Encoding) => {
      const token = activationRef.current + 1;
      activationRef.current = token;
      setBusy(true);
      setError(null);

      try {
        const granted = await ensureReadPermission(handle);
        if (!granted) return;

        const config = await readProjectConfig(handle);
        const info = await readProjectInfo(handle);
        const nextEncoding = normalizeEncoding(preferred) ?? config?.encoding ?? info.encoding;
        const nextTitle = (await readGameTitle(handle, nextEncoding)) ?? info.title;

        closeAllTabs();
        setProjectSeq((seq) => seq + 1);
        setRoot(handle);
        setEncoding(nextEncoding);
        setTitle(nextTitle);
        setSelected(null);
        setStats(null);

        void countProject(handle).then((nextStats) => {
          if (activationRef.current === token) setStats(nextStats);
        });

        await saveRecentProject({
          id: handle.name,
          name: handle.name,
          title: nextTitle,
          encoding: nextEncoding,
          openedAt: Date.now(),
          handle,
        }).catch((err: unknown) => {
          console.warn('保存最近工程失败', err);
        });
      } catch (err: unknown) {
        if (activationRef.current === token) {
          console.error(err);
          setError('无法打开工程。');
        }
      } finally {
        if (activationRef.current === token) setBusy(false);
      }
    },
    [closeAllTabs],
  );

  const openProject = useCallback(async () => {
    setError(null);
    if (!canPickDirectory()) {
      setError('当前浏览器不支持读取本地目录，请使用桌面版 Chrome 或 Edge。');
      return;
    }

    try {
      const handle = await pickDirectory();
      if (!handle) return;
      await activateProject(handle);
    } catch (err: unknown) {
      if (!isUserCancellation(err)) {
        setError(err instanceof Error ? err.message : '打开目录失败');
      }
    }
  }, [activateProject]);

  const openRecent = useCallback(
    (project: RecentProject) => {
      void activateProject(project.handle, project.encoding);
    },
    [activateProject],
  );

  const closeProject = useCallback(() => {
    activationRef.current += 1;
    closeAllTabs();
    setRoot(null);
    setTitle(null);
    setEncoding(DEFAULT_ENCODING);
    setStats(null);
    setSelected(null);
    setError(null);
  }, [closeAllTabs]);

  const handleEncodingChange = useCallback(
    (next: Encoding) => {
      setEncoding(next);
      if (!root) return;

      void writeProjectConfig(root, next).then((written) => {
        if (!written) console.warn('未能写入 RPG_RT.json，编码设置仅在本次会话生效。');
      });

      void readGameTitle(root, next).then((nextTitle) => {
        setTitle(nextTitle);
        void saveRecentProject({
          id: root.name,
          name: root.name,
          title: nextTitle,
          encoding: next,
          openedAt: Date.now(),
          handle: root,
        }).catch((err: unknown) => {
          console.warn('保存最近工程失败', err);
        });
      });
    },
    [root],
  );

  const openFile = useCallback(
    async (path: string) => {
      if (!root) return;
      if (tabs.some((tab) => tab.path === path)) {
        setActiveTab(path);
        return;
      }

      try {
        const file = await resolveFile(root, path);
        const kind = fileKind(file.name);
        const tab: EditorTab = { path, name: file.name, kind, size: file.size };

        if (kind === 'text') {
          const decoded = decodeText(await file.arrayBuffer(), encoding);
          tab.text = decoded.text;
          tab.editable = decoded.editable;
          tab.encoding = decoded.encoding;
          tab.eol = decoded.text.includes('\r\n') ? 'CRLF' : 'LF';
        } else if (kind === 'image' || kind === 'audio') {
          tab.objectUrl = URL.createObjectURL(file);
        }

        setTabs((prev) => [...prev, tab]);
        setActiveTab(path);
      } catch (err: unknown) {
        console.error(err);
        setError('无法读取该文件。');
      }
    },
    [root, tabs, encoding],
  );

  const handleSelect = useCallback(
    (path: string, entry: DirEntry) => {
      setSelected(path);
      if (entry.kind === 'file') void openFile(path);
    },
    [openFile],
  );

  const handleDragStartFile = useCallback((path: string, entry: DirEntry) => {
    dragSourceRef.current = { path, entry };
  }, []);

  const handleDropFile = useCallback(
    (path: string) => {
      const source = dragSourceRef.current;
      dragSourceRef.current = null;
      if (source && source.path === path) handleSelect(source.path, source.entry);
    },
    [handleSelect],
  );

  const closeTab = useCallback(
    (path: string) => {
      const index = tabs.findIndex((tab) => tab.path === path);
      if (index === -1) return;

      const target = tabs[index];
      if (target.objectUrl) URL.revokeObjectURL(target.objectUrl);

      const next = tabs.filter((tab) => tab.path !== path);
      setTabs(next);
      if (activeTab === path) {
        setActiveTab(next[Math.min(index, next.length - 1)]?.path ?? null);
      }
    },
    [tabs, activeTab],
  );

  const handleTabChange = useCallback((path: string, text: string) => {
    setTabs((prev) => prev.map((tab) => (tab.path === path ? { ...tab, text, dirty: true } : tab)));
  }, []);

  const saveTab = useCallback(
    async (path: string) => {
      const tab = tabs.find((item) => item.path === path);
      if (!tab || tab.kind !== 'text' || !tab.editable || !root) return;

      try {
        if (!(await ensureWritePermission(root))) {
          setError('无法保存：没有获得写入权限。');
          return;
        }
        const handle = await resolveFileHandle(root, path);
        const writable = await handle.createWritable();
        await writable.write(new TextEncoder().encode(tab.text ?? ''));
        await writable.close();
        setTabs((prev) => prev.map((item) => (item.path === path ? { ...item, dirty: false } : item)));
      } catch (err: unknown) {
        console.error(err);
        setError('保存文件失败。');
      }
    },
    [tabs, root],
  );

  const activeTabData = tabs.find((tab) => tab.path === activeTab) ?? null;
  const activeTypeLabel = activeTabData
    ? extensionOf(activeTabData.name).toUpperCase() || kindLabel(activeTabData.kind)
    : '';

  const changeTabEncoding = useCallback(
    async (next: Encoding) => {
      if (!root || !activeTabData || activeTabData.kind !== 'text') return;
      if (activeTabData.dirty) {
        setError('请先保存文件再切换编码。');
        return;
      }

      try {
        const file = await resolveFile(root, activeTabData.path);
        const decoded = decodeTextAs(await file.arrayBuffer(), next);
        setTabs((prev) =>
          prev.map((tab) =>
            tab.path === activeTabData.path
              ? {
                  ...tab,
                  text: decoded.text,
                  encoding: decoded.encoding,
                  editable: decoded.editable,
                  eol: decoded.text.includes('\r\n') ? ('CRLF' as const) : ('LF' as const),
                }
              : tab,
          ),
        );
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setError('无法重新读取该文件。');
      }
    },
    [root, activeTabData],
  );

  const newTextFile = useCallback(async () => {
    if (!root) return;
    try {
      if (!(await ensureWritePermission(root))) {
        setError('无法新建文件：没有获得写入权限。');
        return;
      }

      const exists = async (name: string) => {
        try {
          await root.getFileHandle(name);
          return true;
        } catch {
          return false;
        }
      };

      let name = 'Untitled.txt';
      let index = 2;
      while (await exists(name)) name = `Untitled ${index++}.txt`;

      const handle = await root.getFileHandle(name, { create: true });
      await (await handle.createWritable()).close();
      setTreeRefreshToken((token) => token + 1);
      await openFile(name);
    } catch (err: unknown) {
      console.error(err);
      setError('新建文件失败。');
    }
  }, [root, openFile]);

  const newFolder = useCallback(async () => {
    if (!root) return;
    try {
      if (!(await ensureWritePermission(root))) {
        setError('无法新建文件夹：没有获得写入权限。');
        return;
      }

      const exists = async (name: string) => {
        try {
          await root.getDirectoryHandle(name);
          return true;
        } catch {
          return false;
        }
      };

      let name = '新建文件夹';
      let index = 2;
      while (await exists(name)) name = `新建文件夹 ${index++}`;

      await root.getDirectoryHandle(name, { create: true });
      setTreeRefreshToken((token) => token + 1);
    } catch (err: unknown) {
      console.error(err);
      setError('新建文件夹失败。');
    }
  }, [root]);

  const refreshTree = useCallback(() => {
    setTreeRefreshToken((token) => token + 1);
  }, []);

  const saveAs = useCallback(async () => {
    if (!activeTabData || activeTabData.kind !== 'text') return;

    const picker = (
      window as Window & {
        showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<FileSystemFileHandle>;
      }
    ).showSaveFilePicker;

    if (!picker) {
      setError('当前浏览器不支持另存为，请使用桌面版 Chrome 或 Edge。');
      return;
    }

    try {
      const handle = await picker.call(window, { suggestedName: activeTabData.name });
      const writable = await handle.createWritable();
      await writable.write(new TextEncoder().encode(activeTabData.text ?? ''));
      await writable.close();
    } catch (err: unknown) {
      if (!isUserCancellation(err)) {
        console.error(err);
        setError('另存为失败。');
      }
    }
  }, [activeTabData]);

  const saveAll = useCallback(async () => {
    for (const tab of tabs) {
      if (tab.kind === 'text' && tab.editable && tab.dirty) await saveTab(tab.path);
    }
  }, [tabs, saveTab]);

  const toggleExplorer = useCallback(() => {
    const next = !explorerOpen;
    setExplorerOpen(next);
    if (next) setTreeRefreshToken((token) => token + 1);
  }, [explorerOpen]);

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    // 编辑区内保留原生菜单，便于复制粘贴
    if (target?.closest('.cm-editor')) return;
    event.preventDefault();
  }, []);

  const handlePanelResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const originWidth = sidePanelOpen ? panelWidth : 0;
    resizeSessionRef.current = { closedEdgeX: event.clientX - originWidth };
    setResizingPanel(true);
  };

  useEffect(() => {
    if (!resizingPanel) return;

    const handleMove = (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;

      // 指针相对“收起边缘”的偏移量决定状态：
      // 不足半个最小宽度 → 收起；超过 → 以最小宽度打开，再随指针继续变宽
      const offset = event.clientX - session.closedEdgeX;
      if (offset < MIN_PANEL_WIDTH / 2) {
        setSidePanelOpen(false);
        return;
      }

      const limit = Math.max(MAX_PANEL_WIDTH, Math.round(window.innerWidth / 2));
      setPanelWidth(Math.min(limit, Math.max(MIN_PANEL_WIDTH, offset)));
      setSidePanelOpen(true);
    };

    const stop = () => {
      resizeSessionRef.current = null;
      setResizingPanel(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = '';
    };
  }, [resizingPanel]);

  const canEditActive = activeTabData?.kind === 'text' && !!activeTabData.editable;
  const hasDirtyText = tabs.some((tab) => tab.kind === 'text' && tab.editable && tab.dirty);

  const fileItems: ContextMenuItem[] = [
    {
      id: 'new-text',
      label: '新建文本文件',
      disabled: !root,
      onSelect: () => void newTextFile(),
    },
    { id: 'new-event', label: '新建事件页', disabled: true, onSelect: () => undefined },
    {
      id: 'open',
      label: '打开文件夹',
      separatorBefore: true,
      disabled: busy || !canPickDirectory(),
      onSelect: () => void openProject(),
    },
    {
      id: 'close',
      label: '关闭文件夹',
      disabled: !root,
      onSelect: () => closeProject(),
    },
    {
      id: 'save',
      label: '保存',
      shortcut: 'Ctrl+S',
      separatorBefore: true,
      disabled: !canEditActive,
      onSelect: () => {
        if (activeTabData) void saveTab(activeTabData.path);
      },
    },
    {
      id: 'save-as',
      label: '另存为',
      disabled: activeTabData?.kind !== 'text',
      onSelect: () => void saveAs(),
    },
    {
      id: 'save-all',
      label: '全部保存',
      disabled: !hasDirtyText,
      onSelect: () => void saveAll(),
    },
  ];

  const editItems: ContextMenuItem[] = [
    {
      id: 'undo',
      label: '撤销',
      shortcut: 'Ctrl+Z',
      disabled: !canEditActive,
      onSelect: () => editorApiRef.current?.undo(),
    },
    {
      id: 'redo',
      label: '重做',
      shortcut: 'Ctrl+Y',
      disabled: !canEditActive,
      onSelect: () => editorApiRef.current?.redo(),
    },
    {
      id: 'cut',
      label: '剪切',
      shortcut: 'Ctrl+X',
      separatorBefore: true,
      disabled: !canEditActive,
      onSelect: () => editorApiRef.current?.cut(),
    },
    {
      id: 'copy',
      label: '复制',
      shortcut: 'Ctrl+C',
      disabled: activeTabData?.kind !== 'text',
      onSelect: () => editorApiRef.current?.copy(),
    },
    {
      id: 'paste',
      label: '粘贴',
      shortcut: 'Ctrl+V',
      disabled: !canEditActive,
      onSelect: () => editorApiRef.current?.paste(),
    },
  ];

  return (
    <div
      className="appRoot"
      data-resizing={resizingPanel ? 'true' : undefined}
      onContextMenu={handleContextMenu}
    >
      <header className="titleBar">
        <div className="appLogoSlot" title="Tkool Event Editor" aria-label="应用图标占位" />
        <MenuBar fileItems={fileItems} editItems={editItems} />
        <div className="titleDivider" />
        <ProjectMenu
          root={root}
          title={title}
          encoding={encoding}
          busy={busy}
          onOpen={() => void openProject()}
          onOpenRecent={openRecent}
          onClose={closeProject}
          onEncodingChange={handleEncodingChange}
        />
        <div className="titleSpacer" />
      </header>

      <div className="appBody">
        <nav className="activityBar" aria-label="侧边应用栏">
          <button
            type="button"
            className="activityItem"
            data-active={sidePanelOpen ? 'true' : 'false'}
            title={sidePanelOpen ? '收起文件树' : '文件树'}
            aria-label={sidePanelOpen ? '收起文件树' : '文件树'}
            aria-pressed={sidePanelOpen}
            onClick={() => setSidePanelOpen((value) => !value)}
          >
            <ExplorerIcon size={20} />
          </button>
        </nav>

        <aside
          className="sidePanel"
          data-collapsed={sidePanelOpen ? undefined : 'true'}
          aria-hidden={!sidePanelOpen}
          style={{ '--side-panel-w': `${panelWidth}px` } as CSSProperties}
        >
          <div className="sidePanelInner">
            <div className="sidePanelHeader">
              <button
                type="button"
                className="sidePanelTitle"
                aria-expanded={explorerOpen}
                title={explorerOpen ? '折叠资源管理器' : '展开资源管理器'}
                onClick={toggleExplorer}
              >
                <span className="chevron" data-expanded={explorerOpen ? 'true' : 'false'}>
                  <ChevronIcon size={12} />
                </span>
                <span className="sidePanelTitleText">资源管理器</span>
              </button>
              <div className="sidePanelActions">
                <button
                  type="button"
                  className="sidePanelAction"
                  aria-label="新建文件"
                  title="新建文件"
                  disabled={!root}
                  onClick={() => void newTextFile()}
                >
                  <NewFileIcon size={15} />
                </button>
                <button
                  type="button"
                  className="sidePanelAction"
                  aria-label="新建文件夹"
                  title="新建文件夹"
                  disabled={!root}
                  onClick={() => void newFolder()}
                >
                  <NewFolderIcon size={15} />
                </button>
                <button
                  type="button"
                  className="sidePanelAction"
                  aria-label="刷新"
                  title="刷新"
                  disabled={!root}
                  onClick={refreshTree}
                >
                  <RefreshIcon size={15} />
                </button>
              </div>
            </div>
            <div className="sidePanelBody" data-collapsed={explorerOpen ? undefined : 'true'}>
              <FileTree
                key={root ? projectSeq : 'empty'}
                root={root}
                selected={selected}
                busy={busy}
                refreshToken={treeRefreshToken}
                onSelect={handleSelect}
                onDragStartFile={handleDragStartFile}
                onOpenProject={() => void openProject()}
              />
            </div>
          </div>
        </aside>

        <div
          className="sidePanelResize"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整侧栏宽度"
          aria-valuemin={MIN_PANEL_WIDTH}
          aria-valuemax={Math.max(MAX_PANEL_WIDTH, Math.round(window.innerWidth / 2))}
          aria-valuenow={sidePanelOpen ? panelWidth : 0}
          style={{ left: `calc(var(--activity-bar-w) + ${sidePanelOpen ? panelWidth : 0}px)` }}
          onPointerDown={handlePanelResizeStart}
          onDoubleClick={() => {
            setPanelWidth(DEFAULT_PANEL_WIDTH);
            setSidePanelOpen(true);
          }}
        />

        <EditorArea
          tabs={tabs}
          activeId={activeTab}
          onActivate={setActiveTab}
          onClose={closeTab}
          onChange={handleTabChange}
          onSave={(path) => void saveTab(path)}
          onDropFile={handleDropFile}
          onCursorChange={(line, column) => setCursor({ line, column })}
          editorApiRef={editorApiRef}
        />
      </div>

      <footer className="statusBar">
        <div className="statusItem">
          <span className="statusDot" data-on={root ? 'true' : 'false'} />
          {root ? `已打开 ${title ?? root.name}` : '未打开工程'}
        </div>
        {root && (
          <div className="statusItem">
            {stats
              ? `${stats.files.toLocaleString('zh-CN')} 个文件 · ${stats.dirs.toLocaleString('zh-CN')} 个文件夹`
              : '正在统计…'}
          </div>
        )}
        {activeTabData?.kind === 'text' && !activeTabData.editable && (
          <div className="statusItem">只读</div>
        )}
        <div className="statusSpacer" />
        {error && (
          <div className="statusItem statusError" title={error}>
            {error}
          </div>
        )}
        {activeTabData?.kind === 'text' && (
          <div className="statusItem">{`行 ${cursor?.line ?? 1}，列 ${cursor?.column ?? 1}`}</div>
        )}
        {activeTabData?.kind === 'text' && activeTabData.eol && (
          <div className="statusItem">{activeTabData.eol}</div>
        )}
        {activeTabData?.kind === 'text' && (
          <div className="statusItem">
            <select
              className="statusSelect"
              aria-label="文件编码"
              title="当前文件编码"
              value={activeTabData.encoding ?? encoding}
              onChange={(event) => void changeTabEncoding(event.target.value as Encoding)}
            >
              {ENCODINGS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {activeTabData && <div className="statusItem">{activeTypeLabel}</div>}
      </footer>
    </div>
  );
}
