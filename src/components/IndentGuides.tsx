/** 缩进参考线的颜色数量（与 codeTheme 的 INDENT_COLORS 一致，按层级循环） */
const INDENT_LEVELS = 6;

interface Props {
  /** 嵌套层级：每层一格，画一条竖线 */
  depth: number;
}

/**
 * 彩虹缩进参考线。
 * 用真实占位的格子参与 flex 布局，而不是 padding + 背景渐变，
 * 因此每条线都严格落在 18px 的缩进格左边缘，不会和文字错位。
 */
export default function IndentGuides({ depth }: Props) {
  if (depth <= 0) return null;

  return (
    <span className="indentGuides" aria-hidden="true">
      {Array.from({ length: depth }, (_, level) => (
        <span
          key={level}
          className="indentGuide"
          data-level={level % INDENT_LEVELS}
        />
      ))}
    </span>
  );
}
