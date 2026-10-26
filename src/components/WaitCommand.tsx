import { useEffect, useRef, useState } from 'react';
import type { Diagnostic } from '../lib/commandSpec';
import type { CommandLine } from '../lib/eventCommands';
import DiagnosticMark from './DiagnosticMark';

interface Props {
  line: CommandLine;
  /** 该行的指令集 / 参数诊断 */
  diagnostics?: Diagnostic[];
  onSave?: (parameters: number[]) => void;
}

/**
 * 等待指令（Wait）：
 *   等待时间 → @sleep(30 :0.1s)      参数以 0.1 秒为单位
 *   等待输入 → @sleep(input=true)    参数 2 非 0 时优先于参数 1
 *
 * 编辑时可直接输入数字或 true；不符合规范（如负数、文本）则不采用更改。
 */
export default function WaitCommand({ line, diagnostics, onSave }: Props) {
  const hasSecondParameter = line.params.length > 1;
  const isInputWait = hasSecondParameter && line.params[1] !== 0;
  const value = line.params[0] ?? 0;
  const text = isInputWait ? 'true' : String(value);

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

    const parsed = parseWaitArgument(draft, hasSecondParameter);
    if (!parsed) {
      // 参数不符合规范：保留原值
      setDraft(text);
      return;
    }

    const unchanged =
      parsed.length === line.params.length && parsed.every((item, index) => item === line.params[index]);
    if (unchanged) {
      setDraft(text);
      return;
    }

    onSave?.(parsed);
  }

  return (
    <div className="commandRow" role="listitem">
      <span className="commandIndex">{line.index + 1}</span>
      <div
        className="commandContent waitContent"
        style={{ paddingLeft: line.indent * 18 }}
        onClick={editing ? undefined : startEditing}
      >
        <span className="commandName">@sleep</span>
        <span className="waitPunct">(</span>
        {editing ? (
          <input
            ref={inputRef}
            className="waitInput"
            value={draft}
            spellCheck={false}
            style={{ width: `${Math.max(2, draft.length)}ch` }}
            onChange={(event) => setDraft(event.target.value)}
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
        ) : isInputWait ? (
          <>
            <span className="paramHint">input=</span>
            <span className="waitBoolean">true</span>
          </>
        ) : (
          <>
            <span className="waitNumber">{value}</span>
            <span className="paramHint">:0.1s</span>
          </>
        )}
        <span className="waitPunct">)</span>
        <DiagnosticMark diagnostics={diagnostics} />
      </div>
    </div>
  );
}

/**
 * 解析编辑文本：
 *   true（或 input=true）→ 等待输入，参数为 [0, 1]
 *   非负整数             → 等待时间
 * 其它输入返回 null，调用方不写回。
 */
function parseWaitArgument(text: string, hasSecondParameter: boolean): number[] | null {
  const trimmed = text.trim();

  if (/^(input\s*=\s*)?true$/i.test(trimmed)) return [0, 1];

  if (/^\d+$/.test(trimmed)) {
    const time = Number(trimmed);
    if (!Number.isSafeInteger(time)) return null;
    // 原本是双参数（2k3）时保留参数个数，第二项 0 表示等待时间
    return hasSecondParameter ? [time, 0] : [time];
  }

  return null;
}
