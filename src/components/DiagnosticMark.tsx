import type { Diagnostic } from '../lib/commandSpec';

/** 行尾的问题标记，悬停能看到具体原因 */
export default function DiagnosticMark({ diagnostics }: { diagnostics?: Diagnostic[] }) {
  if (!diagnostics || diagnostics.length === 0) return null;

  const hasError = diagnostics.some((item) => item.severity === 'error');
  const text = diagnostics.map((item) => item.message).join('；');

  return (
    <span
      className="commandDiagnostic"
      data-severity={hasError ? 'error' : 'warning'}
      title={diagnostics.map((item) => item.message).join('\n')}
      aria-label={text}
    >
      ⚠
    </span>
  );
}
