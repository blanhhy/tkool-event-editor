import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { EventCommand } from 'rpgrt';
import { Cmd } from '../lib/commandCodes';
import { buildCommandDisplay, type DisplayTone } from '../lib/commandDisplay';
import {
  buildInsertedCommands,
  findCommandClusters,
  groupCommandLines,
  type CommandCluster,
  type CommandDraft,
  type CommandLine,
  type TextBlockKind,
} from '../lib/eventCommands';
import {
  validateEventPage,
  type CommandEnvironment,
  type Diagnostic,
} from '../lib/commandSpec';
import CommandIndent from './CommandIndent';
import CommandPicker from './CommandPicker';
import CommentBlock from './CommentBlock';
import DiagnosticMark from './DiagnosticMark';
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
  /** 文本选区恰好覆盖完整指令簇时，把指令 JSON 同步给剪贴板（供之后粘贴） */
  onCopyCommands?: (json: string) => void;
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
  onCopyCommands,
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
  /** 是否有原生文本选区（鼠标划选文字时隐藏块状的簇高亮，只保留浏览器选区） */
  const [textSelecting, setTextSelecting] = useState(false);
  /** 自绘的整行选区带（每行一条，避免浏览器分段高亮造成缝隙与叠色） */
  const [selectionBands, setSelectionBands] = useState<SelectionBand[]>([]);
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

  /** 一批指令序列化成剪贴板 JSON（与选择区复制共用同一形态） */
  const commandsJson = useCallback(
    (indices: number[]): string =>
      JSON.stringify(
        indices.map((index) => toCommandPayload(commands[index])),
        null,
        2,
      ),
    [commands],
  );

  /** 选择区内的指令序列化成剪贴板 JSON */
  const copySelection = useCallback((): string | null => {
    if (!span || selectedIndices.length === 0) return null;
    return commandsJson(selectedIndices);
  }, [commandsJson, span, selectedIndices]);

  /**
   * 原生文本选区是否恰好覆盖一组完整的指令簇。
   * 是则返回涉及的指令下标区间；只要有一行是半选的、或跨进了某个簇的内部，
   * 就返回 null（此时按描述文本复制）。
   */
  const alignedTextSelection = useCallback((): { start: number; end: number } | null => {
    const list = listRef.current;
    const current = window.getSelection();
    if (!list || !current || current.isCollapsed || current.rangeCount === 0) return null;

    const range = current.getRangeAt(0);
    if (!list.contains(range.startContainer) || !list.contains(range.endContainer)) return null;

    const startLine = boundaryLine(range.startContainer, 'start');
    const endLine = boundaryLine(range.endContainer, 'end');
    if (!startLine || !endLine || !list.contains(startLine) || !list.contains(endLine)) return null;

    const start = lineIndexOf(startLine);
    const end = lineIndexOf(endLine);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;

    // 选区必须从首行文字起点覆盖到末行文字终点；行号与缩进参考线只是装饰
    const startContent = visibleContentRange(startLine);
    const endContent = visibleContentRange(endLine);
    if (!startContent || !endContent) return null;
    if (range.compareBoundaryPoints(Range.START_TO_START, startContent) > 0) return null;
    if (range.compareBoundaryPoints(Range.END_TO_END, endContent) < 0) return null;

    // 区间内每一行所在的簇都必须完整落在区间里；
    // code10 不能单独复制，只有它所在的子代码块被整体选中时才允许
    for (let index = start; index <= end; index += 1) {
      const line = commands[index];
      if (!line) continue;
      if (line.code === Cmd.End && !isInsideSelectedBlock(index, start, end)) return null;

      const cluster = clusters.get(index);
      if (!cluster) continue;
      if (cluster.index < start || cluster.end > end) return null;
    }

    return { start, end };
  }, [clusters, commands, isInsideSelectedBlock]);

  // 复制：文本选区对齐到完整指令簇时写指令 JSON，否则交给浏览器复制描述文本
  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const aligned = alignedTextSelection();
      if (aligned) {
        const indices: number[] = [];
        for (let index = aligned.start; index <= aligned.end; index += 1) indices.push(index);
        const json = commandsJson(indices);

        event.clipboardData?.setData('text/plain', json);
        event.preventDefault();
        onCopyCommands?.(json);
        return;
      }

      // 未对齐到完整指令簇：复制描述文本，并剔除行号栏
      const list = listRef.current;
      const current = window.getSelection();
      if (!list || !current || current.rangeCount === 0) return;
      const range = current.getRangeAt(0);
      const text = selectedText(list, range);
      if (text === null) return;

      event.clipboardData?.setData('text/plain', text);
      event.preventDefault();
    };

    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, [alignedTextSelection, commandsJson, onCopyCommands]);

  // 跟随原生文本选区：隐藏自定义高亮，并自绘等高的整行选区带
  useEffect(() => {
    const sync = () => {
      const list = listRef.current;
      const current = window.getSelection();
      const active =
        !!list &&
        !!current &&
        !current.isCollapsed &&
        current.rangeCount > 0 &&
        list.contains(current.anchorNode) &&
        list.contains(current.focusNode);

      setTextSelecting(active);
      setSelectionBands(active && list && current ? computeSelectionBands(list, current.getRangeAt(0)) : []);
    };

    document.addEventListener('selectionchange', sync);
    return () => document.removeEventListener('selectionchange', sync);
  }, []);

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

  /** 在加号位置插入选择弹窗里配置好的指令 */
  const insertCommand = useCallback(
    (draft: CommandDraft) => {
      if (!insertTarget || !onReplaceCommands) return;

      const lines = buildInsertedCommands(draft, insertTarget.indent);
      if (lines.length === 0) return;

      pendingSelection.current = {
        anchor: insertTarget.index,
        focus: insertTarget.index + lines.length - 1,
      };
      onReplaceCommands(insertTarget.index, 0, lines);
    },
    [insertTarget, onReplaceCommands],
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

      // 文本划选中：方向键交给浏览器折叠选区，Delete 不误删指令
      if (textSelecting) return;

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
  }, [
    selection,
    commands.length,
    selectRows,
    span,
    selectedIndices,
    onDeleteCommands,
    textSelecting,
  ]);

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
        <div
          className="commandList"
          role="list"
          ref={listRef}
          data-text-selecting={textSelecting ? 'true' : undefined}
        >
          {/* 自绘选区：整行一条色带，行与行严丝合缝，不做颜色叠加 */}
          <div className="textSelectionLayer" aria-hidden="true">
            {selectionBands.map((band, index) => (
              <div key={index} className="textSelectionRect" style={band} />
            ))}
          </div>

          {groupCommandLines(commands).map((row) => {
            // 文本块的簇是整块，取首行；闭合符/否则标记的簇落回外层块头
            const first = row.kind === 'command' ? row.line : row.lines[0];
            const last = row.kind === 'command' ? row.line : row.lines[row.lines.length - 1];
            const rowProps = {
              // 点击哪一行，焦点就落在哪一行；选择区仍是该行所属的最小簇
              onSelect: (lineIndex: number) => selectRows(lineIndex, lineIndex, false),
              // 只有一行的簇不铺选择色，只留焦点行色
              active:
                span !== null &&
                span.start !== span.end &&
                first.index >= span.start &&
                last.index <= span.end,
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
              span !== null &&
              span.start !== span.end &&
              (selection.anchor === commands.length || selection.focus === commands.length)
                ? 'true'
                : undefined
            }
            data-focused={selection?.focus === commands.length ? 'true' : undefined}
            onClick={() => selectRows(commands.length, commands.length, false)}
          >
            <span className="commandIndex">{commands.length + 1}</span>
            {/* 末尾行也留出内容区，使高亮同样不跨越行号栏 */}
            <div className="commandContent" />
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
        onInsert={insertCommand}
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
      <div
        className="commandContent defaultContent"
        data-role={line.role}
        data-unknown={line.unknown ? 'true' : undefined}
      >
        <CommandIndent depth={line.indent} />
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

/** 自绘选区带：相对指令列表内容坐标的矩形 */
interface SelectionBand {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** 文本节点是否属于行号栏（行号栏与文本编辑区完全独立，不参与划选与复制） */
function isGutterText(text: Text): boolean {
  return !!text.parentElement?.closest('.commandIndex');
}

/** 事件页里可参与文本选区的行元素：文本块每行 / 独立指令行 */
function lineElements(list: HTMLElement): HTMLElement[] {
  return Array.from(
    list.querySelectorAll<HTMLElement>('[data-line-index], [data-command-index]'),
  ).filter(
    (element) =>
      !element.closest('.commandIndex') &&
      !element.querySelector('[data-line-index], [data-command-index]'),
  );
}

/**
 * 把原生文本选区换算成「整行高」的选区带。
 * 浏览器会把整块行盒与文字片段各画一遍，导致高矮不一、行间有缝、颜色叠加；
 * 这里只取文字片段的横向范围，纵向统一用行元素的高度，得到与文本编辑器一致的色带。
 */
function computeSelectionBands(list: HTMLElement, range: Range): SelectionBand[] {
  const bands: SelectionBand[] = [];
  if (!list.contains(range.startContainer) || !list.contains(range.endContainer)) return bands;

  const listRect = list.getBoundingClientRect();
  const originX = listRect.left - list.scrollLeft;
  const originY = listRect.top - list.scrollTop;
  const lines = lineElements(list);

  for (const line of lines) {
    const lineRange = document.createRange();
    lineRange.selectNodeContents(line);

    // 与选区不相交的行直接跳过
    if (range.compareBoundaryPoints(Range.START_TO_END, lineRange) <= 0) continue;
    if (range.compareBoundaryPoints(Range.END_TO_START, lineRange) >= 0) continue;

    const box = line.getBoundingClientRect();
    if (box.height <= 0) continue;

    // 只统计文字片段的横向范围，忽略整块行盒产生的整行矩形
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;

    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      if (!text.data || isGutterText(text)) continue;

      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(text);
      if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) <= 0) continue;
      if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) >= 0) continue;

      const part = document.createRange();
      if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0) {
        part.setStart(nodeRange.startContainer, nodeRange.startOffset);
      } else {
        part.setStart(range.startContainer, range.startOffset);
      }
      if (range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0) {
        part.setEnd(nodeRange.endContainer, nodeRange.endOffset);
      } else {
        part.setEnd(range.endContainer, range.endOffset);
      }
      if (part.collapsed) continue;

      for (const rect of Array.from(part.getClientRects())) {
        if (rect.width <= 0) continue;
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
      }
    }

    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) continue;

    // 取整到整像素：相邻行的上下边界重合，不留下 1px 缝隙或叠色
    const top = Math.round(box.top - originY);
    const bottom = Math.round(box.bottom - originY);
    bands.push({
      top,
      left: Math.round(left - originX),
      width: Math.round(right - left),
      height: bottom - top,
    });
  }

  return bands;
}

/**
 * 选区覆盖的纯文本：逐行拼接，行号栏一律剔除。
 * 这样复制出来的描述文本与编辑器正文一致，不会混入行号。
 */
function selectedText(list: HTMLElement, range: Range): string | null {
  if (!list.contains(range.startContainer) || !list.contains(range.endContainer)) return null;

  const parts: string[] = [];
  for (const line of lineElements(list)) {
    const lineRange = document.createRange();
    lineRange.selectNodeContents(line);
    if (range.compareBoundaryPoints(Range.START_TO_END, lineRange) <= 0) continue;
    if (range.compareBoundaryPoints(Range.END_TO_START, lineRange) >= 0) continue;

    let text = '';
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const item = node as Text;
      if (!item.data || isGutterText(item)) continue;

      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(item);
      if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) <= 0) continue;
      if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) >= 0) continue;

      const from =
        range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0
          ? 0
          : range.startOffset;
      const to =
        range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0
          ? item.data.length
          : range.endOffset;
      text += item.data.slice(from, to);
    }

    if (text) parts.push(text);
  }

  return parts.join('\n');
}

/**
 * 选区边界所在的行元素。
 * 边界落在文本块容器上（块首/块尾的空白）时，按方向吸附到块内第一行或最后一行。
 */
function boundaryLine(node: Node, direction: 'start' | 'end'): HTMLElement | null {
  const element =
    node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  if (!element) return null;

  const line = element.closest<HTMLElement>('[data-line-index], [data-command-index]');
  if (!line) return null;

  // 注释 / 消息块容器本身带 data-command-index，真正的行在内部
  const inner = line.querySelectorAll<HTMLElement>('[data-line-index]');
  if (inner.length > 0 && !line.hasAttribute('data-line-index')) {
    return direction === 'start' ? inner[0] : inner[inner.length - 1];
  }
  return line;
}

/** 行元素对应的指令下标 */
function lineIndexOf(line: HTMLElement): number {
  return Number(line.dataset.lineIndex ?? line.dataset.commandIndex);
}

/**
 * 一行里用户可选的文字范围：
 * 跳过行号列、缩进参考线与隐藏的续行前缀占位，
 * 只保留指令名 / 参数 / 注释与消息文字。
 */
function visibleContentRange(line: HTMLElement): Range | null {
  const content = line.querySelector<HTMLElement>(':scope > .commandContent') ?? line;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let first: Text | null = null;
  let last: Text | null = null;
  let node = walker.nextNode();

  while (node) {
    const text = node as Text;
    if (text.data.trim() !== '') {
      const host = text.parentElement;
      const hidden =
        !host ||
        !!host.closest('[aria-hidden="true"]') ||
        getComputedStyle(host).visibility === 'hidden' ||
        getComputedStyle(host).userSelect === 'none';
      if (!hidden) {
        if (!first) first = text;
        last = text;
      }
    }
    node = walker.nextNode();
  }

  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.data.length);
  return range;
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
