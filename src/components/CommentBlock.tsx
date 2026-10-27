import { useEffect, useRef, useState } from 'react';
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
  /** 鼠标进入该指令簇 */
  onHover?: () => void;
  /** 鼠标离开该指令簇 */
  onHoverEnd?: () => void;
  /** 该块是否属于当前选中的指令簇 */
  active?: boolean;
}

/**
 * 注释块渲染：
 *   单行（只有 Comment）        →  # 内容
 *   多行（Comment + Comment2…） →  Python 风格三引号块
 *
 * 编辑时也按当前文本的行数即时切换形态（乐观渲染）：
 * 在单行注释里敲回车，立刻变成三引号块。
 * 三引号只是视觉分隔，不占行号；行号只对应实际指令。
 */
export default function CommentBlock({ lines, onSave, onHover, onHoverEnd, active }: Props) {
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
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      <div className="commandRow">
        <div className="commandIndex commentIndex">
          {gutter.map((number, index) => (
            <div key={index}>{number ?? '\u00A0'}</div>
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
              <div className="commentLine">
                <span className="commandName">注释</span>
                <span className="commandPunct">: </span>
                <span className="commentText">{displayLines[0] || '\u00A0'}</span>
              </div>
              {displayLines.slice(1).map((text, index) => (
                <div key={index} className="commentLine">
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
