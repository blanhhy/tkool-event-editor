import archiveIcon from '../assets/jetbrains-icons/archive.svg?raw';
import audioIcon from '../assets/jetbrains-icons/audio.svg?raw';
import binaryIcon from '../assets/jetbrains-icons/binary.svg?raw';
import configIcon from '../assets/jetbrains-icons/config.svg?raw';
import cssIcon from '../assets/jetbrains-icons/css.svg?raw';
import csvIcon from '../assets/jetbrains-icons/csv.svg?raw';
import codeIcon from '../assets/jetbrains-icons/code.svg?raw';
import folderIcon from '../assets/jetbrains-icons/folder.svg?raw';
import fontIcon from '../assets/jetbrains-icons/font.svg?raw';
import htmlIcon from '../assets/jetbrains-icons/html.svg?raw';
import imageIcon from '../assets/jetbrains-icons/image.svg?raw';
import javascriptIcon from '../assets/jetbrains-icons/javascript.svg?raw';
import jsonIcon from '../assets/jetbrains-icons/json.svg?raw';
import markdownIcon from '../assets/jetbrains-icons/markdown.svg?raw';
import mapIcon from '../assets/jetbrains-icons/map.svg?raw';
import objectIcon from '../assets/jetbrains-icons/object.svg?raw';
import packageIcon from '../assets/jetbrains-icons/package.svg?raw';
import propertiesIcon from '../assets/jetbrains-icons/properties.svg?raw';
import sqlIcon from '../assets/jetbrains-icons/sql.svg?raw';
import tableIcon from '../assets/jetbrains-icons/table.svg?raw';
import textIcon from '../assets/jetbrains-icons/text.svg?raw';
import typescriptIcon from '../assets/jetbrains-icons/typescript.svg?raw';
import unknownIcon from '../assets/jetbrains-icons/unknown.svg?raw';
import videoIcon from '../assets/jetbrains-icons/video.svg?raw';
import xmlIcon from '../assets/jetbrains-icons/xml.svg?raw';
import yamlIcon from '../assets/jetbrains-icons/yaml.svg?raw';

const ICONS = {
  archive: archiveIcon,
  audio: audioIcon,
  binary: binaryIcon,
  config: configIcon,
  css: cssIcon,
  csv: csvIcon,
  code: codeIcon,
  folder: folderIcon,
  font: fontIcon,
  html: htmlIcon,
  image: imageIcon,
  javascript: javascriptIcon,
  json: jsonIcon,
  markdown: markdownIcon,
  map: mapIcon,
  object: objectIcon,
  package: packageIcon,
  properties: propertiesIcon,
  sql: sqlIcon,
  table: tableIcon,
  text: textIcon,
  typescript: typescriptIcon,
  unknown: unknownIcon,
  video: videoIcon,
  xml: xmlIcon,
  yaml: yamlIcon,
};

type IconKey = keyof typeof ICONS;

export type { IconKey };

/** 扩展名 → 图标。未列出的扩展名统一使用 unknown */
const ICON_BY_EXT: Record<string, IconKey> = {
  txt: 'text',
  log: 'text',
  nfo: 'text',
  md: 'markdown',
  markdown: 'markdown',
  json: 'json',
  ini: 'config',
  cfg: 'config',
  conf: 'config',
  env: 'config',
  properties: 'properties',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  xsd: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  csv: 'csv',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  bmp: 'image',
  webp: 'image',
  ico: 'image',
  svg: 'image',
  tif: 'image',
  tiff: 'image',
  xyz: 'image',
  psd: 'image',
  cur: 'image',
  icns: 'image',
  heic: 'image',
  avif: 'image',
  tga: 'image',
  wav: 'audio',
  mid: 'audio',
  midi: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  flac: 'audio',
  aac: 'audio',
  m4a: 'audio',
  wma: 'audio',
  mod: 'audio',
  s3m: 'audio',
  xm: 'audio',
  it: 'audio',
  avi: 'video',
  mpg: 'video',
  mpeg: 'video',
  mp4: 'video',
  mov: 'video',
  wmv: 'video',
  mkv: 'video',
  webm: 'video',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
  eot: 'font',
  fnt: 'font',
  fon: 'font',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  gz: 'archive',
  tar: 'archive',
  bz2: 'archive',
  sql: 'sql',
  db: 'table',
  ldb: 'table',
  lmu: 'map',
  lmt: 'map',
  dat: 'binary',
  lcf: 'binary',
  rpg2000: 'binary',
  rpg2003: 'binary',
  exe: 'binary',
  dll: 'binary',
  rvdata2: 'binary',
  rvdata: 'binary',
  lsd: 'binary',
  lgs: 'binary',
  emu: 'binary',
  r3proj: 'text',
  rvproj2: 'xml',
  rvproj: 'xml',
  rxproj: 'xml',
  rb: 'text',
  gemspec: 'text',
  rhtml: 'html',
};

function iconKey(filename: string): IconKey {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return 'unknown';
  return ICON_BY_EXT[filename.slice(dot + 1).toLowerCase()] ?? 'unknown';
}

interface Props {
  name?: string;
  kind?: 'file' | 'directory';
  /** 直接指定图标，优先于按扩展名推断 */
  icon?: IconKey;
  size?: number;
}

export default function FileTypeIcon({ name = '', kind = 'file', icon, size = 16 }: Props) {
  const svg = icon ? ICONS[icon] : kind === 'directory' ? ICONS.folder : ICONS[iconKey(name)];
  return (
    <span
      className="fileTypeIcon"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
