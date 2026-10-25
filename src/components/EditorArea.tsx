import { lazy, Suspense, useState, type DragEvent, type MutableRefObject } from 'react';
import { formatBytes, kindLabel, type FileKind } from '../lib/file';
import type { CommandLine } from '../lib/eventCommands';
import type { EventPageRef } from '../lib/events';
import type { Encoding } from '../lib/project';
import EventPageView from './EventPageView';
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
  editable?: boolean;
  encoding?: Encoding;
  eol?: 'CRLF' | 'LF';
  objectUrl?: string;
  dirty?: boolean;
  /** 事件页标签专用 */
  eventPage?: EventPageRef;
  commands?: CommandLine[];
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
  onSaveComment?: (tab: EditorTab, lines: CommandLine[], text: string) => void;
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
  onSaveComment,
}: Props) {
  const active = tabs.find((tab) => tab.path === activeId) ?? null;
  const [dropActive, setDropActive] = useState(false);

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
              {tab.dirty && <span className="tabDirtyDot" aria-label="未保存" />}
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
                ×
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
            commands={active.commands ?? []}
            loading={active.eventLoading ?? false}
            error={active.eventError ?? null}
            onSaveComment={(lines, text) => onSaveComment?.(active, lines, text)}
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
