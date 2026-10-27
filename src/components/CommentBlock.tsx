import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { stripNewlines, type CommandLine } from '../lib/eventCommands';
import { selectionOutline, type SelectionBand } from '../lib/selectionShape';
import CommandIndent from './CommandIndent';

interface Props {
  /** 注释块：首行 Comment + 若干 Comment2 续行 */
  lines: CommandLine[];
  /** 编辑完成：text 为整段文本（换行会拆成多条续行指令） */
  onSave?: (text: string) => void;
  /** 点击选中该指令簇；lineIndex 为点击位置所在的行 */
  onSelect?: (lineIndex: number) => void;
  /** 该块是否属于当前选中的指令簇 */
  active?: boolean;
  /** 该块是整块选择区的首 / 尾块：只圆外露的角 */
  activeStart?: boolean;
  activeEnd?: boolean;
  /** 焦点行（0 基下标）；不在本块内时为 null */
  focusIndex?: number | null;
  /** 整页指令条数，用于判断上下相邻是否还有指令 */
  commandCount: number;
}

/**
 * 注释块渲染（EasyRPG 风格）：
 *   首行 → 注释: 内容
 *   续行 → 内容与首行冒号之后的内容左对齐
 *
 * 注释是唯一保留行内编辑的指令：对着代码写注记更顺手。
 */
export default function CommentBlock({
  lines,
  onSave,
  onSelect,
  active,
  activeStart,
  activeEnd,
  focusIndex,
  commandCount,
}: Props) {
  // 一条指令就是一行：残留的换行符直接剔除，否则会多出视觉行、行号错位
  const original = lines.map((line) => stripNewlines(line.text ?? '')).join('\n');
  const [value, setValue] = useState(original);
  const [draft, setDraft] = useState(original);
  const [editing, setEditing] = useState(false);
  /** 进入编辑时的初始光标位置（整段文本中的偏移） */
  const [caret, setCaret] = useState(0);
  /** 进入编辑时的文本，Esc 时用它撤销这次编辑 */
  const beforeEditRef = useRef(original);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /**
   * 结束编辑时先压住簇高亮：点击别处会先触发失焦（这里恢复高亮），
   * 紧接着这次点击才把选择切到别的指令，中间会闪一下高亮。
   * 等焦点行真的变了（点击落地）或短暂超时后再恢复。
   */
  const [highlightSuppressed, setHighlightSuppressed] = useState(false);
  const exitFocusRef = useRef<number | null>(null);
  /** 行内编辑时文本域里选区的自绘轮廓（原生选区无法做圆角） */
  const [editShape, setEditShape] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    d: string;
  } | null>(null);

  // 外部内容变化（切换事件页 / 刷新 / 内存写回）时同步；编辑中不打断输入
  useEffect(() => {
    setValue(original);
    setDraft(original);
  }, [original]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const offset = Math.min(caret, input.value.length);
    input.setSelectionRange(offset, offset);
  }, [editing, caret]);

  // 编辑态下焦点行跟随光标：点击、方向键、输入换行等任何光标移动都会触发
  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;

    const sync = () => {
      if (document.activeElement !== input) return;
      const line = lines[0].index + input.value.slice(0, input.selectionStart).split('\n').length - 1;
      // 草稿里新加的行还没有对应的指令，先落到最后一条真实行上
      const next = Math.min(line, lines[lines.length - 1].index);
      if (next !== focusIndex) onSelect?.(next);
      setEditShape(measureTextareaSelection(input, contentRef.current));
    };

    document.addEventListener('selectionchange', sync);
    return () => document.removeEventListener('selectionchange', sync);
  }, [editing, focusIndex, lines, onSelect]);

  // 焦点行是注释行时，按 Enter 进入编辑，光标落在该行行尾
  useEffect(() => {
    if (editing || focusIndex == null) return;
    const texts = value.split('\n');
    const line = focusIndex - lines[0].index;
    if (line < 0 || line >= texts.length) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      let offset = 0;
      for (let index = 0; index < line; index += 1) offset += texts[index].length + 1;
      event.preventDefault();
      beforeEditRef.current = value;
      setDraft(value);
      setCaret(offset + texts[line].length);
      setEditing(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, focusIndex, lines, value]);

  /** 输入即写回内存（保存时才落盘），没有单独的“提交”动作 */
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setDraft(next);
    onSave?.(next);
  }

  /**
   * 退出编辑；revert 时把文本恢复成进入编辑时的内容（Esc）。
   * suppressHighlight 用于失焦退出：这次点击可能马上把选择切走，先别恢复簇高亮。
   */
  function stopEditing(revert = false, suppressHighlight = false) {
    if (revert && draft !== beforeEditRef.current) {
      setDraft(beforeEditRef.current);
      onSave?.(beforeEditRef.current);
    }
    setEditShape(null);
    setEditing(false);
    if (suppressHighlight) {
      exitFocusRef.current = focusIndex ?? null;
      setHighlightSuppressed(true);
    }
  }

  // 焦点行变化说明这次点击已经落地，簇高亮按新的选择结果来
  useEffect(() => {
    if (!highlightSuppressed) return;
    if (focusIndex === exitFocusRef.current) return;
    setHighlightSuppressed(false);
  }, [focusIndex, highlightSuppressed]);

  // 兜底：点击没有改变选择（例如点了侧栏）时，稍后再恢复高亮
  useEffect(() => {
    if (!highlightSuppressed) return;
    const timer = window.setTimeout(() => setHighlightSuppressed(false), 120);
    return () => window.clearTimeout(timer);
  }, [highlightSuppressed]);

  /** 点中注释文字时进入编辑：光标落在点击处，点在该行文字右侧空白则落到行尾 */
  function startEditing(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // 命令名与冒号只选中，不进入编辑
    if (target.closest('.commandName, .commandPunct')) return;
    // 鼠标划选文字时不进入编辑，保留文本选区供复制
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    beforeEditRef.current = value;
    setDraft(value);
    setCaret(caretOffset(event, value.split('\n'), lines[0].index));
    setEditing(true);
  }

  /**
   * 编辑态下点击文本区：按鼠标纵坐标换算焦点行。
   * 不能用 input.selectionStart：点击只是把已有选区收起时，光标移动与
   * selectionchange 都不一定及时，焦点行会留在上一次划选的位置。
   */
  function clickedFocusLine(clientY: number): number {
    const input = inputRef.current;
    const first = lines[0].index;
    const last = lines[lines.length - 1].index;
    if (!input) return first;

    const rect = input.getBoundingClientRect();
    const lineHeight =
      parseFloat(window.getComputedStyle(input).lineHeight) ||
      rect.height / Math.max(1, displayLines.length);
    const row = Math.floor((clientY - rect.top + input.scrollTop) / lineHeight);
    // 草稿里新加的行还没有对应的指令，先落到最后一条真实行上
    return Math.min(first + Math.max(row, 0), last);
  }

  const displayLines = (editing ? draft : value).split('\n');
  const firstNumber = lines[0].index + 1;

  /**
   * 焦点行在文本块内的行序号。
   * 非编辑态每行自带底色；编辑态整块是一个文本域，用一条色带标出光标所在行。
   */
  const focusLine =
    focusIndex != null &&
    focusIndex >= lines[0].index &&
    focusIndex < lines[0].index + displayLines.length
      ? focusIndex - lines[0].index
      : null;

  // 一条指令占一个行号：文本里的换行已在显示前剔除，不再产生额外的视觉行
  const gutter = displayLines.map((_, index) => firstNumber + index);

  return (
    // 行内编辑时不显示簇选中色：只保留焦点行色带
    <div
      className="commentBlock"
      role="listitem"
      data-command-index={lines[0].index}
      data-active={active && !editing && !highlightSuppressed ? 'true' : undefined}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        // 编辑态点文本区时按鼠标所在行定焦点；点行号仍按点击的行
        if (editing && !target.closest('[data-line-index]')) {
          onSelect?.(clickedFocusLine(event.clientY));
          return;
        }
        onSelect?.(clickedLineIndex(event, lines[0].index));
      }}
    >
      <div className="commandRow">
        <div className="commandIndex commentIndex">
          {gutter.map((number, index) => (
            <div key={index} data-line-index={lines[0].index + index}>
              {number ?? '\u00A0'}
            </div>
          ))}
        </div>

        <div className="commandContent commentContent" ref={contentRef}>
          {/* 编辑态：整块是一个文本域，用一条色带标出焦点行（只覆盖内容区） */}
          {editing && focusLine !== null && (
            <div
              className="editFocusBand"
              style={{ '--focus-line': String(focusLine) } as CSSProperties}
              aria-hidden="true"
            />
          )}
          {/* 文本域里的选区也合并成一条外轮廓，凸角与凹角都倒圆 */}
          {editing && editShape && (
            <svg
              className="commentSelectionShape"
              style={{ left: editShape.left, top: editShape.top }}
              width={editShape.width}
              height={editShape.height}
              aria-hidden="true"
            >
              <path d={editShape.d} />
            </svg>
          )}
          {editing ? (
            <div className="commentLine commentEditLine" onClick={() => inputRef.current?.focus()}>
              <CommandIndent depth={lines[0].indent} />
              <span className="commandName">注释</span>
              <span className="commandPunct">: </span>
              <textarea
                ref={inputRef}
                className="commentInput"
                value={draft}
                rows={Math.max(1, displayLines.length)}
                spellCheck={false}
                onChange={handleChange}
                // 划选结束 / 点击收起选区时 click 不一定派发，鼠标松开就同步焦点行
                onMouseUp={(event) => {
                  if (event.button !== 0) return;
                  onSelect?.(clickedFocusLine(event.clientY));
                  setEditShape(measureTextareaSelection(event.currentTarget, contentRef.current));
                }}
                onBlur={() => stopEditing(false, true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    stopEditing(true);
                    return;
                  }
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

                  const input = event.currentTarget;
                  // 有选区时按默认行为折叠选区，不跳转
                  if (input.selectionStart !== input.selectionEnd) return;

                  const draftLines = input.value.split('\n');
                  const caretLine = input.value
                    .slice(0, input.selectionStart)
                    .split('\n').length - 1;

                  if (event.key === 'ArrowDown') {
                    // 只在最后一行下移时离开注释，交给下一条指令
                    if (caretLine !== draftLines.length - 1) return;
                    const next = lines[lines.length - 1].index + 1;
                    if (next >= commandCount) return;
                    event.preventDefault();
                    stopEditing();
                    onSelect?.(next);
                    return;
                  }

                  // 只在第一行上移时离开注释，交给上一条指令
                  if (caretLine !== 0) return;
                  const prev = lines[0].index - 1;
                  if (prev < 0) return;
                  event.preventDefault();
                  stopEditing();
                  onSelect?.(prev);
                }}
              />
            </div>
          ) : (
            <div className="commentLines" onClick={startEditing}>
              <div
                className="commentLine"
                data-line-index={lines[0].index}
                data-round-top={activeStart ? 'true' : undefined}
                data-round-bottom={
                  activeEnd && displayLines.length === 1 ? 'true' : undefined
                }
                data-focused={focusIndex === lines[0].index ? 'true' : undefined}
              >
                <CommandIndent depth={lines[0].indent} />
                <span className="commandName">注释</span>
                <span className="commandPunct">: </span>
                <span className="commentText">{displayLines[0] || '\u00A0'}</span>
              </div>
              {displayLines.slice(1).map((text, index) => (
                <div
                  key={index}
                  className="commentLine"
                  data-line-index={lines[0].index + index + 1}
                  data-round-bottom={
                    activeEnd && index === displayLines.length - 2 ? 'true' : undefined
                  }
                  data-focused={
                    focusIndex === lines[0].index + index + 1 ? 'true' : undefined
                  }
                >
                  <CommandIndent depth={lines[0].indent} />
                  {/* 续行的左对齐缩进：6 个半角空格 =「注释: 」的全角半角宽度，
                      与首行文字左缘精确对齐，也能像普通文本一样被划选 */}
                  <span className="commandTextSpacer">{'      '}</span>
                  <span className="commentText">{text || '\u00A0'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 点击位置所在的行号；点在行间空白处时回落到块首行 */
function clickedLineIndex(event: MouseEvent, fallback: number): number {
  const target = event.target as HTMLElement | null;
  const line = target?.closest<HTMLElement>('[data-line-index]');
  return line?.dataset.lineIndex ? Number(line.dataset.lineIndex) : fallback;
}

/**
 * 点击位置在整段注释文本中的字符偏移。
 * 点在文字中间时按实际插入点；点在文字右侧空白（或行间）时落到该行行尾。
 */
function caretOffset(event: MouseEvent, texts: string[], firstIndex: number): number {
  const range = caretRangeAt(event.clientX, event.clientY);
  const node = range?.node ?? null;
  const element = node
    ? node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as HTMLElement)
    : null;
  const textEl = element?.closest<HTMLElement>('.commentText') ?? null;

  const lineEl =
    textEl?.closest<HTMLElement>('[data-line-index]') ??
    (event.target as HTMLElement).closest<HTMLElement>('[data-line-index]');
  const rawLine = lineEl ? Number(lineEl.dataset.lineIndex) - firstIndex : texts.length - 1;
  const line = Math.min(Math.max(rawLine, 0), texts.length - 1);
  // 空白处取行尾；文字处取插入点（渲染用的占位字符不计入真实文本）
  const column = Math.min(
    textEl && range ? range.offset : texts[line].length,
    texts[line].length,
  );

  let offset = 0;
  for (let row = 0; row < line; row += 1) offset += texts[row].length + 1;
  return offset + column;
}

/** 从鼠标坐标取得文档插入点（Chrome 用 caretRangeFromPoint，Firefox 用 caretPositionFromPoint） */
function caretRangeAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (px: number, py: number) => Range | null;
    caretPositionFromPoint?: (px: number, py: number) => { offsetNode: Node; offset: number } | null;
  };

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };

  const position = doc.caretPositionFromPoint?.(x, y);
  return position ? { node: position.offsetNode, offset: position.offset } : null;
}

/**
 * 文本域里选区的外轮廓。
 * 文本域的选区不进入文档 Selection，拿不到几何，只能用同版式的镜像元素量出
 * 每行片段，再合并成一条带圆角的外轮廓（原生 ::selection 做不了圆角）。
 */
function measureTextareaSelection(
  input: HTMLTextAreaElement,
  container: HTMLElement | null,
): { left: number; top: number; width: number; height: number; d: string } | null {
  if (!container || input.selectionStart === input.selectionEnd) return null;

  const style = window.getComputedStyle(input);
  const mirror = document.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  Object.assign(mirror.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    margin: '0',
    padding: '0',
    border: '0',
    width: `${input.clientWidth}px`,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
    whiteSpace: 'pre-wrap',
    wordBreak: style.wordBreak,
    overflowWrap: style.overflowWrap,
    tabSize: style.tabSize,
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  mirror.textContent = input.value;
  document.body.appendChild(mirror);

  try {
    const start = textOffsetPosition(mirror, input.selectionStart);
    const end = textOffsetPosition(mirror, input.selectionEnd);
    if (!start || !end) return null;

    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    const mirrorRect = mirror.getBoundingClientRect();
    const lineHeight = parseFloat(style.lineHeight) || mirrorRect.height;
    const bands: SelectionBand[] = [];

    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0.5 || rect.height <= 0.5) continue;
      // 纵向对齐到整行：不同片段的高度差不会在行间留下缝隙
      const row = Math.round((rect.top - mirrorRect.top) / lineHeight);
      const top = Math.round(row * lineHeight);
      bands.push({
        left: Math.round(rect.left - mirrorRect.left),
        width: Math.round(rect.width),
        top,
        height: Math.round((row + 1) * lineHeight) - top,
      });
    }

    const shape = selectionOutline(bands, 2);
    if (!shape) return null;

    const inputRect = input.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      left: Math.round(inputRect.left - containerRect.left),
      top: Math.round(inputRect.top - containerRect.top),
      width: shape.width,
      height: shape.height,
      d: shape.d,
    };
  } finally {
    mirror.remove();
  }
}

/** 在元素内按字符偏移定位文本节点 */
function textOffsetPosition(root: Node, offset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (remaining <= text.data.length) return { node: text, offset: remaining };
    remaining -= text.data.length;
  }
  return null;
}
