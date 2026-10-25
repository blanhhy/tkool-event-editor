import { useEffect, useRef, type MutableRefObject } from 'react';
import { basicSetup } from 'codemirror';
import { undo, redo } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { extensionOf } from '../lib/file';

export interface TextEditorApi {
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
}

interface Props {
  value: string;
  name: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorChange: (line: number, column: number) => void;
  apiRef: MutableRefObject<TextEditorApi | null>;
}

function languageFor(name: string) {
  switch (extensionOf(name)) {
    case 'json':
      return json();
    case 'js':
    case 'mjs':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'ts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    default:
      return [];
  }
}

const appTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--color-editor-bg)',
  },
  '.cm-scroller': {
    fontFamily: "'Cascadia Code', 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Consolas, monospace",
    fontSize: '12.5px',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-editor-bg)',
    color: '#4d5563',
    borderRight: '1px solid #252932',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#8b93a1',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  '.cm-content': {
    caretColor: '#7fb0ff',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(95, 145, 220, 0.28)',
  },
}, { dark: true });

export default function TextEditor({
  value,
  name,
  readOnly,
  onChange,
  onSave,
  onCursorChange,
  apiRef,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const handlersRef = useRef({ onChange, onSave, onCursorChange });
  handlersRef.current = { onChange, onSave, onCursorChange };

  useEffect(() => {
    apiRef.current = {
      undo: () => {
        const view = viewRef.current;
        if (!view) return;
        undo(view);
        view.focus();
      },
      redo: () => {
        const view = viewRef.current;
        if (!view) return;
        redo(view);
        view.focus();
      },
      copy: () => {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        const text = view.state.sliceDoc(selection.from, selection.to);
        if (text) void navigator.clipboard.writeText(text).catch(() => undefined);
      },
      cut: () => {
        const view = viewRef.current;
        if (!view || view.state.readOnly) return;
        const selection = view.state.selection.main;
        const text = view.state.sliceDoc(selection.from, selection.to);
        if (!text) return;
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            view.dispatch(view.state.replaceSelection(''));
            view.focus();
          })
          .catch(() => undefined);
      },
      paste: () => {
        const view = viewRef.current;
        if (!view || view.state.readOnly) return;
        void navigator.clipboard
          .readText()
          .then((text) => {
            if (!text) return;
            view.dispatch(view.state.replaceSelection(text));
            view.focus();
          })
          .catch(() => undefined);
      },
    };

    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        oneDark,
        appTheme,
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              handlersRef.current.onSave();
              return true;
            },
          },
        ]),
        languageFor(name),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlersRef.current.onChange(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            handlersRef.current.onCursorChange(line.number, head - line.from + 1);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    handlersRef.current.onCursorChange(line.number, head - line.from + 1);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 内容在挂载时一次性写入，切换文件由调用方的 key 重新挂载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, readOnly]);

  return <div className="cmHost" ref={hostRef} />;
}
