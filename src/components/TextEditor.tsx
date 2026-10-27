import { useEffect, useRef, type MutableRefObject } from 'react';
import { basicSetup } from 'codemirror';
import { undo, redo } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { extensionOf } from '../lib/file';
import { selectionOutline, type SelectionBand } from '../lib/selectionShape';

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

/**
 * 选区画成一条合并外轮廓：相邻行连成一块，凸角与凹角一起倒圆。
 * 几何直接复用 CodeMirror 自己算好的行盒（.cm-selectionLayer 里的矩形），
 * 原生矩形只负责提供位置，视觉上隐藏。
 */
const roundedSelection = ViewPlugin.fromClass(
  class {
    private svg: SVGSVGElement;
    private path: SVGPathElement;
    private frame = 0;
    private measure = { read: () => null, write: () => this.draw() };

    constructor(private view: EditorView) {
      const ns = 'http://www.w3.org/2000/svg';
      this.svg = document.createElementNS(ns, 'svg');
      this.svg.setAttribute('class', 'cm-roundedSelection');
      this.path = document.createElementNS(ns, 'path');
      this.svg.appendChild(this.path);
      view.scrollDOM.appendChild(this.svg);
      view.scrollDOM.addEventListener('scroll', this.schedule, { passive: true });
      this.schedule();
    }

    update() {
      this.schedule();
    }

    destroy() {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.view.scrollDOM.removeEventListener('scroll', this.schedule);
      this.svg.remove();
    }

    /** 等 CodeMirror 本次测量写入行盒后再取几何，避免读到上一帧的选区 */
    private schedule = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.view.requestMeasure(this.measure);
      });
    };

    private draw() {
      const layer = this.view.scrollDOM.querySelector('.cm-selectionLayer');
      const bands: SelectionBand[] = [];

      if (layer) {
        for (const node of Array.from(layer.children)) {
          const element = node as HTMLElement;
          if (!element.classList.contains('cm-selectionBackground')) continue;

          const left = parseFloat(element.style.left);
          const top = parseFloat(element.style.top);
          const width = parseFloat(element.style.width);
          const height = parseFloat(element.style.height);
          if (![left, top, width, height].every(Number.isFinite)) continue;
          if (width <= 0 || height <= 0) continue;
          bands.push({ left, top, width, height });
        }
      }

      const shape = selectionOutline(bands, 2);
      if (!shape) {
        this.svg.style.display = 'none';
        return;
      }

      this.svg.style.display = '';
      this.svg.setAttribute('width', String(shape.width));
      this.svg.setAttribute('height', String(shape.height));
      this.path.setAttribute('d', shape.d);
    }
  },
);

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
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(95, 145, 220, 0.28)',
  },
  // 原生选区矩形只用来提供几何信息，实际由自绘轮廓显示（见 roundedSelection）
  '.cm-selectionLayer': {
    opacity: '0',
  },
  '.cm-roundedSelection': {
    position: 'absolute',
    left: '0',
    top: '0',
    zIndex: '-2',
    pointerEvents: 'none',
  },
  '.cm-roundedSelection path': {
    fill: 'rgb(62, 68, 81)',
  },
  '::selection': {
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
        roundedSelection,
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
