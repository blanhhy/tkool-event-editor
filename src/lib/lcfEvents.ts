import type { Database, Event as RpgEvent, EventCommand, MapUnit } from 'rpgrt';
import type { EventCatalog, EventObject, EventPageRef } from './events';
import { iteratorOf } from './fs';
import { iconvNameFor, type Encoding } from './project';

export interface EventLoadProgress {
  done: number;
  total: number;
}

export interface EventLoadOptions {
  /** 结构性更新（先给出完整目录骨架，再逐步填充地图事件） */
  onUpdate?: (catalog: EventCatalog) => void;
  onProgress?: (progress: EventLoadProgress) => void;
  isCancelled?: () => boolean;
}

const MAP_FILE = /^Map(\d+)\.lmu$/i;
/** 已解码地图的缓存上限，避免翻阅多张地图后内存持续增长 */
const MAP_CACHE_LIMIT = 12;

type RpgrtCodec = typeof import('rpgrt');
type RpgrtEncoding = typeof import('rpgrt/encoding');
type Transcoder = ReturnType<RpgrtEncoding['createTranscoder']>;

let rpgrtModules: { codec: RpgrtCodec; encoding: RpgrtEncoding } | null = null;

async function getRpgrt(): Promise<{ codec: RpgrtCodec; encoding: RpgrtEncoding }> {
  if (rpgrtModules) return rpgrtModules;

  // iconv-lite（rpgrt 的编码层）在浏览器里需要 Buffer polyfill，必须在加载它之前注入
  const { Buffer: BufferPolyfill } = await import('buffer');
  const globalScope = globalThis as unknown as { Buffer?: unknown };
  globalScope.Buffer ??= BufferPolyfill;

  const [codec, encoding] = await Promise.all([import('rpgrt'), import('rpgrt/encoding')]);
  rpgrtModules = { codec, encoding };
  return rpgrtModules;
}

function buildTranscoder(encodingModule: RpgrtEncoding, encoding: Encoding): Transcoder | undefined {
  try {
    return encodingModule.createTranscoder(iconvNameFor(encoding));
  } catch {
    // 编码不可用时退回 rpgrt 的无损字节映射，至少保证事件结构可读
    return undefined;
  }
}

/** 引擎判定：2000 与 2003 的 chunk 结构不同，先按 2k 探测 */
function decodeDatabaseWithEngine(
  codec: RpgrtCodec,
  bytes: Uint8Array,
  transcoder: Transcoder | undefined,
): { engine: '2k' | '2k3'; db: Database } {
  let engine: '2k' | '2k3' = '2k';
  let db: Database;

  try {
    db = codec.decodeDatabase(bytes, { engine, transcoder });
    if (db.system?.ldbId === 2003 || (db.classes?.length ?? 0) > 0) {
      engine = '2k3';
      db = codec.decodeDatabase(bytes, { engine, transcoder });
    }
  } catch {
    engine = '2k3';
    db = codec.decodeDatabase(bytes, { engine, transcoder });
  }

  return { engine, db };
}

async function readBytes(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<Uint8Array | null> {
  try {
    const handle = await root.getFileHandle(name);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

function toMapEvents(mapId: number, events: RpgEvent[]): EventObject[] {
  return events.map((event, eventIndex) => {
    // 地图事件的 ID 并不保证连续（存在空洞），缺失时才退回数组序号
    const eventId = event.id > 0 ? event.id : eventIndex + 1;
    return {
      category: 'map',
      id: eventId,
      name: event.name ?? '',
      pages: (event.pages ?? []).map((_, index) => ({
        ref: { category: 'map', mapId, eventId, pageIndex: index },
        index: index + 1,
        trigger: null,
      })),
    };
  });
}

/**
 * 读取工程的事件导航树：
 * 公共事件 / 敌群来自 RPG_RT.ldb，地图与地图顺序来自 RPG_RT.lmt，
 * 地图内的事件来自各 Map####.lmu（只保留事件与页数，不保留指令内容）。
 *
 * 先通过 onUpdate 给出不含地图事件的骨架，再逐张地图填充并回调进度。
 */
export async function loadEventCatalog(
  root: FileSystemDirectoryHandle,
  encoding: Encoding,
  options: EventLoadOptions = {},
): Promise<EventCatalog> {
  const { codec, encoding: encodingModule } = await getRpgrt();
  const transcoder = buildTranscoder(encodingModule, encoding);

  const ldbBytes = await readBytes(root, 'RPG_RT.ldb');
  if (!ldbBytes) throw new Error('缺少 RPG_RT.ldb，无法读取事件');

  const { engine, db } = decodeDatabaseWithEngine(codec, ldbBytes, transcoder);

  // 地图列表与顺序：优先用地图树，缺失时按文件编号
  const mapInfoById = new Map<number, { name: string }>();
  let treeOrder: number[] = [];
  const lmtBytes = await readBytes(root, 'RPG_RT.lmt');
  if (lmtBytes) {
    try {
      const treeMap = codec.decodeTreeMap(lmtBytes, { engine, transcoder });
      for (const info of treeMap.maps ?? []) mapInfoById.set(info.id, { name: info.name });
      treeOrder = treeMap.treeOrder ?? [];
    } catch {
      // 地图树损坏时退回按编号排序
    }
  }

  const mapFiles: { id: number; fileName: string }[] = [];
  const seenMapIds = new Set<number>();
  for await (const [name, handle] of iteratorOf(root)) {
    if (handle.kind !== 'file') continue;
    const match = MAP_FILE.exec(name);
    if (!match) continue;
    const id = Number(match[1]);
    // 同一 ID 出现多个文件时只认第一个，避免重复节点
    if (seenMapIds.has(id)) continue;
    seenMapIds.add(id);
    mapFiles.push({ id, fileName: name });
  }

  const orderIndex = new Map(treeOrder.map((id, index) => [id, index]));
  mapFiles.sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.id - right.id;
  });

  const catalog: EventCatalog = {
    commonEvents: (db.commonevents ?? []).map((event, eventIndex): EventObject => {
      const eventId = event.id > 0 ? event.id : eventIndex + 1;
      return {
        category: 'common',
        id: eventId,
        name: event.name ?? '',
        // 公共事件在 LCF 里没有「页」的概念，统一抽象为固定单页
        pages: [
          {
            ref: { category: 'common', commonEventId: eventId, pageIndex: 0 },
            index: 1,
            trigger: null,
          },
        ],
      };
    }),
    troops: (db.troops ?? []).map((troop, troopIndex): EventObject => {
      const troopId = troop.id > 0 ? troop.id : troopIndex + 1;
      return {
        category: 'troop',
        id: troopId,
        name: troop.name ?? '',
        pages: (troop.pages ?? []).map((_, index) => ({
          ref: { category: 'troop', troopId, pageIndex: index },
          index: index + 1,
          trigger: null,
        })),
      };
    }),
    maps: mapFiles.map((file) => ({
      id: file.id,
      name: mapInfoById.get(file.id)?.name ?? '',
      events: [],
    })),
  };

  options.onUpdate?.(catalog);

  // 逐张地图填充事件；让出主线程，避免大工程卡住界面
  const mapById = new Map(catalog.maps.map((map) => [map.id, map]));
  const total = mapFiles.length;
  let done = 0;

  for (const file of mapFiles) {
    if (options.isCancelled?.()) break;

    const bytes = await readBytes(root, file.fileName);
    if (bytes) {
      try {
        const unit = codec.decodeMapUnit(bytes, { engine, transcoder });
        const target = mapById.get(file.id);
        if (target) target.events = toMapEvents(file.id, unit.events);
      } catch {
        // 单张地图解析失败不影响其余地图
      }
    }

    done += 1;
    options.onProgress?.({ done, total });

    if (done % 8 === 0) {
      options.onUpdate?.({ ...catalog, maps: [...catalog.maps] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  options.onUpdate?.({ ...catalog, maps: [...catalog.maps] });
  return catalog;
}

interface EventSession {
  root: FileSystemDirectoryHandle;
  encoding: Encoding;
  engine: '2k' | '2k3' | null;
  db: Database | null;
  maps: Map<number, MapUnit>;
  /** 地图 ID → 实际文件名（编号可能不是四位，也可能不连续） */
  mapFiles: Map<number, string> | null;
}

let session: EventSession | null = null;

function getSession(root: FileSystemDirectoryHandle, encoding: Encoding): EventSession {
  if (!session || session.root !== root || session.encoding !== encoding) {
    session = { root, encoding, engine: null, db: null, maps: new Map(), mapFiles: null };
  }
  return session;
}

async function ensureDatabase(
  state: EventSession,
  codec: RpgrtCodec,
  transcoder: Transcoder | undefined,
): Promise<Database> {
  if (state.db) return state.db;

  const bytes = await readBytes(state.root, 'RPG_RT.ldb');
  if (!bytes) throw new Error('缺少 RPG_RT.ldb，无法读取事件');

  const { engine, db } = decodeDatabaseWithEngine(codec, bytes, transcoder);
  state.engine = engine;
  state.db = db;
  return db;
}

async function ensureMapUnit(
  state: EventSession,
  codec: RpgrtCodec,
  transcoder: Transcoder | undefined,
  mapId: number,
): Promise<MapUnit> {
  const cached = state.maps.get(mapId);
  if (cached) return cached;

  if (!state.mapFiles) {
    const files = new Map<number, string>();
    for await (const [name, handle] of iteratorOf(state.root)) {
      if (handle.kind !== 'file') continue;
      const match = MAP_FILE.exec(name);
      if (!match) continue;
      const id = Number(match[1]);
      if (!files.has(id)) files.set(id, name);
    }
    state.mapFiles = files;
  }

  const fileName = state.mapFiles.get(mapId);
  if (!fileName) throw new Error(`找不到地图文件（ID ${mapId}）`);

  const bytes = await readBytes(state.root, fileName);
  if (!bytes) throw new Error(`无法读取 ${fileName}`);

  // 地图解码依赖引擎版本
  if (!state.engine) await ensureDatabase(state, codec, transcoder);

  const unit = codec.decodeMapUnit(bytes, { engine: state.engine ?? '2k', transcoder });

  if (state.maps.size >= MAP_CACHE_LIMIT) {
    const oldest = state.maps.keys().next().value;
    if (oldest !== undefined) state.maps.delete(oldest);
  }
  state.maps.set(mapId, unit);
  return unit;
}

/**
 * 按需读取某个事件页的原始指令。
 * 公共事件 / 敌群来自 LDB，地图事件按需读取对应的 LMU（带缓存）。
 */
export async function loadEventPageCommands(
  root: FileSystemDirectoryHandle,
  encoding: Encoding,
  ref: EventPageRef,
): Promise<EventCommand[]> {
  const { codec, encoding: encodingModule } = await getRpgrt();
  const state = getSession(root, encoding);
  const transcoder = buildTranscoder(encodingModule, encoding);

  const db = await ensureDatabase(state, codec, transcoder);

  if (ref.category === 'common') {
    const event = (db.commonevents ?? []).find((item) => item.id === ref.commonEventId);
    return event?.eventCommands ?? [];
  }

  if (ref.category === 'troop') {
    const troop = (db.troops ?? []).find((item) => item.id === ref.troopId);
    return troop?.pages?.[ref.pageIndex]?.eventCommands ?? [];
  }

  const unit = await ensureMapUnit(state, codec, transcoder, ref.mapId);
  const event = (unit.events ?? []).find((item) => item.id === ref.eventId);
  return event?.pages?.[ref.pageIndex]?.eventCommands ?? [];
}
