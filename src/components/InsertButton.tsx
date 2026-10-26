interface Props {
  /** 相对指令列表内容的纵向位置（簇首行的上边缘） */
  top: number;
  /** 鼠标进入按钮时取消隐藏计时 */
  onHoverStart: () => void;
  /** 鼠标离开按钮时开始隐藏计时 */
  onHoverEnd: () => void;
  onInsert: () => void;
}

/**
 * 指令簇左侧的插入按钮（行号栏与编辑区的分界线上，垂直对齐簇的上边缘）。
 * 由 EventPageView 按当前 hover 到的簇统一渲染，因此闭合符的簇可以显示在块头位置。
 */
export default function InsertButton({ top, onHoverStart, onHoverEnd, onInsert }: Props) {
  return (
    <button
      type="button"
      className="insertButton"
      style={{ top }}
      title="插入指令"
      aria-label="插入指令"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={(event) => {
        // 避免触发指令簇本身的点击（如进入文本编辑）
        event.stopPropagation();
        onInsert();
      }}
    >
      +
    </button>
  );
}
