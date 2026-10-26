import { Cmd } from './commandCodes';

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
  Cmd.ChangeClass,
  Cmd.ChangeBattleCommands,
  Cmd.ToggleAtbMode,
  Cmd.ToggleFullscreen,
  Cmd.OpenVideoOptions,
]);

/**
 * 只能出现在敌群（战斗）事件页里的指令。
 * 注：胜利 / 逃跑 / 失败 / 战斗结束这四个处理标记跟随「进入战斗」写在
 * 地图事件页里（RPG Maker 的战场事件内联在地图事件中），不属于此列。
 */
export const BATTLE_ONLY_COMMANDS: ReadonlySet<number> = new Set([
  Cmd.ForceFlee,
  Cmd.EnableCombo,
  Cmd.ChangeMonsterHP,
  Cmd.ChangeMonsterMP,
  Cmd.ChangeMonsterCondition,
  Cmd.ShowHiddenMonster,
  Cmd.ChangeBattleBG,
  Cmd.ShowBattleAnimationB,
  Cmd.ConditionalBranchB,
  Cmd.TerminateBattle,
  Cmd.ElseBranchB,
  Cmd.EndBranchB,
]);

/** EasyRPG Player 的扩展指令 */
export const EASYRPG_COMMANDS: ReadonlySet<number> = new Set([
  Cmd.EasyRpgTriggerEventAt,
  Cmd.EasyRpgPathfinder,
  Cmd.EasyRpgCallMovementAction,
  Cmd.EasyRpgWaitForSingleMovement,
  Cmd.EasyRpgAnimateVariable,
  Cmd.EasyRpgSetInterpreterFlag,
  Cmd.EasyRpgProcessJson,
  Cmd.EasyRpgCloneMapEvent,
  Cmd.EasyRpgDestroyMapEvent,
  Cmd.EasyRpgStringPictureMenu,
]);

/** Maniac Patch 的扩展指令（与 docs/raw_events_table.md 已收录的范围一致） */
export const MANIAC_COMMANDS: ReadonlySet<number> = new Set([
  Cmd.ManiacGetSaveInfo,
  Cmd.ManiacSave,
  Cmd.ManiacLoad,
  Cmd.ManiacEndLoadProcess,
  Cmd.ManiacGetMousePosition,
  Cmd.ManiacSetMousePosition,
  Cmd.ManiacShowStringPicture,
  Cmd.ManiacGetPictureInfo,
  Cmd.ManiacControlBattle,
  Cmd.ManiacControlAtbGauge,
  Cmd.ManiacChangeBattleCommandEx,
  Cmd.ManiacGetBattleInfo,
  Cmd.ManiacControlVarArray,
  Cmd.ManiacKeyInputProcEx,
  Cmd.ManiacRewriteMap,
  Cmd.ManiacControlGlobalSave,
  Cmd.ManiacChangePictureId,
  Cmd.ManiacSetGameOption,
  Cmd.ManiacCallCommand,
  Cmd.ManiacControlStrings,
  Cmd.ManiacGetGameInfo,
  Cmd.ManiacEditPicture,
  Cmd.ManiacWritePicture,
  Cmd.ManiacAddMoveRoute,
  Cmd.ManiacEditTile,
  Cmd.ManiacControlTextProcessing,
  Cmd.ManiacZoom,
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
