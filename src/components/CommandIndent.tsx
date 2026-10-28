/** 每层缩进的空格数：默认 4 个半角空格宽 */
const SPACES_PER_LEVEL = 4;
/** 缩进线颜色数量：按层循环取色，形成彩虹效果 */
const GUIDE_COLORS = 6;

interface Props {
  /** 嵌套层级：每层四个半角空格 */
  depth: number;
}

/**
 * 事件缩进。
 * 与文本编辑器一致，用真实空格表示而不是装饰线，
 * 因此划选整行时缩进也会一起被选中、随文本一起复制。
 *
 * 缩进线从第 0 列起，每层一条。最深处那一层紧挨行首文字，按规则不画，
 * 因此缩进线只出现在「左侧全空、右侧与行首文字仍留有空列」的位置；
 * 没有缩进的行（第 0 列右侧就是文字）也就没有缩进线。
 */
export default function CommandIndent({ depth }: Props) {
  if (depth <= 0) return null;

  return (
    <>
      <span className="commandIndent">{' '.repeat(depth * SPACES_PER_LEVEL)}</span>
      <span className="indentGuides" aria-hidden="true">
        {Array.from({ length: depth }, (_, level) => (
          <span
            key={level}
            className="indentGuide"
            data-level={level % GUIDE_COLORS}
            style={{ left: `${level * SPACES_PER_LEVEL}ch` }}
          />
        ))}
      </span>
    </>
  );
}
