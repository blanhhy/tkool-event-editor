import type { EventCommand } from 'rpgrt';
import {
  formatEventLabel,
  formatEventPagePath,
  formatMapEventLabel,
  type EventCatalog,
  type EventPageRef,
} from './events';

/** 搜索索引中的一页：页的展示名、路径与该页全部文本行 */
export interface SearchPageEntry {
  ref: EventPageRef;
  /** 页的展示名（公共事件名 / 地图事件名 / 敌群名） */
  name: string;
  /** CExxxx / MAPxxxx/EVxxxx/Px / Troopxxxx/Px */
  path: string;
  lines: string[];
}

/** 一页内的匹配：行文本、匹配位置与长度 */
export interface SearchMatch {
  text: string;
  index: number;
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
    const name = event.name.trim()
      ? formatEventLabel(event.id, event.name)
      : `公共事件 ${event.id}`;
    for (const page of event.pages) {
      pages.push({ ref: page.ref, name, path: formatEventPagePath(page.ref) });
    }
  }

  for (const map of catalog.maps) {
    for (const event of map.events) {
      const name = formatMapEventLabel(event.id, event.name);
      for (const page of event.pages) {
        pages.push({ ref: page.ref, name, path: formatEventPagePath(page.ref) });
      }
    }
  }

  for (const troop of catalog.troops) {
    const name = troop.name.trim() ? formatEventLabel(troop.id, troop.name) : `敌群 ${troop.id}`;
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
export function collectTextLines(commands: EventCommand[]): string[] {
  const lines: string[] = [];
  for (const command of commands) {
    if (command.string) lines.push(command.string);
  }
  return lines;
}

/** 在页文本行中查找查询串（忽略大小写），同一行只取第一处匹配 */
export function searchPages(entries: SearchPageEntry[], query: string): SearchGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const groups: SearchGroup[] = [];
  for (const entry of entries) {
    const matches: SearchMatch[] = [];
    for (const text of entry.lines) {
      const index = text.toLowerCase().indexOf(needle);
      if (index === -1) continue;
      matches.push({ text, index, length: needle.length });
    }
    if (matches.length > 0) groups.push({ ...entry, matches });
  }
  return groups;
}

/** 截取匹配附近的一小段文本，用于侧栏单行展示（超出部分以省略号表示） */
export function buildMatchExcerpt(
  text: string,
  index: number,
  length: number,
  before = 10,
  after = 30,
): MatchExcerpt {
  const start = Math.max(0, index - before);
  const end = Math.min(text.length, index + length + after);
  return {
    before: `${start > 0 ? '…' : ''}${text.slice(start, index)}`,
    match: text.slice(index, index + length),
    after: `${text.slice(index + length, end)}${end < text.length ? '…' : ''}`,
  };
}
