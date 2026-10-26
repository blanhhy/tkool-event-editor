import { useEffect, useRef, useState } from 'react';
import { splitCommandText, textFitsCommandLimits, type CommandLine } from '../lib/eventCommands';

interface Props {
  /** 消息块：首行 10110 + 若干 20110 续行 */
  lines: CommandLine[];
  /** 编辑完成：text 为整段文本（换行会拆成多条续行指令） */
  onSave?: (text: string) => void;
}

/**
 * 显示消息渲染：
 *   单行 → @message(`内容`)
 *   多行 → 续行文本与首行内容左对齐，闭合反引号跟在最后一行之后
 *
 * 事件指令不是函数调用，用 `@` 前缀标记为裸指令（暂用函数配色）；
 * 编辑时只保留 `@message(` 前缀，输入框紧随其后，
 * 因此输入框内每一行的起始位置天然对齐。
 */
export default function MessageBlock({ lines, onSave }: Props) {
  const original = lines.map((line) => line.text ?? '').join('\n');
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
    const nextLines = splitCommandText(draft);
    setValue(nextLines.join('\n'));
    onSave?.(draft);
  }

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  const displayLines = (editing ? draft : value).split('\n');
  const firstNumber = lines[0].index + 1;

  return (
    <div className="messageBlock" role="listitem">
      <div className="commandRow">
        <div className="commandIndex messageIndex">
          {displayLines.map((_, index) => (
            <div key={index}>{firstNumber + index}</div>
          ))}
        </div>

        <div className="commandContent messageContent">
          {editing ? (
            <div
              className="messageLine"
              onClick={() => inputRef.current?.focus()}
            >
              <span className="messageDirective">@message</span>
              <span className="messagePunct">(`</span>
              <textarea
                ref={inputRef}
                className="messageInput"
                value={draft}
                rows={Math.max(1, displayLines.length)}
                spellCheck={false}
                onChange={(event) => {
                  const next = event.target.value;
                  // 即将超出「每行宽度 / 总行数」限制时直接忽略这次输入
                  if (!textFitsCommandLimits(next)) {
                    const input = event.target;
                    const caret = input.selectionStart;
                    input.value = draft;
                    input.setSelectionRange(Math.max(0, caret - 1), Math.max(0, caret - 1));
                    return;
                  }
                  setDraft(next);
                }}
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
            <div className="messageCode" onClick={startEditing}>
              <div className="messageLine">
                <span className="messageDirective">@message</span>
                <span className="messagePunct">(`</span>
                <span className="messageString">{displayLines[0] || '\u00A0'}</span>
                {displayLines.length === 1 && <span className="messagePunct">`)</span>}
              </div>
              {displayLines.slice(1).map((text, index) => {
                const isLast = index === displayLines.length - 2;
                return (
                  <div key={index} className="messageLine messageContinuation">
                    <span className="messageString">{text || '\u00A0'}</span>
                    {isLast && <span className="messagePunct">`)</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
