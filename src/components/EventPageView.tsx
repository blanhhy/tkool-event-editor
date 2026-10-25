import { groupCommandLines, type CommandLine } from '../lib/eventCommands';
import CommentBlock from './CommentBlock';

interface Props {
  title: string;
  commands: CommandLine[];
  loading: boolean;
  error: string | null;
  /** 注释块编辑完成：lines 为该块覆盖的指令，text 为编辑后的整段文本 */
  onSaveComment?: (lines: CommandLine[], text: string) => void;
}

export default function EventPageView({
  title,
  commands,
  loading,
  error,
  onSaveComment,
}: Props) {
  return (
    <div className="eventPageView">
      <div className="eventPageHeader">
        <span className="eventPageTitle" title={title}>
          {title}
        </span>
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
                onSave={(text) => onSaveComment?.(row.lines, text)}
              />
            ) : (
              <div key={row.line.index} className="commandRow" role="listitem">
                <span className="commandIndex">{row.line.index + 1}</span>
                <div
                  className="commandContent"
                  data-role={row.line.role}
                  data-unknown={row.line.unknown ? 'true' : undefined}
                  style={{ paddingLeft: row.line.indent * 18 }}
                >
                  <span className="commandName">{row.line.name}</span>
                  {row.line.params.length > 0 && (
                    <span className="commandParams">{row.line.params.join(', ')}</span>
                  )}
                  {row.line.text && <span className="commandText">{row.line.text}</span>}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
