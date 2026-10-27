import { stripNewlines, type CommandLine } from '../lib/eventCommands';
import IndentGuides from './IndentGuides';

interface Props {
  /** 消息块：首行 ShowMessage + 若干 ShowMessage2 续行 */
  lines: CommandLine[];
  /** 鼠标进入该指令簇 */
  onHover?: () => void;
  /** 鼠标离开该指令簇 */
  onHoverEnd?: () => void;
  /** 该块是否属于当前选中的指令簇 */
  active?: boolean;
}

/**
 * 显示消息渲染（EasyRPG 风格）：
 *   首行 → 显示文字: 内容
 *   续行 → 内容与首行冒号之后的内容左对齐（10ch）
 *
 * 不做行内编辑：消息的参数需要专门的编辑器，后续再接入。
 */
export default function MessageBlock({ lines, onHover, onHoverEnd, active }: Props) {
  // 一条指令就是一行：残留的换行符直接剔除，否则会多出视觉行、行号错位
  const displayLines = lines
    .map((line) => stripNewlines(line.text ?? ''))
    .join('\n')
    .split('\n');
  const firstNumber = lines[0].index + 1;

  return (
    <div
      className="messageBlock"
      role="listitem"
      data-command-index={lines[0].index}
      data-active={active ? 'true' : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      <div className="commandRow">
        <div className="commandIndex messageIndex">
          {displayLines.map((_, index) => (
            <div key={index}>{firstNumber + index}</div>
          ))}
        </div>

        <IndentGuides depth={lines[0].indent} />

        <div className="commandContent messageContent">
          <div className="messageLine">
            <span className="commandName">显示文字</span>
            <span className="commandPunct">: </span>
            <span className="messageString">{displayLines[0] || '\u00A0'}</span>
          </div>
          {displayLines.slice(1).map((text, index) => (
            <div key={index} className="messageLine">
              {/* 续行用同构的不可见前缀占位，保证与首行文字左缘严格对齐 */}
              <span className="commandPrefixSpacer" aria-hidden="true">
                <span className="commandName">显示文字</span>
                <span className="commandPunct">: </span>
              </span>
              <span className="messageString">{text || '\u00A0'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
