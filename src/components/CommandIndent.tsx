/** 每层缩进的空格数：默认 4 个半角空格宽 */
const SPACES_PER_LEVEL = 4;

interface Props {
  /** 嵌套层级：每层四个半角空格 */
  depth: number;
}

/**
 * 事件缩进。
 * 与文本编辑器一致，用真实空格表示而不是装饰线，
 * 因此划选整行时缩进也会一起被选中、随文本一起复制。
 */
export default function CommandIndent({ depth }: Props) {
  if (depth <= 0) return null;
  return <span className="commandIndent">{' '.repeat(depth * SPACES_PER_LEVEL)}</span>;
}
