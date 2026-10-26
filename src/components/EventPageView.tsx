import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cmd } from '../lib/commandCodes';
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
import WaitCommand from './WaitCommand';

/** 鼠标移出指令簇后，留给移向加号按钮的宽限时间 */
const HOVER_HIDE_DELAY = 120;

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
  /** 打开指令选择弹窗时记录的目标位置；null 表示弹窗关闭 */
  const [insertTarget, setInsertTarget] = useState<Pick<CommandCluster, 'index' | 'indent'> | null>(
    null,
  );
  /** 当前 hover 到的最小指令簇，top 为该簇首行的纵向位置 */
  const [hovered, setHovered] = useState<(CommandCluster & { top: number }) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);

  /** 每条指令所属的最小指令簇 */
  const clusters = useMemo(() => findCommandClusters(commands), [commands]);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setHovered(null);
    }, HOVER_HIDE_DELAY);
  }, [cancelHide]);

  useEffect(() => cancelHide, [cancelHide]);

  /** 选中某个指令簇，并把加号定位到簇首行的上边缘 */
  const hoverCluster = useCallback(
    (cluster: CommandCluster) => {
      cancelHide();
      const row = listRef.current?.querySelector<HTMLElement>(
        `[data-command-index="${cluster.index}"]`,
      );
      if (!row) return;

      const top = row.offsetTop;
      setHovered((prev) =>
        prev && prev.index === cluster.index && prev.top === top
          ? prev
          : { ...cluster, top },
      );
    },
    [cancelHide],
  );

  /** 某条指令所属的簇（与渲染层保持一致） */
  const clusterFor = (line: CommandLine): CommandCluster =>
    clusters.get(line.index) ?? { index: line.index, indent: line.indent, end: line.index };

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
            const cluster = clusterFor(first);
            const rowProps = {
              onHover: () => hoverCluster(cluster),
              onHoverEnd: scheduleHide,
              // 整簇高亮：该行完整落在当前选中的簇范围内
              active: hovered !== null && first.index >= hovered.index && last.index <= hovered.end,
            };

            return row.kind === 'comment' ? (
              <CommentBlock
                key={`comment-${row.lines[0].index}`}
                lines={row.lines}
                onSave={(text) => onSaveBlock?.('comment', row.lines, text)}
                {...rowProps}
              />
            ) : row.kind === 'message' ? (
              <MessageBlock
                key={`message-${row.lines[0].index}`}
                lines={row.lines}
                onSave={(text) => onSaveBlock?.('message', row.lines, text)}
                {...rowProps}
              />
            ) : row.line.code === Cmd.Wait ? (
              <WaitCommand
                key={row.line.index}
                line={row.line}
                diagnostics={diagnosticsByIndex.get(row.line.index)}
                onSave={(parameters) => onSaveParameters?.(row.line, parameters)}
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
            data-active={hovered?.index === commands.length ? 'true' : undefined}
            onMouseEnter={() =>
              hoverCluster({ index: commands.length, indent: 0, end: commands.length })
            }
            onMouseLeave={scheduleHide}
          >
            <span className="commandIndex">{commands.length + 1}</span>
          </div>

          {/* 当前簇的插入按钮：统一渲染，闭合符的簇也能定位到块头 */}
          {hovered && insertTarget === null && (
            <InsertButton
              top={hovered.top}
              onHoverStart={cancelHide}
              onHoverEnd={scheduleHide}
              onInsert={() => setInsertTarget({ index: hovered.index, indent: hovered.indent })}
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
  onHover,
  onHoverEnd,
  active,
}: {
  line: CommandLine;
  diagnostics?: Diagnostic[];
  onHover?: () => void;
  onHoverEnd?: () => void;
  active?: boolean;
}) {
  // 指令 10 是可插入新代码的空行，标成 @> 提示插入点；> 用标点配色
  const isEmptySlot = line.code === Cmd.End;
  // 默认样式里的名字不带空格
  const displayName = line.name.replace(/\s+/g, '');

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
            {/* 没有专属编辑/渲染规则的指令统一显示成：@名字(裸参数, text="文本") */}
            <span className="commandName">{`@${displayName}`}</span>
            <span className="commandPunct">(</span>
            {line.params.map((param, index) => (
              <Fragment key={index}>
                {/* 逗号是标点，不能跟着参数染成数字色 */}
                {index > 0 && <span className="commandPunct">, </span>}
                <span className="commandParams">{param}</span>
              </Fragment>
            ))}
            {line.text !== null && (
              <>
                {/* 参数名 text 用气泡提示，与 @sleep 的提示一致 */}
                {line.params.length > 0 && <span className="commandPunct">, </span>}
                <span className="paramHint">text=</span>
                <span className="commandText">{`"${line.text}"`}</span>
              </>
            )}
            <span className="commandPunct">)</span>
          </>
        )}
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
