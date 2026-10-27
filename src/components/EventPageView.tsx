import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { EventCommand } from 'rpgrt';
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

/** 事件页的指令操作接口，供编辑菜单与快捷键调用 */
export interface EventPageApi {
  /** 复制选择区内的指令，返回 JSON */
  copy: () => string | null;
  /** 剪切：复制并删除选择区，返回 JSON */
  cut: () => string | null;
  /** 在插入点插入 JSON 指令；解析失败返回 false */
  paste: (json: string) => boolean;
}

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
  /** 指令操作接口（复制 / 剪切 / 粘贴） */
  apiRef?: MutableRefObject<EventPageApi | null>;
  /** 选择区变化通知，用于菜单项启用状态 */
  onSelectionChange?: (hasSelection: boolean) => void;
  /** 写回一段指令区间：删除 deleteCount 条后插入 lines */
  onReplaceCommands?: (startIndex: number, deleteCount: number, lines: EventCommand[]) => void;
  /** 删除指定下标的指令（code10 是否参与由选择区规则决定） */
  onDeleteCommands?: (indices: number[]) => void;
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
  apiRef,
  onSelectionChange,
  onReplaceCommands,
  onDeleteCommands,
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

      // 文本块内的行以块容器为 offsetParent，按相对滚动容器的实际位置算
      const top =
        row.getBoundingClientRect().top -
        list.getBoundingClientRect().top +
        list.scrollTop;
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

  /** 写回完成、指令刷新后要恢复的选择（剪切 / 粘贴用） */
  const pendingSelection = useRef<{ anchor: number; focus: number } | null>(null);

  useEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    pendingSelection.current = null;
    const limit = commands.length;
    const anchor = Math.min(pending.anchor, limit);
    const focus = Math.min(pending.focus, limit);
    selectRows(anchor, focus, anchor !== focus);
  }, [commands, selectRows]);

  /**
   * 某行的 code10 是否随它所在的子代码块一起被完整选中。
   * code10 由编辑器自己维护，只有整块被选中时才允许复制 / 删除。
   */
  const isInsideSelectedBlock = useCallback(
    (index: number, start: number, end: number) => {
      const parentIndent = (commands[index]?.indent ?? 0) - 1;
      if (parentIndent < 0) return false;

      for (const cluster of clusters.values()) {
        if (cluster.indent !== parentIndent) continue;
        if (cluster.index >= index || cluster.end < index) continue;
        return cluster.index >= start && cluster.end <= end;
      }
      return false;
    },
    [commands, clusters],
  );

  /** 选择区内可复制 / 删除的行；同级的 code10 不参与，除非它所在的子代码块被整体选中 */
  const selectedIndices = useMemo(() => {
    if (!span) return [];
    const result: number[] = [];
    for (let index = span.start; index <= span.end; index += 1) {
      const line = commands[index];
      if (!line) continue;
      if (line.code === Cmd.End && !isInsideSelectedBlock(index, span.start, span.end)) continue;
      result.push(index);
    }
    return result;
  }, [span, commands, isInsideSelectedBlock]);

  /** 选择区内的指令序列化成剪贴板 JSON */
  const copySelection = useCallback((): string | null => {
    if (!span || selectedIndices.length === 0) return null;
    return JSON.stringify(
      selectedIndices.map((index) => toCommandPayload(commands[index])),
      null,
      2,
    );
  }, [commands, span, selectedIndices]);

  /** 剪切：复制选择区后把它从事件页里删除 */
  const cutSelection = useCallback((): string | null => {
    const json = copySelection();
    if (!json || !span || !onDeleteCommands) return json;

    pendingSelection.current = { anchor: span.start, focus: span.start };
    onDeleteCommands(selectedIndices);
    return json;
  }, [copySelection, span, selectedIndices, onDeleteCommands]);

  /** 粘贴：解析 JSON，在插入点按该处缩进插入 */
  const pasteSelection = useCallback(
    (json: string): boolean => {
      const parsed = parseCommandPayload(json);
      if (!parsed || !onReplaceCommands) return false;

      // 插入点沿用加号的位置：选择区第一行之前，缩进取该簇的层级
      const start = span ? span.start : commands.length;
      const indent = span ? clusters.get(span.start)?.indent ?? 0 : 0;
      const delta = indent - parsed[0].indent;
      const lines = parsed.map((item) => ({
        ...item,
        indent: Math.max(0, item.indent + delta),
      }));

      pendingSelection.current = { anchor: start, focus: start + lines.length - 1 };
      onReplaceCommands(start, 0, lines);
      return true;
    },
    [span, clusters, commands.length, onReplaceCommands],
  );

  // 暴露给编辑菜单与快捷键
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { copy: copySelection, cut: cutSelection, paste: pasteSelection };
  });

  useEffect(() => {
    if (!apiRef) return;
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  useEffect(() => {
    onSelectionChange?.(span !== null);
  }, [span, onSelectionChange]);

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
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Delete') return;

      // 焦点在输入框里时不拦截
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Delete') {
        if (!onDeleteCommands || !span || selectedIndices.length === 0) return;
        event.preventDefault();
        pendingSelection.current = { anchor: span.start, focus: span.start };
        onDeleteCommands(selectedIndices);
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
  }, [selection, commands.length, selectRows, span, selectedIndices, onDeleteCommands]);

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

/** 指令在剪贴板里的 JSON 形态 */
interface CommandPayload {
  code: number;
  indent: number;
  parameters: number[];
  string?: string;
}

function toCommandPayload(line: CommandLine): CommandPayload {
  return {
    code: line.code,
    indent: line.indent,
    parameters: line.params,
    ...(line.text !== null ? { string: line.text } : {}),
  };
}

/** 解析剪贴板 JSON；结构不合法时返回 null */
function parseCommandPayload(json: string): EventCommand[] | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;

  const result: EventCommand[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Partial<CommandPayload>;
    if (typeof record.code !== 'number') return null;
    result.push({
      code: record.code,
      indent: typeof record.indent === 'number' ? record.indent : 0,
      parameters: Array.isArray(record.parameters)
        ? record.parameters.filter((value) => typeof value === 'number')
        : [],
      string: typeof record.string === 'string' ? record.string : '',
    });
  }
  return result;
}
