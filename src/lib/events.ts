/**
 * 事件模型抽象。
 *
 * RPG Maker 的事件分布在三个地方：公共事件、地图事件、敌群（战斗事件）。
 * 这里把它们统一成同一套结构：
 *
 *   事件页（EventPage）       —— 一个可独立编辑的「代码文件」
 *   事件对象（EventObject）   —— 一个或多个事件页的宿主
 *   事件包（EventPackage）    —— 决定事件生命周期与可见性的「目录」（目前只有地图）
 *
 * 公共事件没有上级结构，统一抽象为「固定只有一页的事件对象」。
 * 敌群本身就是事件对象（它的战斗事件就是事件页）。
 */

export type EventCategory = 'common' | 'map' | 'troop';

/** 事件页的稳定地址，用于选中、标签页、diff 定位 */
export type EventPageRef =
  | { category: 'common'; commonEventId: number; pageIndex: number }
  | { category: 'map'; mapId: number; eventId: number; pageIndex: number }
  | { category: 'troop'; troopId: number; pageIndex: number };

export interface EventPage {
  ref: EventPageRef;
  /** 展示序号，从 1 开始 */
  index: number;
  /** 预留：触发器描述，等接入 LCF 后填充 */
  trigger: string | null;
}

export interface EventObject {
  category: EventCategory;
  /** 公共事件 ID / 地图事件 ID / 敌群 ID */
  id: number;
  name: string;
  /** 事件页；公共事件固定为 1 页 */
  pages: EventPage[];
  /** 预留：贴图等事件对象级信息 */
  meta?: Record<string, string>;
}

/** 事件包：目前只有地图，未来可扩展到其它「目录」 */
export interface EventPackage {
  id: number;
  name: string;
  events: EventObject[];
}

export interface EventCatalog {
  commonEvents: EventObject[];
  maps: EventPackage[];
  troops: EventObject[];
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  common: '公共事件',
  map: '地图事件',
  troop: '敌群事件',
};

export function emptyCatalog(): EventCatalog {
  return { commonEvents: [], maps: [], troops: [] };
}

export function pageKey(ref: EventPageRef): string {
  switch (ref.category) {
    case 'common':
      return `common/${ref.commonEventId}/page/${ref.pageIndex}`;
    case 'map':
      return `map/${ref.mapId}/event/${ref.eventId}/page/${ref.pageIndex}`;
    case 'troop':
      return `troop/${ref.troopId}/page/${ref.pageIndex}`;
  }
}

export function countEventPages(catalog: EventCatalog): number {
  const count = (events: EventObject[]) =>
    events.reduce((sum, event) => sum + event.pages.length, 0);
  return (
    count(catalog.commonEvents) +
    catalog.maps.reduce((sum, map) => sum + count(map.events), 0) +
    count(catalog.troops)
  );
}

export function isCatalogEmpty(catalog: EventCatalog): boolean {
  return (
    catalog.commonEvents.length === 0 && catalog.maps.length === 0 && catalog.troops.length === 0
  );
}

/** 四位地图编号，与 RM 的 Map0001 命名一致 */
export function formatMapLabel(id: number, name: string): string {
  const label = `Map${String(id).padStart(4, '0')}`;
  const trimmed = name.trim();
  if (!trimmed) return label;
  // 作者没改过名时地图树里存的就是 MAP0002 这类名字，避免重复显示
  if (/^map\s*\d+$/i.test(trimmed) && Number(trimmed.replace(/\D/g, '')) === id) return label;
  return `${label} ${trimmed}`;
}

/** 三位序号，用于公共事件 / 敌群 / 地图事件 */
export function formatEventLabel(id: number, name: string): string {
  return `${String(id).padStart(3, '0')}${name ? ` ${name}` : ''}`;
}

/**
 * 地图事件：RPG Maker 新建事件时会把名字写成 EV0001 这类默认名，
 * 与自己的默认名相同就只显示编号，避免「EV0001 EV0001」。
 */
export function formatMapEventLabel(id: number, name: string): string {
  const label = `EV${String(id).padStart(4, '0')}`;
  const trimmed = name.trim();
  if (!trimmed || trimmed.toUpperCase() === label) return label;
  return `${label} ${trimmed}`;
}
