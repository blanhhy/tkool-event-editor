import { type MouseEvent } from 'react';
import { stripNewlines, type CommandLine } from '../lib/eventCommands';
import CommandIndent from './CommandIndent';

interface Props {
  /** 消息块：首行 ShowMessage + 若干 ShowMessage2 续行 */
  lines: CommandLine[];
  /** 点击选中该指令簇；lineIndex 为点击位置所在的行 */
  onSelect?: (lineIndex: number) => void;
  /** 该块是否属于当前选中的指令簇 */
  active?: boolean;
  /** 该块是整块选择区的首 / 尾块：只圆外露的角 */
  activeStart?: boolean;
  activeEnd?: boolean;
  /** 焦点行（0 基下标）；不在本块内时为 null */
  focusIndex?: number | null;
}

/**
 * 显示消息渲染（EasyRPG 风格）：
 *   首行 → 显示文字: 内容
 *   续行 → 内容与首行冒号之后的内容左对齐（10ch）
 *
 * 不做行内编辑：消息的参数需要专门的编辑器，后续再接入。
 */
export default function MessageBlock({
  lines,
  onSelect,
  active,
  activeStart,
  activeEnd,
  focusIndex,
}: Props) {
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
      onClick={(event) => onSelect?.(clickedLineIndex(event, lines[0].index))}
    >
      <div className="commandRow">
        <div className="commandIndex messageIndex">
          {displayLines.map((_, index) => (
            <div key={index} data-line-index={lines[0].index + index}>
              {firstNumber + index}
            </div>
          ))}
        </div>

        <div className="commandContent messageContent">
          <div
            className="messageLine"
            data-line-index={lines[0].index}
            data-round-top={activeStart ? 'true' : undefined}
            data-round-bottom={
              activeEnd && displayLines.length === 1 ? 'true' : undefined
            }
            data-focused={focusIndex === lines[0].index ? 'true' : undefined}
          >
            <CommandIndent depth={lines[0].indent} />
            <span className="commandName">显示文字</span>
            <span className="commandPunct">: </span>
            <span className="messageString">{displayLines[0] || '\u00A0'}</span>
          </div>
          {displayLines.slice(1).map((text, index) => (
            <div
              key={index}
              className="messageLine"
              data-line-index={lines[0].index + index + 1}
              data-round-bottom={
                activeEnd && index === displayLines.length - 2 ? 'true' : undefined
              }
              data-focused={
                focusIndex === lines[0].index + index + 1 ? 'true' : undefined
              }
            >
              <CommandIndent depth={lines[0].indent} />
              {/* 续行的左对齐缩进：10 个半角空格 =「显示文字: 」的全角半角宽度，
                  与首行文字左缘精确对齐，也能像普通文本一样被划选 */}
              <span className="commandTextSpacer">{'          '}</span>
              <span className="messageString">{text || '\u00A0'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 点击位置所在的行号；点在行间空白处时回落到块首行 */
function clickedLineIndex(event: MouseEvent, fallback: number): number {
  const target = event.target as HTMLElement | null;
  const line = target?.closest<HTMLElement>('[data-line-index]');
  return line?.dataset.lineIndex ? Number(line.dataset.lineIndex) : fallback;
}
