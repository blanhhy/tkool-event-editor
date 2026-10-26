import { useEffect, useRef, useState } from 'react';
import type { Diagnostic } from '../lib/commandSpec';
import type { CommandLine } from '../lib/eventCommands';
import DiagnosticMark from './DiagnosticMark';
import IndentGuides from './IndentGuides';

interface Props {
  line: CommandLine;
  /** 标签渲染成 L1:，跳转标签渲染成 goto L1 */
  kind: 'label' | 'goto';
  /** 该行的指令集 / 参数诊断 */
  diagnostics?: Diagnostic[];
  onSave?: (parameters: number[]) => void;
  /** 鼠标进入该指令簇 */
  onHover?: () => void;
  /** 鼠标离开该指令簇 */
  onHoverEnd?: () => void;
  /** 该行是否属于当前选中的指令簇 */
  active?: boolean;
}

/**
 * 标签指令：
 *   标签     → L1:      L1 整体函数色，冒号为标点色
 *   跳转标签 → goto L1  goto 为关键字色，标签为函数色
 *
 * 编辑时只改数字部分（正整数、单行），隐藏冒号；
 * 失焦或回车提交，不符合规范（空、0、非数字）则保留原值，Esc 取消。
 */
export default function LabelCommand({
  line,
  kind,
  diagnostics,
  onSave,
  onHover,
  onHoverEnd,
  active,
}: Props) {
  const value = line.params[0] ?? 1;
  const text = String(value);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  // 切换事件页或重新加载时同步外部内容
  useEffect(() => {
    setDraft(text);
    setEditing(false);
  }, [text]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [editing]);

  function startEditing() {
    cancelledRef.current = false;
    setDraft(text);
    setEditing(true);
  }

  function commit() {
    setEditing(false);

    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(text);
      return;
    }

    const parsed = parseLabelId(draft);
    if (parsed === null || parsed === value) {
      setDraft(text);
      return;
    }

    onSave?.([parsed]);
  }

  return (
    <div
      className="commandRow"
      role="listitem"
      data-command-index={line.index}
      data-active={active ? 'true' : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      <span className="commandIndex">{line.index + 1}</span>
      <IndentGuides depth={line.indent} />
      <div
        className="commandContent defaultContent"
        onClick={editing ? undefined : startEditing}
      >
        {kind === 'goto' && <span className="commandKeyword">{'goto '}</span>}
        <span className="commandName">L</span>
        {editing ? (
          <input
            ref={inputRef}
            className="labelInput"
            value={draft}
            inputMode="numeric"
            spellCheck={false}
            style={{ width: `${Math.max(1, draft.length)}ch` }}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                inputRef.current?.blur();
              } else if (event.key === 'Escape') {
                cancelledRef.current = true;
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="commandName">{text}</span>
        )}
        {/* 冒号只是语法标记，编辑时隐藏 */}
        {kind === 'label' && !editing && <span className="commandPunct">:</span>}
        <DiagnosticMark diagnostics={diagnostics} />
      </div>
    </div>
  );
}

/** 标签号只接受正整数 */
function parseLabelId(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
