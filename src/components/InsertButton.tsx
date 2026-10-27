interface Props {
  /** 相对指令列表内容的纵向位置（簇首行的上边缘） */
  top: number;
  onInsert: () => void;
}

/**
 * 指令簇左侧的插入按钮（行号栏与编辑区的分界线上，垂直对齐簇的上边缘）。
 * 只在有选中簇时显示；由 EventPageView 统一渲染，
 * 因此闭合符的簇也能显示在块头位置。
 */
export default function InsertButton({ top, onInsert }: Props) {
  return (
    <button
      type="button"
      className="insertButton"
      style={{ top }}
      title="插入指令"
      aria-label="插入指令"
      onClick={(event) => {
        // 避免触发指令簇本身的点击（重新选中）
        event.stopPropagation();
        onInsert();
      }}
    >
      +
    </button>
  );
}
