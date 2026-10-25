import addDirectorySvg from '../assets/jetbrains-icons/addDirectory.svg?raw';
import addFileSvg from '../assets/jetbrains-icons/addFile.svg?raw';
import refreshSvg from '../assets/jetbrains-icons/refresh.svg?raw';

interface IconProps {
  size?: number;
  className?: string;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ChevronIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" {...stroke} />
    </svg>
  );
}

export function FolderIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M1.75 4.25A1.25 1.25 0 0 1 3 3h3.1c.35 0 .68.14.92.4l.86.9H13A1.25 1.25 0 0 1 14.25 5.6v6.15A1.25 1.25 0 0 1 13 13H3a1.25 1.25 0 0 1-1.25-1.25z"
        {...stroke}
      />
    </svg>
  );
}

export function FolderOpenIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M1.75 11.5V4.25A1.25 1.25 0 0 1 3 3h3.1c.35 0 .68.14.92.4l.86.9H12.4c.69 0 1.25.56 1.25 1.25v1.2" {...stroke} />
      <path d="M2.4 12.8h10.9c.67 0 1.15-.63.98-1.27l-1.05-3.9a1 1 0 0 0-.97-.73H2.05a.65.65 0 0 0-.63.8l.62 3.9c.06.36.36.6.72.6z" {...stroke} />
    </svg>
  );
}

export function FileIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M4 1.75h4.9L12.25 5.1v9.15A1.25 1.25 0 0 1 11 15.5H4a1.25 1.25 0 0 1-1.25-1.25V3A1.25 1.25 0 0 1 4 1.75z" {...stroke} />
      <path d="M8.75 1.9v3.35h3.3" {...stroke} />
    </svg>
  );
}

/** 让 JetBrains 图标跟随按钮的 currentColor，避免与文本/箭头颜色不一致 */
function monochrome(svg: string): string {
  return svg.replace(/(fill|stroke)="#[0-9a-fA-F]{6}"/g, '$1="currentColor"');
}

const addFileIcon = monochrome(addFileSvg);
const addDirectoryIcon = monochrome(addDirectorySvg);
const refreshIcon = monochrome(refreshSvg);

function JetBrainsIcon({ svg, size = 16, className }: IconProps & { svg: string }) {
  return (
    <span
      className={className ? `uiIcon ${className}` : 'uiIcon'}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function NewFileIcon({ size = 16, className }: IconProps) {
  return <JetBrainsIcon svg={addFileIcon} size={size} className={className} />;
}

export function NewFolderIcon({ size = 16, className }: IconProps) {
  return <JetBrainsIcon svg={addDirectoryIcon} size={size} className={className} />;
}

export function RefreshIcon({ size = 16, className }: IconProps) {
  return <JetBrainsIcon svg={refreshIcon} size={size} className={className} />;
}

export function ExplorerIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2c.4 0 .78.16 1.06.44L11.2 6.9H19.5A1.5 1.5 0 0 1 21 8.4v9.1a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M3.4 9.5h17.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
