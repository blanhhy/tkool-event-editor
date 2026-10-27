import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  COMMENT_LIMITS,
  splitCommandText,
  stripNewlines,
  type CommandLine,
} from '../lib/eventCommands';
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
}

/**
 * 注释块渲染（EasyRPG 风格）：
 *   首行 → 注释: 内容
 *   续行 → 内容与首行冒号之后的内容左对齐
 *
 * 注释是唯一保留行内编辑的指令：对着代码写注记更顺手。
 */
export default function CommentBlock({ lines, onSave, onSelect, active, focusIndex }: Props) {
  // 一条指令就是一行：残留的换行符直接剔除，否则会多出视觉行、行号错位
  const original = lines.map((line) => stripNewlines(line.text ?? '')).join('\n');
  const [value, setValue] = useState(original);
  const [draft, setDraft] = useState(original);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 切换事件页或重新加载时同步外部内容
  useEffect(() => {
    setValue(original);
    setDraft(original);
    setEditing(false);
  }, [original]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [editing]);

  function commit() {
    setEditing(false);
    // 数据库里每行单独存储，换行会变成额外的续行指令。
    // 注释没有行列限制（2000 编辑器那套只是软限制），因此只按换行拆分。
    const nextLines = splitCommandText(draft, COMMENT_LIMITS);
    setValue(nextLines.join('\n'));
    onSave?.(draft);
  }

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  const displayLines = (editing ? draft : value).split('\n');
  const firstNumber = lines[0].index + 1;

  // 一条指令占一个行号：文本里的换行已在显示前剔除，不再产生额外的视觉行
  const gutter = displayLines.map((_, index) => firstNumber + index);

  return (
    <div
      className="commentBlock"
      role="listitem"
      data-command-index={lines[0].index}
      data-active={active ? 'true' : undefined}
      onClick={(event) => onSelect?.(clickedLineIndex(event, lines[0].index))}
    >
      <div className="commandRow">
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
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setDraft(value);
                    setEditing(false);
                  }
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
