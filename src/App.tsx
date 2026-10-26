import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import EditorArea, { type EditorTab } from './components/EditorArea';
import EventManager from './components/EventManager';
import FileTree, { type TreeActions } from './components/FileTree';
import MenuBar from './components/MenuBar';
import ProjectMenu from './components/ProjectMenu';
import SidePanelSection from './components/SidePanelSection';
import type { ContextMenuItem } from './components/ContextMenu';
import type { TextEditorApi } from './components/TextEditor';
import { ExplorerIcon, NewFileIcon, NewFolderIcon, RefreshIcon } from './components/icons';
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
  copyEntry,
  deleteEntry,
  ensureReadPermission,
  ensureWritePermission,
  moveEntry,
  pickDirectory,
  renameEntry,
  splitPath,
  type DirEntry,
  type TreeClipboard,
} from './lib/fs';
import { DEFAULT_ENCODING, ENCODINGS, normalizeEncoding, readGameTitle, readProjectInfo, type Encoding } from './lib/project';
import {
  emptyCatalog,
  pageKey,
  type EventCatalog,
  type EventPage,
  type EventPageRef,
} from './lib/events';
import {
  buildCommandLines,
  COMMENT_LIMITS,
  MESSAGE_LIMITS,
  splitCommandText,
  type CommandLine,
  type TextBlockKind,
} from './lib/eventCommands';
import {
  invalidateEventCache,
  loadEventCatalog,
  loadEventPageCommands,
  saveCommandParameters,
  saveCommentBlock,
  saveMessageBlock,
  setPreferredEngine,
  type EventCatalogResult,
  type EventLoadProgress,
} from './lib/lcfEvents';
import { saveRecentProject, type RecentProject } from './lib/recent';
import { INDENT_COLORS, SYNTAX_COLORS } from './lib/codeTheme';
import { type CommandEnvironment } from './lib/commandSpec';
import type { Engine, Runtime } from './lib/environment';

const DEFAULT_PANEL_WIDTH = 248;
const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 520;

/** 把代码主题的语法配色暴露成 CSS 变量，事件视图与文本编辑器共用同一套颜色 */
const SYNTAX_STYLE = {
  '--syntax-function': SYNTAX_COLORS.function,
  '--syntax-string': SYNTAX_COLORS.string,
  '--syntax-comment': SYNTAX_COLORS.comment,
  '--syntax-punctuation': SYNTAX_COLORS.punctuation,
  '--syntax-number': SYNTAX_COLORS.number,
  '--syntax-boolean': SYNTAX_COLORS.boolean,
  '--syntax-template': SYNTAX_COLORS.templateString,
  '--syntax-keyword': SYNTAX_COLORS.keyword,
  '--syntax-operator': SYNTAX_COLORS.operator,
  '--syntax-self': SYNTAX_COLORS.self,
  /* 缩进参考线按层级循环取色 */
  '--indent-0': INDENT_COLORS[0],
  '--indent-1': INDENT_COLORS[1],
  '--indent-2': INDENT_COLORS[2],
  '--indent-3': INDENT_COLORS[3],
  '--indent-4': INDENT_COLORS[4],
  '--indent-5': INDENT_COLORS[5],
} as CSSProperties;

function isUserCancellation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

export default function App() {
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<Encoding>(DEFAULT_ENCODING);
  const [engine, setEngine] = useState<Engine>('2k');
  const [runtime, setRuntime] = useState<Runtime>('rpg_rt');
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
  const [eventsOpen, setEventsOpen] = useState(true);
  const [catalog, setCatalog] = useState<EventCatalog>(emptyCatalog);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsProgress, setEventsProgress] = useState<EventLoadProgress | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [activeEventPage, setActiveEventPage] = useState<EventPage | null>(null);
  const eventsLoadRef = useRef(0);
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);
  const [clipboard, setClipboard] = useState<TreeClipboard | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
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

  /** 读取事件导航树；旧任务通过 token 作废 */
  const loadEventsFor = useCallback(
    (
      handle: FileSystemDirectoryHandle,
      enc: Encoding,
      options: {
        silent?: boolean;
        /** 配置中记录的引擎；为空则自动探测 */
        engine?: Engine | null;
        /** 读取完成后回调实际采用的引擎与运行环境 */
        onResolved?: (result: EventCatalogResult) => void;
      } = {},
    ) => {
      const token = eventsLoadRef.current + 1;
      eventsLoadRef.current = token;
      const silent = options.silent === true;

      // 刷新时保留当前树，避免骨架替换造成折叠与闪烁
      if (!silent) setCatalog(emptyCatalog());
      setEventsError(null);
      setEventsProgress(null);
      setEventsLoading(true);

      return loadEventCatalog(handle, enc, {
        engine: options.engine ?? null,
        isCancelled: () => eventsLoadRef.current !== token,
        onUpdate: silent
          ? undefined
          : (next) => {
              if (eventsLoadRef.current === token) setCatalog(next);
            },
        onProgress: silent
          ? undefined
          : (progress) => {
              if (eventsLoadRef.current === token) setEventsProgress(progress);
            },
      })
        .then((result) => {
          if (eventsLoadRef.current !== token) return;
          setCatalog(result.catalog);
          options.onResolved?.(result);
        })
        .catch((err: unknown) => {
          if (eventsLoadRef.current === token) {
            console.error(err);
            setEventsError(err instanceof Error ? err.message : '读取事件失败');
          }
        })
        .finally(() => {
          if (eventsLoadRef.current === token) {
            setEventsLoading(false);
            setEventsProgress(null);
          }
        });
    },
    [],
  );

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

        // 配置里存了引擎就以配置为准；否则先按 2k 读，解析后回填并写回配置
        const configuredEngine = config?.engine ?? null;
        setPreferredEngine(configuredEngine);
        setEngine(configuredEngine ?? '2k');
        setRuntime(config?.runtime ?? 'rpg_rt');

        closeAllTabs();
        setProjectSeq((seq) => seq + 1);
        setRoot(handle);
        setEncoding(nextEncoding);
        setTitle(nextTitle);
        setSelected(null);
        setActiveEventPage(null);
        setClipboard(null);
        setRenamingPath(null);

        loadEventsFor(handle, nextEncoding, {
          engine: configuredEngine,
          onResolved: (result) => {
            // 探测结果同样作为后续读取的首选引擎
            setPreferredEngine(result.engine);
            setEngine(result.engine);
            const resolvedRuntime = config?.runtime ?? result.runtime;
            setRuntime(resolvedRuntime);
            // 配置里缺少引擎 / 运行环境时，把探测结果补进去
            if (!config?.engine || !config?.runtime) {
              void writeProjectConfig(handle, {
                encoding: nextEncoding,
                engine: result.engine,
                runtime: resolvedRuntime,
              }).then((written) => {
                if (!written) console.warn('未能写入 RPG_RT.json 的引擎配置。');
              });
            }
          },
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
    [closeAllTabs, loadEventsFor],
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
    eventsLoadRef.current += 1;
    closeAllTabs();
    setRoot(null);
    setTitle(null);
    setEncoding(DEFAULT_ENCODING);
    setEngine('2k');
    setRuntime('rpg_rt');
    setPreferredEngine(null);
    setSelected(null);
    setActiveEventPage(null);
    setCatalog(emptyCatalog());
    setEventsLoading(false);
    setEventsProgress(null);
    setEventsError(null);
    setClipboard(null);
    setRenamingPath(null);
    setError(null);
  }, [closeAllTabs]);

  const handleEncodingChange = useCallback(
    (next: Encoding) => {
      setEncoding(next);
      if (!root) return;

      loadEventsFor(root, next, {
        engine,
        onResolved: (result) => setEngine(result.engine),
      });

      void writeProjectConfig(root, { encoding: next, engine, runtime }).then((written) => {
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
    [root, loadEventsFor, engine, runtime],
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

  /** 读取事件页指令并更新对应标签；失败时把错误写进标签 */
  const loadEventTab = useCallback(
    (path: string, ref: EventPageRef): Promise<void> => {
      if (!root) return Promise.resolve();

      setTabs((prev) =>
        prev.map((item) =>
          item.path === path ? { ...item, eventLoading: true, eventError: null } : item,
        ),
      );

      return loadEventPageCommands(root, encoding, ref)
        .then((commands) => {
          setTabs((prev) =>
            prev.map((item) =>
              item.path === path
                ? { ...item, commands: buildCommandLines(commands), eventLoading: false }
                : item,
            ),
          );
        })
        .catch((err: unknown) => {
          console.error(err);
          setTabs((prev) =>
            prev.map((item) =>
              item.path === path
                ? {
                    ...item,
                    eventLoading: false,
                    eventError: err instanceof Error ? err.message : '读取事件页失败',
                  }
                : item,
            ),
          );
        });
    },
    [root, encoding],
  );

  /** 打开事件页标签：按需读取指令，事件名只作标签标题 */
  const openEventPage = useCallback(
    (page: EventPage, label: string) => {
      setActiveEventPage(page);
      if (!root) return;

      const path = `event:${pageKey(page.ref)}`;
      if (tabs.some((tab) => tab.path === path)) {
        setActiveTab(path);
        return;
      }

      const tab: EditorTab = {
        path,
        name: label,
        kind: 'event',
        size: 0,
        eventPage: page.ref,
        eventLoading: true,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTab(path);

      void loadEventTab(path, page.ref);
    },
    [root, tabs, loadEventTab],
  );

  /** 刷新事件树与已打开的事件页：丢弃解析缓存后重新从磁盘读取 */
  const refreshEvents = useCallback(() => {
    if (!root) return;

    invalidateEventCache();

    // 先等事件树读完，再逐个重读事件页；内置浏览器并发枚举目录会挂起
    void loadEventsFor(root, encoding, { silent: true, engine }).then(async () => {
      for (const tab of tabs) {
        if (tab.kind !== 'event' || !tab.eventPage) continue;
        await loadEventTab(tab.path, tab.eventPage);
      }
    });
  }, [root, encoding, engine, tabs, loadEventsFor, loadEventTab]);

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

  /** 写回注释块 / 消息块，并用返回的整页指令刷新标签 */
  const saveEventTextBlock = useCallback(
    async (tab: EditorTab, kind: TextBlockKind, lines: CommandLine[], text: string) => {
      if (!root || !tab.eventPage || lines.length === 0) return;

      try {
        if (!(await ensureWritePermission(root))) {
          setError('无法保存：没有获得写入权限。');
          return;
        }

        const update = {
          startIndex: lines[0].index,
          endIndex: lines[lines.length - 1].index,
          lines: splitCommandText(text, kind === 'comment' ? COMMENT_LIMITS : MESSAGE_LIMITS),
        };
        const commands =
          kind === 'comment'
            ? await saveCommentBlock(root, encoding, tab.eventPage, update)
            : await saveMessageBlock(root, encoding, tab.eventPage, update);

        setTabs((prev) =>
          prev.map((item) =>
            item.path === tab.path ? { ...item, commands: buildCommandLines(commands) } : item,
          ),
        );
      } catch (err: unknown) {
        console.error(err);
        const label = kind === 'comment' ? '注释' : '消息';
        setError(err instanceof Error ? `保存${label}失败：${err.message}` : `保存${label}失败。`);
      }
    },
    [root, encoding],
  );

  /** 写回单条指令的参数（如等待指令的模式与时长） */
  const saveEventParameters = useCallback(
    async (tab: EditorTab, line: CommandLine, parameters: number[]) => {
      if (!root || !tab.eventPage) return;

      try {
        if (!(await ensureWritePermission(root))) {
          setError('无法保存：没有获得写入权限。');
          return;
        }

        const commands = await saveCommandParameters(root, encoding, tab.eventPage, {
          index: line.index,
          parameters,
        });
        setTabs((prev) =>
          prev.map((item) =>
            item.path === tab.path ? { ...item, commands: buildCommandLines(commands) } : item,
          ),
        );
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? `保存参数失败：${err.message}` : '保存参数失败。');
      }
    },
    [root, encoding],
  );

  const activeTabData = tabs.find((tab) => tab.path === activeTab) ?? null;
  const activeTypeLabel = activeTabData
    ? activeTabData.kind === 'event'
      ? '事件页'
      : extensionOf(activeTabData.name).toUpperCase() || kindLabel(activeTabData.kind)
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

  /** 路径变更后同步已打开的标签页 */
  const remapTabs = useCallback((oldPath: string, nextPath: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.path === oldPath) return { ...tab, path: nextPath, name: splitPath(nextPath).name };
        if (tab.path.startsWith(`${oldPath}/`)) {
          const path = `${nextPath}${tab.path.slice(oldPath.length)}`;
          return { ...tab, path, name: splitPath(path).name };
        }
        return tab;
      }),
    );
    setActiveTab((current) => {
      if (!current) return current;
      if (current === oldPath) return nextPath;
      if (current.startsWith(`${oldPath}/`)) return `${nextPath}${current.slice(oldPath.length)}`;
      return current;
    });
  }, []);

  const closeTabsUnder = useCallback(
    (path: string) => {
      const isUnder = (value: string) => value === path || value.startsWith(`${path}/`);
      if (!tabs.some((tab) => isUnder(tab.path))) return;

      tabs
        .filter((tab) => isUnder(tab.path))
        .forEach((tab) => {
          if (tab.objectUrl) URL.revokeObjectURL(tab.objectUrl);
        });

      const next = tabs.filter((tab) => !isUnder(tab.path));
      setTabs(next);
      if (activeTab && isUnder(activeTab)) {
        setActiveTab(next[next.length - 1]?.path ?? null);
      }
    },
    [tabs, activeTab],
  );

  const copyTreeEntry = useCallback((path: string, entry: DirEntry) => {
    setClipboard({ mode: 'copy', path, name: entry.name, kind: entry.kind });
  }, []);

  const cutTreeEntry = useCallback((path: string, entry: DirEntry) => {
    setClipboard({ mode: 'cut', path, name: entry.name, kind: entry.kind });
  }, []);

  const pasteInto = useCallback(
    async (targetDir: string) => {
      if (!root || !clipboard) return;
      try {
        if (!(await ensureWritePermission(root))) {
          setError('无法粘贴：没有获得写入权限。');
          return;
        }
        const nextPath =
          clipboard.mode === 'copy'
            ? await copyEntry(root, clipboard.path, targetDir)
            : await moveEntry(root, clipboard.path, targetDir);

        if (clipboard.mode === 'cut' && nextPath !== clipboard.path) {
          remapTabs(clipboard.path, nextPath);
          setClipboard(null);
        }
        setSelected(nextPath);
        setTreeRefreshToken((token) => token + 1);
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setError('粘贴失败。');
      }
    },
    [root, clipboard, remapTabs],
  );

  const commitRename = useCallback(
    async (path: string, nextName: string) => {
      setRenamingPath(null);
      if (!root) return;
      try {
        if (!(await ensureWritePermission(root))) {
          setError('无法重命名：没有获得写入权限。');
          return;
        }
        const nextPath = await renameEntry(root, path, nextName);
        if (nextPath !== path) {
          remapTabs(path, nextPath);
          setSelected(nextPath);
          setTreeRefreshToken((token) => token + 1);
          setClipboard((current) =>
            current && (current.path === path || current.path.startsWith(`${path}/`))
              ? null
              : current,
          );
        }
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : '重命名失败。');
      }
    },
    [root, remapTabs],
  );

  const removeTreeEntry = useCallback(
    async (path: string, entry: DirEntry) => {
      if (!root) return;
      const label =
        entry.kind === 'directory' ? `文件夹「${entry.name}」及其全部内容` : `文件「${entry.name}」`;
      if (!window.confirm(`确定删除${label}吗？该操作不可撤销。`)) return;

      try {
        if (!(await ensureWritePermission(root))) {
          setError('无法删除：没有获得写入权限。');
          return;
        }
        await deleteEntry(root, path);
        closeTabsUnder(path);
        setSelected((current) =>
          current === path || current?.startsWith(`${path}/`) ? null : current,
        );
        setClipboard((current) =>
          current && (current.path === path || current.path.startsWith(`${path}/`))
            ? null
            : current,
        );
        setTreeRefreshToken((token) => token + 1);
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setError('删除失败。');
      }
    },
    [root, closeTabsUnder],
  );

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

  /**
   * 事件指令的校验环境：引擎与运行环境决定指令集归属，
   * 数据库对象集合用于检查 id 引用是否有效。
   */
  const commandEnvironment = useMemo<CommandEnvironment>(() => {
    const commonEvents = new Set(catalog.commonEvents.map((event) => event.id));
    const troops = new Set(catalog.troops.map((event) => event.id));
    const maps = new Set(catalog.maps.map((map) => map.id));

    return {
      engine,
      runtime,
      lookup: {
        commonEvent: (id) => commonEvents.has(id),
        troop: (id) => troops.has(id),
        map: (id) => maps.has(id),
      },
    };
  }, [catalog, engine, runtime]);

  const treeActions: TreeActions = {
    clipboard,
    renamingPath,
    onCopy: copyTreeEntry,
    onCut: cutTreeEntry,
    onPaste: (targetDir) => void pasteInto(targetDir),
    onStartRename: (path) => setRenamingPath(path),
    onCommitRename: (path, nextName) => void commitRename(path, nextName),
    onCancelRename: () => setRenamingPath(null),
    onDelete: (path, entry) => void removeTreeEntry(path, entry),
    onNewFile: () => void newTextFile(),
    onNewFolder: () => void newFolder(),
    onCloseProject: closeProject,
    onOpenProject: () => void openProject(),
  };

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
      style={SYNTAX_STYLE}
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

      <div className="appBody" data-menu-boundary="true">
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
            <SidePanelSection
              title="资源管理器"
              open={explorerOpen}
              onToggle={toggleExplorer}
              actions={
                <>
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
                </>
              }
            >
              <FileTree
                key={root ? projectSeq : 'empty'}
                root={root}
                selected={selected}
                busy={busy}
                refreshToken={treeRefreshToken}
                actions={treeActions}
                onSelect={handleSelect}
                onDragStartFile={handleDragStartFile}
              />
            </SidePanelSection>

            <SidePanelSection
              title="事件管理器"
              open={eventsOpen}
              onToggle={() => setEventsOpen((value) => !value)}
              divided
              actions={
                <button
                  type="button"
                  className="sidePanelAction"
                  aria-label="刷新事件"
                  title="刷新事件"
                  disabled={!root || eventsLoading}
                  onClick={refreshEvents}
                >
                  <RefreshIcon size={15} />
                </button>
              }
            >
              <EventManager
                catalog={catalog}
                hasProject={!!root}
                selected={activeEventPage ? pageKey(activeEventPage.ref) : null}
                onSelectPage={openEventPage}
                loading={eventsLoading}
                progress={eventsProgress}
                error={eventsError}
              />
            </SidePanelSection>
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
          onSaveTextBlock={saveEventTextBlock}
          onSaveParameters={saveEventParameters}
          commandEnvironment={commandEnvironment}
        />
      </div>

      <footer className="statusBar">
        <div className="statusItem">
          <span className="statusDot" data-on={root ? 'true' : 'false'} />
          {root ? `已打开 ${title ?? root.name}` : '未打开工程'}
        </div>
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
