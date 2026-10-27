import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cmd } from '../lib/commandCodes';
import { buildCommandDisplay, type DisplayTone } from '../lib/commandDisplay';
import {
  findCommandClusters,
  groupCommandLines,
  type CommandCluster,
  type CommandLine,
  type TextBlockKind,
} from '../lib/eventCommands';
import {
  validateEventPage,
  type CommandEnvironment,
  type Diagnostic,
} from '../lib/commandSpec';
import CommandPicker from './CommandPicker';
import CommentBlock from './CommentBlock';
import DiagnosticMark from './DiagnosticMark';
import IndentGuides from './IndentGuides';
import InsertButton from './InsertButton';
import MessageBlock from './MessageBlock';

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
  // 行内编辑已移除；参数写回留给后续的专用编辑器
  onSaveParameters: _onSaveParameters,
  environment,
}: Props) {
  /** 打开指令选择弹窗时记录的目标位置；null 表示弹窗关闭 */
  const [insertTarget, setInsertTarget] = useState<Pick<CommandCluster, 'index' | 'indent'> | null>(
    null,
  );
  /**
   * 当前选择：focus 是焦点行（即当前选中的那一行），
   * extended 表示已按 Shift 进入多选，anchor 是 Shift 扩展的起点行。
   * 单选时选择区是焦点行所属的最小簇；多选时选择区按簇扩展到 anchor 与 focus 之间。
   */
  const [selection, setSelection] = useState<{
    anchor: number;
    focus: number;
    extended: boolean;
    top: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** 每条指令所属的最小指令簇 */
  const clusters = useMemo(() => findCommandClusters(commands), [commands]);

  /** 选择区：单选时是焦点行所属的最小簇；多选时覆盖 anchor 到 focus 之间所有行所在的整簇 */
  const span = useMemo(() => {
    if (!selection) return null;

    if (!selection.extended) {
      const cluster = clusters.get(selection.focus);
      return cluster
        ? { start: cluster.index, end: cluster.end }
        : { start: selection.focus, end: selection.focus };
    }

    const firstRow = Math.min(selection.anchor, selection.focus);
    const lastRow = Math.max(selection.anchor, selection.focus);
    let start = firstRow;
    let end = lastRow;

    // 逐行并入所在簇：焦点行在簇中间时，选择区仍是完整的最小簇
    for (let row = firstRow; row <= lastRow; row += 1) {
      const cluster = clusters.get(row);
      if (!cluster) continue;
      start = Math.min(start, cluster.index);
      end = Math.max(end, cluster.end);
    }

    return { start, end };
  }, [selection, clusters]);

  /** 选中一段行；anchor 为 Shift 起点行，focus 为焦点行，extended 表示是否多选 */
  const selectRows = useCallback(
    (anchor: number, focus: number, extended: boolean) => {
      const list = listRef.current;
      if (!list) return;

      // 加号定位到选择区第一行：单选时是焦点行的簇首，多选时取两端簇首中靠前的
      const head = extended
        ? Math.min(clusters.get(anchor)?.index ?? anchor, clusters.get(focus)?.index ?? focus)
        : clusters.get(focus)?.index ?? focus;
      const row = list.querySelector<HTMLElement>(`[data-command-index="${head}"]`);
      if (!row) return;

      const top = row.offsetTop;
      setSelection((prev) =>
        prev &&
        prev.anchor === anchor &&
        prev.focus === focus &&
        prev.extended === extended &&
        prev.top === top
          ? prev
          : { anchor, focus, extended, top },
      );
    },
    [clusters],
  );

  // 焦点行滚出可视区时自动滚动，保证键盘导航时焦点行始终可见
  const focusRow = selection?.focus ?? null;
  useEffect(() => {
    if (focusRow === null) return;
    const list = listRef.current;
    if (!list) return;

    const row =
      list.querySelector<HTMLElement>(`[data-line-index="${focusRow}"]`) ??
      list.querySelector<HTMLElement>(`[data-command-index="${focusRow}"]`);
    if (!row) return;

    // 文本块内部的 offsetParent 是块自己的行容器，offsetTop 不能直接用，
    // 统一按相对滚动容器的实际位置计算
    const listTop = list.getBoundingClientRect().top;
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.top - listTop + list.scrollTop;
    const bottom = top + rowRect.height;

    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [focusRow]);

  // 选中后可用方向键移动：焦点行始终逐行移动，Shift 时选择区按簇扩展
  useEffect(() => {
    if (!selection) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

      // 焦点在输入框里时不拦截
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      const dir = event.key === 'ArrowUp' ? -1 : 1;
      const nextRow = Math.min(Math.max(selection.focus + dir, 0), commands.length);
      if (nextRow === selection.focus) return;

      if (event.shiftKey) {
        // Shift：焦点行仍逐行移动，起点行保持不变，选择区随之按簇扩展
        selectRows(selection.anchor, nextRow, true);
        return;
      }

      // 普通移动：选择区回到焦点行的最小簇
      selectRows(nextRow, nextRow, false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, commands.length, selectRows]);

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
      {!error && commands.length === 0 && loading && (
        <div className="eventPageEmpty">读取事件页…</div>
      )}

      {/* 空事件页也保留页尾的插入空白行；读取中且尚无内容时不显示 */}
      {!error && (commands.length > 0 || !loading) && (
        <div className="commandList" role="list" ref={listRef}>
          {groupCommandLines(commands).map((row) => {
            // 文本块的簇是整块，取首行；闭合符/否则标记的簇落回外层块头
            const first = row.kind === 'command' ? row.line : row.lines[0];
            const last = row.kind === 'command' ? row.line : row.lines[row.lines.length - 1];
            const rowProps = {
              // 点击哪一行，焦点就落在哪一行；选择区仍是该行所属的最小簇
              onSelect: (lineIndex: number) => selectRows(lineIndex, lineIndex, false),
              active: span !== null && first.index >= span.start && last.index <= span.end,
              // 焦点行单独强调：多行文本块内部按行判断
              focusIndex:
                selection !== null &&
                selection.focus >= first.index &&
                selection.focus <= last.index
                  ? selection.focus
                  : null,
            };

            return row.kind === 'comment' ? (
              <CommentBlock
                key={`comment-${row.lines[0].index}`}
                lines={row.lines}
                commandCount={commands.length}
                onSave={(text) => onSaveBlock?.('comment', row.lines, text)}
                {...rowProps}
              />
            ) : row.kind === 'message' ? (
              <MessageBlock
                key={`message-${row.lines[0].index}`}
                lines={row.lines}
                {...rowProps}
              />
            ) : (
              <CommandRow
                key={row.line.index}
                line={row.line}
                diagnostics={diagnosticsByIndex.get(row.line.index)}
                {...rowProps}
              />
            );
          })}

          {/* 末尾插入点：始终留出一行空白，滚到底部时可见；行号不参与指令计数 */}
          <div
            className="commandRow insertRow"
            data-command-index={commands.length}
            data-active={
              selection !== null &&
              (selection.anchor === commands.length || selection.focus === commands.length)
                ? 'true'
                : undefined
            }
            data-focused={selection?.focus === commands.length ? 'true' : undefined}
            onClick={() => selectRows(commands.length, commands.length, false)}
          >
            <span className="commandIndex">{commands.length + 1}</span>
          </div>

          {/* 单选时的插入按钮：定位到选择区第一行；多选时不显示，避免加号乱动 */}
          {selection && !selection.extended && insertTarget === null && (
            <InsertButton
              top={selection.top}
              onInsert={() =>
                setInsertTarget({
                  index: clusters.get(selection.focus)?.index ?? selection.focus,
                  indent: clusters.get(selection.focus)?.indent ?? 0,
                })
              }
            />
          )}
        </div>
      )}

      <CommandPicker
        open={insertTarget !== null}
        onClose={() => setInsertTarget(null)}
        environment={environment}
      />
    </div>
  );
}

function CommandRow({
  line,
  diagnostics,
  onSelect,
  active,
  focusIndex,
}: {
  line: CommandLine;
  diagnostics?: Diagnostic[];
  onSelect?: (lineIndex: number) => void;
  active?: boolean;
  focusIndex?: number | null;
}) {
  // 指令 10 是可插入新代码的空行，标成 @> 提示插入点；> 用标点配色
  const isEmptySlot = line.code === Cmd.End;
  const display = buildCommandDisplay(line);

  return (
    <div
      className="commandRow"
      role="listitem"
      data-command-index={line.index}
      data-active={active ? 'true' : undefined}
      data-focused={focusIndex === line.index ? 'true' : undefined}
      onClick={() => onSelect?.(line.index)}
    >
      <span className="commandIndex">{line.index + 1}</span>
      <IndentGuides depth={line.indent} />
      <div
        className="commandContent defaultContent"
        data-role={line.role}
        data-unknown={line.unknown ? 'true' : undefined}
      >
        {isEmptySlot ? (
          <>
            <span className="commandName">@</span>
            <span className="commandPunct">&gt;</span>
          </>
        ) : (
          <>
            {/* EasyRPG 风格：中文指令名 + 冒号 + 语义化的参数摘要 */}
            <span className="commandName">{display.name}</span>
            {display.segments.length > 0 && (
              <>
                <span className="commandPunct">: </span>
                {display.segments.map((item, index) => (
                  <span
                    key={index}
                    className={TONE_CLASS[item.tone]}
                    data-ref-kind={item.ref?.kind}
                    data-ref-id={item.ref?.id}
                  >
                    {item.text}
                  </span>
                ))}
              </>
            )}
          </>
        )}
        <DiagnosticMark diagnostics={diagnostics} />
      </div>
    </div>
  );
}

/** 摘要片段色调 → 已有的语法配色类 */
const TONE_CLASS: Record<DisplayTone, string> = {
  name: 'commandName',
  punct: 'commandPunct',
  number: 'commandParams',
  string: 'commandText',
  keyword: 'commandKeyword',
  variable: 'commandRef',
  switch: 'commandRef',
  database: 'commandDatabase',
  time: 'commandParams',
};

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
