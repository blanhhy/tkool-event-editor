import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { stripNewlines, type CommandLine } from '../lib/eventCommands';
import IndentGuides from './IndentGuides';

interface Props {
  /** 注释块：首行 Comment + 若干 Comment2 续行 */
  lines: CommandLine[];
  /** 编辑完成：text 为整段文本（换行会拆成多条续行指令） */
  onSave?: (text: string) => void;
  /** 点击选中该指令簇；lineIndex 为点击位置所在的行 */
  onSelect?: (lineIndex: number) => void;
  /** 该块是否属于当前选中的指令簇 */
  active?: boolean;
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

  /** 退出编辑；revert 时把文本恢复成进入编辑时的内容（Esc） */
  function stopEditing(revert = false) {
    if (revert && draft !== beforeEditRef.current) {
      setDraft(beforeEditRef.current);
      onSave?.(beforeEditRef.current);
    }
    setEditing(false);
  }

  /** 点中注释文字时进入编辑：光标落在点击处，点在该行文字右侧空白则落到行尾 */
  function startEditing(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // 命令名、冒号与续行的对齐占位只选中，不进入编辑
    if (target.closest('.commandName, .commandPunct, .commandPrefixSpacer')) return;

    beforeEditRef.current = value;
    setDraft(value);
    setCaret(caretOffset(event, value.split('\n'), lines[0].index));
    setEditing(true);
  }

  /** 编辑态下点击文本区：焦点行跟随光标所在行 */
  function caretLineIndex(): number {
    const input = inputRef.current;
    if (!input) return lines[0].index;
    const before = input.value.slice(0, input.selectionStart);
    const line = lines[0].index + before.split('\n').length - 1;
    // 草稿里新加的行还没有对应的指令，先落到最后一条真实行上
    return Math.min(line, lines[lines.length - 1].index);
  }

  const displayLines = (editing ? draft : value).split('\n');
  const firstNumber = lines[0].index + 1;

  /** 焦点行在文本块内的行序号；整块用一条背景带标出，与普通指令行同宽 */
  const focusLine =
    focusIndex != null &&
    focusIndex >= lines[0].index &&
    focusIndex < lines[0].index + displayLines.length
      ? focusIndex - lines[0].index
      : null;

  // 一条指令占一个行号：文本里的换行已在显示前剔除，不再产生额外的视觉行
  const gutter = displayLines.map((_, index) => firstNumber + index);

  return (
    <div
      className="commentBlock"
      role="listitem"
      data-command-index={lines[0].index}
      data-active={active ? 'true' : undefined}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        // 编辑态点文本区时按光标所在行定焦点；点行号仍按点击的行
        if (editing && !target.closest('[data-line-index]')) {
          onSelect?.(caretLineIndex());
          return;
        }
        onSelect?.(clickedLineIndex(event, lines[0].index));
      }}
    >
      <div className="commandRow">
        {/* 焦点行：横跨行号列到右边缘，与普通指令行的焦点高亮同宽同高 */}
        {focusLine !== null && (
          <div
            className="blockFocusBand"
            style={{ '--focus-line': String(focusLine) } as CSSProperties}
            aria-hidden="true"
          />
        )}

        <div className="commandIndex commentIndex">
          {gutter.map((number, index) => (
            <div key={index} data-line-index={lines[0].index + index}>
              {number ?? '\u00A0'}
            </div>
          ))}
        </div>

        <IndentGuides depth={lines[0].indent} />

        <div className="commandContent commentContent">
          {editing ? (
            <div className="commentLine" onClick={() => inputRef.current?.focus()}>
              <span className="commandName">注释</span>
              <span className="commandPunct">: </span>
              <textarea
                ref={inputRef}
                className="commentInput"
                value={draft}
                rows={Math.max(1, displayLines.length)}
                spellCheck={false}
                onChange={handleChange}
                onBlur={() => stopEditing()}
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
                data-focused={focusIndex === lines[0].index ? 'true' : undefined}
              >
                <span className="commandName">注释</span>
                <span className="commandPunct">: </span>
                <span className="commentText">{displayLines[0] || '\u00A0'}</span>
              </div>
              {displayLines.slice(1).map((text, index) => (
                <div
                  key={index}
                  className="commentLine"
                  data-line-index={lines[0].index + index + 1}
                  data-focused={
                    focusIndex === lines[0].index + index + 1 ? 'true' : undefined
                  }
                >
                  {/* 续行用同构的不可见前缀占位，保证与首行文字左缘严格对齐 */}
                  <span className="commandPrefixSpacer" aria-hidden="true">
                    <span className="commandName">注释</span>
                    <span className="commandPunct">: </span>
                  </span>
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
