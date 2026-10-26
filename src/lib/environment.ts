/** 数据库引擎：2000 与 2003 的 LCF chunk 结构不同 */
export type Engine = '2k' | '2k3';

/** 运行环境：官方 RPG_RT，或常见的第三方实现 / 补丁 */
export type Runtime = 'rpg_rt' | 'easyrpg' | 'maniac';

export const ENGINE_LABELS: Record<Engine, string> = {
  '2k': 'RPG Maker 2000',
  '2k3': 'RPG Maker 2003',
};

export const RUNTIME_LABELS: Record<Runtime, string> = {
  rpg_rt: 'RPG_RT',
  easyrpg: 'EasyRPG Player',
  maniac: 'Maniac Patch',
};

export function isEngine(value: unknown): value is Engine {
  return value === '2k' || value === '2k3';
}

export function isRuntime(value: unknown): value is Runtime {
  return value === 'rpg_rt' || value === 'easyrpg' || value === 'maniac';
}

/**
 * 仅 2003 才有的指令：职业 / 战斗指令系统，以及 2k3 的 ATB、全屏与视频选项。
 * 注：战斗事件相关指令（更改敌人 HP、战斗条件分支等）在 2000 的敌群事件里同样可用；
 * 打开读档界面 / 退出游戏属于 2k 内部指令，2k3 才公开。
 */
export const RPG2003_ONLY_COMMANDS: ReadonlySet<number> = new Set([
  1008, 1009, 5003, 5004, 5005,
]);

/**
 * 只能出现在敌群（战斗）事件页里的指令。
 * 注：胜利 / 逃跑 / 失败 / 战斗结束这四个处理标记跟随「进入战斗」写在
 * 地图事件页里（RPG Maker 的战场事件内联在地图事件中），不属于此列。
 */
export const BATTLE_ONLY_COMMANDS: ReadonlySet<number> = new Set([
  1006, 1007, 13110, 13120, 13130, 13150, 13210, 13260, 13310, 13410, 23310, 23311,
]);

/** EasyRPG Player 的扩展指令 */
export const EASYRPG_COMMANDS: ReadonlySet<number> = new Set([
  2002, 2003, 2050, 2051, 2052, 2053, 2055, 2056, 2057, 2058,
]);

/** Maniac Patch 的扩展指令（与 docs/raw_events_table.md 已收录的范围一致） */
export const MANIAC_COMMANDS: ReadonlySet<number> = new Set([
  3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3015, 3016,
  3017, 3018, 3019, 3020, 3021, 3025, 3026, 3027, 3028, 3029, 3032,
]);

/**
 * 扫描工程内出现过的指令码，推断第三方运行环境。
 * Maniac 的指令更特殊，出现即优先；否则有 EasyRPG 指令即为 EasyRPG，再否则为官方 RPG_RT。
 */
export function detectRuntime(codes: Iterable<number>): Runtime {
  let hasEasyRpg = false;

  for (const code of codes) {
    if (MANIAC_COMMANDS.has(code)) return 'maniac';
    if (EASYRPG_COMMANDS.has(code)) hasEasyRpg = true;
  }

  return hasEasyRpg ? 'easyrpg' : 'rpg_rt';
}
