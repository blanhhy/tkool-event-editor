import { useEffect, useRef, useState } from 'react';
import { splitCommandText, textFitsCommandLimits, type CommandLine } from '../lib/eventCommands';

interface Props {
  /** 注释块：首行 12410 + 若干 22410 续行 */
  lines: CommandLine[];
  /** 编辑完成：text 为整段文本（换行会拆成多条续行指令） */
  onSave?: (text: string) => void;
}

/**
 * 注释块渲染：
 *   单行（只有 12410）        →  # 内容
 *   多行（12410 + 22410…）    →  Python 风格三引号块
 *
 * 编辑时也按当前文本的行数即时切换形态（乐观渲染）：
 * 在单行注释里敲回车，立刻变成三引号块。
 * 三引号只是视觉分隔，不占行号；行号只对应实际指令。
 */
export default function CommentBlock({ lines, onSave }: Props) {
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
    // 数据库里每行单独存储，换行会变成额外的续行指令；
    // 先按「每行宽度上限 + 最多 4 行」折好，展示也用折行后的结果。
    const nextLines = splitCommandText(draft);
    setValue(nextLines.join('\n'));
    onSave?.(draft);
  }

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  const displayLines = (editing ? draft : value).split('\n');
  const isMultiLine = displayLines.length > 1;
  const firstNumber = lines[0].index + 1;

  return (
    <div className="commentBlock" role="listitem">
      {isMultiLine && (
        <div key="fence-top" className="commandRow commentFenceRow" onClick={startEditing}>
          <span className="commandIndex" />
          <div className="commandContent commentFence">"""</div>
        </div>
      )}

      <div key="body" className="commandRow">
        <div className="commandIndex commentIndex">
          {displayLines.map((_, index) => (
            <div key={index}>{firstNumber + index}</div>
          ))}
        </div>

        <div className="commandContent commentContent">
          <div className={isMultiLine ? 'commentMultiBody' : 'commentSingle'}>
            {!isMultiLine && <span className="commentHash">#</span>}
            {editing ? (
              <textarea
                ref={inputRef}
                className="commentInput"
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
            ) : (
              <div className="commentLines" onClick={startEditing}>
                {displayLines.map((text, index) => (
                  <div className="commentLine" key={index}>
                    {text || '\u00A0'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMultiLine && (
        <div key="fence-bottom" className="commandRow commentFenceRow" onClick={startEditing}>
          <span className="commandIndex" />
          <div className="commandContent commentFence">"""</div>
        </div>
      )}
    </div>
  );
}
