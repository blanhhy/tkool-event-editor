import type { EventCommand } from 'rpgrt';
import {
  eventPageDisplayName,
  formatEventPagePath,
  type EventCatalog,
  type EventPageRef,
} from './events';

/** 索引中的一行文本：对应事件页里的一条指令 */
export interface TextLine {
  /** 指令在事件页指令数组中的下标 */
  commandIndex: number;
  text: string;
}

/** 搜索索引中的一页：页的展示名、路径与该页全部文本行 */
export interface SearchPageEntry {
  ref: EventPageRef;
  /** 页的展示名（公共事件名 / 地图事件名 / 敌群名） */
  name: string;
  /** CExxxx / MAPxxxx/EVxxxx/Px / Troopxxxx/Px */
  path: string;
  lines: TextLine[];
}

/** 一页内的匹配：所在指令、行文本、匹配位置与长度 */
export interface SearchMatch {
  /** 匹配行对应的指令下标（用于跳转到事件页的对应行） */
  commandIndex: number;
  text: string;
  /** 匹配在行内的起始位置 */
  offset: number;
  length: number;
}

export interface SearchGroup extends SearchPageEntry {
  matches: SearchMatch[];
}

/** 单行节选：匹配前后的文本与匹配本身（用于高亮） */
export interface MatchExcerpt {
  before: string;
  match: string;
  after: string;
}

export interface SearchablePage {
  ref: EventPageRef;
  name: string;
  path: string;
}

/** 枚举工程内所有事件页，供搜索索引逐页读取指令 */
export function listSearchablePages(catalog: EventCatalog): SearchablePage[] {
  const pages: SearchablePage[] = [];

  for (const event of catalog.commonEvents) {
    const name = eventPageDisplayName(event);
    for (const page of event.pages) {
      pages.push({ ref: page.ref, name, path: formatEventPagePath(page.ref) });
    }
  }

  for (const map of catalog.maps) {
    for (const event of map.events) {
      const name = eventPageDisplayName(event);
      for (const page of event.pages) {
        pages.push({ ref: page.ref, name, path: formatEventPagePath(page.ref) });
      }
    }
  }

  for (const troop of catalog.troops) {
    const name = eventPageDisplayName(troop);
    for (const page of troop.pages) {
      pages.push({ ref: page.ref, name, path: formatEventPagePath(page.ref) });
    }
  }

  return pages;
}

/**
 * 提取一页指令里的全部文本字段。
 * 每条指令携带的字符串即一个文本行；消息 / 注释的续行本身也是独立指令，
 * 因此同一个文本块的多行会各自成为一行，节选只在行内进行。
 */
export function collectTextLines(commands: EventCommand[]): TextLine[] {
  const lines: TextLine[] = [];
  commands.forEach((command, commandIndex) => {
    if (command.string) lines.push({ commandIndex, text: command.string });
  });
  return lines;
}

/** 在页文本行中查找查询串（忽略大小写），同一行只取第一处匹配 */
export function searchPages(entries: SearchPageEntry[], query: string): SearchGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const groups: SearchGroup[] = [];
  for (const entry of entries) {
    const matches: SearchMatch[] = [];
    for (const line of entry.lines) {
      const offset = line.text.toLowerCase().indexOf(needle);
      if (offset === -1) continue;
      matches.push({
        commandIndex: line.commandIndex,
        text: line.text,
        offset,
        length: needle.length,
      });
    }
    if (matches.length > 0) groups.push({ ...entry, matches });
  }
  return groups;
}

/** 截取匹配附近的一小段文本，用于侧栏单行展示（超出部分以省略号表示） */
export function buildMatchExcerpt(
  text: string,
  offset: number,
  length: number,
  before = 10,
  after = 30,
): MatchExcerpt {
  const start = Math.max(0, offset - before);
  const end = Math.min(text.length, offset + length + after);
  return {
    before: `${start > 0 ? '…' : ''}${text.slice(start, offset)}`,
    match: text.slice(offset, offset + length),
    after: `${text.slice(offset + length, end)}${end < text.length ? '…' : ''}`,
  };
}
