import { getAllIcons, getIcon, type Icon } from 'material-file-icons';

/** RPG Maker 的 LCF 容器文件在通用图标包里没有对应项，手动映射到最接近的图标 */
const LCF_ICON_NAMES: Record<string, string> = {
  ldb: 'database',
  lmu: 'roadmap',
  lmt: 'tree',
};

const ICONS_BY_NAME = new Map<string, Icon>(getAllIcons().map((icon) => [icon.name, icon]));

function resolveIcon(filename: string): Icon {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
  const override = LCF_ICON_NAMES[ext];
  if (override) {
    const icon = ICONS_BY_NAME.get(override);
    if (icon) return icon;
  }
  return getIcon(filename);
}

interface Props {
  name: string;
  size?: number;
}

export default function FileTypeIcon({ name, size = 16 }: Props) {
  const icon = resolveIcon(name);
  return (
    <span
      className="fileTypeIcon"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  );
}
