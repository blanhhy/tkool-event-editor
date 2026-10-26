import { useMemo } from 'react';
import { Cmd } from '../lib/commandCodes';
import { groupCommandLines, type CommandLine, type TextBlockKind } from '../lib/eventCommands';
import {
  validateEventPage,
  type CommandEnvironment,
  type Diagnostic,
} from '../lib/commandSpec';
import CommentBlock from './CommentBlock';
import DiagnosticMark from './DiagnosticMark';
import IndentGuides from './IndentGuides';
import MessageBlock from './MessageBlock';
import WaitCommand from './WaitCommand';

interface Props {
  title: string;
  commands: CommandLine[];
  loading: boolean;
  error: string | null;
  /** 文本块编辑完成：lines 为该块覆盖的指令，text 为编辑后的整段文本 */
  onSaveBlock?: (kind: TextBlockKind, lines: CommandLine[], text: string) => void;
  /** 指令参数编辑完成 */
  onSaveParameters?: (line: CommandLine, parameters: number[]) => void;
  /** 指令集与参数校验环境；为空时不校验 */
  environment?: CommandEnvironment;
}

export default function EventPageView({
  title,
  commands,
  loading,
  error,
  onSaveBlock,
  onSaveParameters,
  environment,
}: Props) {
  // 指令集归属与参数合法性：一条指令可能同时有多条诊断
  const diagnosticsByIndex = useMemo(() => {
    const map = new Map<number, Diagnostic[]>();
    if (!environment) return map;

    for (const diagnostic of validateEventPage(commands, environment)) {
      const list = map.get(diagnostic.index);
      if (list) list.push(diagnostic);
      else map.set(diagnostic.index, [diagnostic]);
    }
    return map;
  }, [commands, environment]);

  const errorCount = Array.from(diagnosticsByIndex.values())
    .flat()
    .filter((item) => item.severity === 'error').length;

  return (
    <div className="eventPageView">
      <div className="eventPageHeader">
        <span className="eventPageTitle" title={title}>
          {title}
        </span>
        {errorCount > 0 && (
          <span className="eventPageDiagnosticCount" title={summarize(diagnosticsByIndex)}>
            {`${errorCount} 个问题`}
          </span>
        )}
        {commands.length > 0 && <span className="eventPageMeta">{`${commands.length} 条指令`}</span>}
      </div>

      {/* 刷新期间保留旧内容，避免整页被占位文本替换造成闪烁 */}
      {error && <div className="eventPageEmpty eventPageError">{error}</div>}
      {!error && commands.length === 0 && (
        <div className="eventPageEmpty">{loading ? '读取事件页…' : '事件页没有指令'}</div>
      )}

      {commands.length > 0 && (
        <div className="commandList" role="list">
          {groupCommandLines(commands).map((row) =>
            row.kind === 'comment' ? (
              <CommentBlock
                key={`comment-${row.lines[0].index}`}
                lines={row.lines}
                onSave={(text) => onSaveBlock?.('comment', row.lines, text)}
              />
            ) : row.kind === 'message' ? (
              <MessageBlock
                key={`message-${row.lines[0].index}`}
                lines={row.lines}
                onSave={(text) => onSaveBlock?.('message', row.lines, text)}
              />
            ) : row.line.code === Cmd.Wait ? (
              <WaitCommand
                key={row.line.index}
                line={row.line}
                diagnostics={diagnosticsByIndex.get(row.line.index)}
                onSave={(parameters) => onSaveParameters?.(row.line, parameters)}
              />
            ) : (
              <CommandRow
                key={row.line.index}
                line={row.line}
                diagnostics={diagnosticsByIndex.get(row.line.index)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function CommandRow({ line, diagnostics }: { line: CommandLine; diagnostics?: Diagnostic[] }) {
  return (
    <div className="commandRow" role="listitem">
      <span className="commandIndex">{line.index + 1}</span>
      <IndentGuides depth={line.indent} />
      <div
        className="commandContent"
        data-role={line.role}
        data-unknown={line.unknown ? 'true' : undefined}
      >
        <span className="commandName">
          {line.name}
          {/* 指令 10 是可插入新代码的空行，标成 @> 提示插入点；> 用标点配色 */}
          {line.code === Cmd.End && <span className="commandPunct">&gt;</span>}
        </span>
        {line.params.length > 0 && (
          <span className="commandParams">{line.params.join(', ')}</span>
        )}
        {line.text && <span className="commandText">{line.text}</span>}
        <DiagnosticMark diagnostics={diagnostics} />
      </div>
    </div>
  );
}

/** 页头问题数气泡的提示文本 */
function summarize(diagnosticsByIndex: Map<number, Diagnostic[]>): string {
  return Array.from(diagnosticsByIndex.entries())
    .slice(0, 8)
    .map(
      ([index, list]) =>
        `第 ${index + 1} 条：${list.map((item) => item.message).join('；')}`,
    )
    .join('\n');
}
