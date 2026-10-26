/**
 * 语法配色，取自 CodeMirror 的 One Dark 主题（@codemirror/theme-one-dark 的 color 导出）。
 *
 * 这里保留一份本地副本而不是直接 import 那个包：它会把 CodeMirror 本体
 * 拉进主包，破坏 TextEditor 的按需加载。颜色本身仍以主题为准，只在此处维护。
 */
export const SYNTAX_COLORS = {
  /** malibu：函数名与指令名 */
  function: '#61afef',
  /** sage：字符串 */
  string: '#98c379',
  /** stone：注释 */
  comment: '#7d8799',
  /** stone：括号、反引号等标点（配合透明度弱化） */
  punctuation: '#7d8799',
  /** chalky：数字 */
  number: '#e5c07b',
  /** whiskey：布尔字面量 */
  boolean: '#d19a66',
} as const;
