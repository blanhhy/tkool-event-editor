import { lazy, Suspense, useMemo, useState, type DragEvent, type MutableRefObject } from 'react';
import type { EventCommand } from 'rpgrt';
import { formatBytes, kindLabel, type FileKind } from '../lib/file';
import { buildCommandLines, isSameCommands, type CommandLine, type TextBlockKind } from '../lib/eventCommands';
import type { CommandEnvironment } from '../lib/commandSpec';
import type { EventPageRef } from '../lib/events';
import type { Encoding } from '../lib/project';
import EventPageView, { type EventPageApi } from './EventPageView';
import FileTypeIcon from './FileTypeIcon';
import { FileIcon } from './icons';
import type { TextEditorApi } from './TextEditor';

const TextEditor = lazy(() => import('./TextEditor'));

export type EditorTabKind = FileKind | 'event';

export interface EditorTab {
  path: string;
  name: string;
  kind: EditorTabKind;
  size: number;
  text?: string;
  /** 上次读取 / 保存时的文本快照，用于判断是否有未保存的修改 */
  savedText?: string;
  editable?: boolean;
  encoding?: Encoding;
  eol?: 'CRLF' | 'LF';
  objectUrl?: string;
  dirty?: boolean;
  /** 事件页标签专用 */
  eventPage?: EventPageRef;
  /** 事件页的原始指令（内存态，保存时才写回 LDB） */
  commands?: EventCommand[];
  /** 上次读取 / 保存时的指令快照，用于判断是否有未保存的修改 */
  savedCommands?: EventCommand[];
  /** 事件编辑历史（撤销 / 重做） */
  undo?: EventCommand[][];
  redo?: EventCommand[][];
  eventLoading?: boolean;
  eventError?: string | null;
}

interface Props {
  tabs: EditorTab[];
  activeId: string | null;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, text: string) => void;
  onSave: (path: string) => void;
  onDropFile: (path: string) => void;
  onCursorChange: (line: number, column: number) => void;
  editorApiRef: MutableRefObject<TextEditorApi | null>;
  onSaveTextBlock?: (
    tab: EditorTab,
    kind: TextBlockKind,
    lines: CommandLine[],
    text: string,
  ) => void;
  onSaveParameters?: (tab: EditorTab, line: CommandLine, parameters: number[]) => void;
  /** 事件页指令区间写回（剪切 / 粘贴） */
  onReplaceCommands?: (
    tab: EditorTab,
    startIndex: number,
    deleteCount: number,
    lines: EventCommand[],
  ) => void;
  /** 事件页删除指定下标的指令 */
  onDeleteCommands?: (tab: EditorTab, indices: number[]) => void;
  /** 文本选区对齐到完整簇时复制的指令 JSON（同步给粘贴用的剪贴板） */
  onCopyCommands?: (json: string) => void;
  /** 事件页指令操作接口（复制 / 剪切 / 粘贴） */
  eventApiRef?: MutableRefObject<EventPageApi | null>;
  /** 事件页选择区变化 */
  onEventSelectionChange?: (hasSelection: boolean) => void;
  /** 事件指令的校验环境（引擎 / 运行环境 / 数据库引用） */
  commandEnvironment?: CommandEnvironment;
  /** 工程目录：事件指令参数面板的渲染预览需要读取工程素材 */
  projectRoot?: FileSystemDirectoryHandle | null;
}

const DRAG_TYPE = 'application/x-tkool-file';

export default function EditorArea({
  tabs,
  activeId,
  onActivate,
  onClose,
  onChange,
  onSave,
  onDropFile,
  onCursorChange,
  editorApiRef,
  onSaveTextBlock,
  onSaveParameters,
  onReplaceCommands,
  onDeleteCommands,
  onCopyCommands,
  eventApiRef,
  onEventSelectionChange,
  commandEnvironment,
  projectRoot,
}: Props) {
  const active = tabs.find((tab) => tab.path === activeId) ?? null;
  const [dropActive, setDropActive] = useState(false);

  /** 事件页的原始指令 → 可渲染行（编辑只改内存，保存时才写回） */
  const commandLines = useMemo(
    () => buildCommandLines(active?.commands ?? []),
    [active?.commands],
  );

  // 事件页的校验环境带上所在分类：战斗指令只能出现在敌群事件里
  const eventEnvironment = useMemo(() => {
    if (!commandEnvironment) return undefined;
    return { ...commandEnvironment, scope: active?.eventPage?.category };
  }, [commandEnvironment, active?.eventPage?.category]);

  const hasFileDrag = (event: DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE);

  return (
    <main
      className="editorArea"
      data-drop={dropActive ? 'true' : undefined}
      onDragOverCapture={(event) => {
        if (!hasFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropActive(false);
      }}
      onDropCapture={(event) => {
        if (!hasFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setDropActive(false);
        const path = event.dataTransfer.getData(DRAG_TYPE);
        if (path) onDropFile(path);
      }}
    >
      {tabs.length > 0 && (
        <div className="tabBar" role="tablist" aria-label="已打开的文件">
          {tabs.map((tab) => (
            <div
              key={tab.path}
              className="tab"
              data-active={tab.path === activeId ? 'true' : undefined}
              role="tab"
              aria-selected={tab.path === activeId}
              tabIndex={0}
              title={tab.path}
              onClick={() => onActivate(tab.path)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(tab.path);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onActivate(tab.path);
                }
              }}
            >
              {tab.kind === 'event' ? (
                <FileTypeIcon icon="code" size={14} />
              ) : (
                <FileTypeIcon name={tab.name} size={14} />
              )}
              <span className="tabLabel">{tab.name}</span>
              <button
                type="button"
                className="tabClose"
                aria-label={`关闭 ${tab.name}`}
                title="关闭"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.path);
                }}
              >
                {/* 有未保存的修改时，叉号变成圆圈（事件页与文件一致） */}
                {(tab.kind === 'event'
                  ? !isSameCommands(tab.commands, tab.savedCommands)
                  : !!tab.dirty) ? (
                  <span className="tabDirtyCircle" aria-label="未保存" />
                ) : (
                  '×'
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="editorBody">
        {!active && (
          <div className="editorEmpty">
            <FileIcon size={52} className="editorEmptyIcon" />
          </div>
        )}

        {active?.kind === 'text' && (
          <Suspense fallback={<div className="editorLoading" />}>
            <TextEditor
              key={`${active.path}:${active.encoding ?? ''}`}
              value={active.text ?? ''}
              name={active.name}
              readOnly={!active.editable}
              onChange={(value) => onChange(active.path, value)}
              onSave={() => onSave(active.path)}
              onCursorChange={onCursorChange}
              apiRef={editorApiRef}
            />
          </Suspense>
        )}

        {active?.kind === 'event' && (
          <EventPageView
            title={active.name}
            commands={commandLines}
            loading={active.eventLoading ?? false}
            error={active.eventError ?? null}
            onSaveBlock={(kind, lines, text) => onSaveTextBlock?.(active, kind, lines, text)}
            onSaveParameters={(line, parameters) =>
              onSaveParameters?.(active, line, parameters)
            }
            onReplaceCommands={(startIndex, deleteCount, lines) =>
              onReplaceCommands?.(active, startIndex, deleteCount, lines)
            }
            onDeleteCommands={(indices) => onDeleteCommands?.(active, indices)}
            onCopyCommands={onCopyCommands}
            apiRef={eventApiRef}
            onSelectionChange={onEventSelectionChange}
            environment={eventEnvironment}
            projectRoot={projectRoot}
          />
        )}

        {active?.kind === 'image' && (
          <div className="imagePreview">
            <img src={active.objectUrl} alt={active.name} />
          </div>
        )}

        {active?.kind === 'audio' && (
          <div className="fileInfo">
            <FileTypeIcon name={active.name} size={44} />
            <div className="fileInfoName">{active.name}</div>
            <div className="fileInfoMeta">
              {kindLabel(active.kind)} · {formatBytes(active.size)}
            </div>
            <audio controls preload="metadata" src={active.objectUrl} className="audioPlayer" />
          </div>
        )}

        {(active?.kind === 'lcf' || active?.kind === 'other') && (
          <div className="fileInfo">
            <FileTypeIcon name={active.name} size={44} />
            <div className="fileInfoName">{active.name}</div>
            <div className="fileInfoMeta">
              {kindLabel(active.kind)} · {formatBytes(active.size)}
            </div>
            <div className="fileInfoHint">暂不支持预览此类型</div>
          </div>
        )}
      </div>
    </main>
  );
}
