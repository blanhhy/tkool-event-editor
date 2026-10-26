/**
 * 代码主题配色，取自 CodeMirror 的 One Dark 主题（@codemirror/theme-one-dark 的 color 导出）。
 *
 * 这里保留一份本地副本而不是直接 import 那个包：它会把 CodeMirror 本体
 * 拉进主包，破坏 TextEditor 的按需加载。颜色本身仍以主题为准，只在此处维护。
 */
const PALETTE = {
  /** malibu：函数名与指令名 */
  malibu: '#61afef',
  /** sage：字符串 */
  sage: '#98c379',
  /** stone：注释与标点 */
  stone: '#7d8799',
  /** chalky：数字 */
  chalky: '#e5c07b',
  /** whiskey：布尔字面量 */
  whiskey: '#d19a66',
  /** violet：关键字 */
  violet: '#c678dd',
  /** cyan：类型 / 常量 */
  cyan: '#56b6c2',
} as const;

export const SYNTAX_COLORS = {
  /** 函数名与指令名 */
  function: PALETTE.malibu,
  /** 字符串 */
  string: PALETTE.sage,
  /** 注释 */
  comment: PALETTE.stone,
  /** 括号、反引号等标点（配合透明度弱化） */
  punctuation: PALETTE.stone,
  /** 数字 */
  number: PALETTE.chalky,
  /** 布尔字面量 */
  boolean: PALETTE.whiskey,
} as const;

/** 缩进参考线：按嵌套层级循环取色，与语法着色同源 */
export const INDENT_COLORS = [
  PALETTE.malibu,
  PALETTE.sage,
  PALETTE.chalky,
  PALETTE.violet,
  PALETTE.cyan,
  PALETTE.whiskey,
] as const;
