import {
  BATTLE_ONLY_COMMANDS,
  EASYRPG_COMMANDS,
  MANIAC_COMMANDS,
  RPG2003_ONLY_COMMANDS,
  type Engine,
  type Runtime,
} from './environment';
import { Cmd } from './commandCodes';
import { findCommandMeta, type CommandLine } from './eventCommands';
import type { EventPageRef } from './events';

/**
 * 事件指令参数的统一建模。
 *
 * 数据库里的对象类型有限，指令参数只有两类：
 *   1. 基本值：整数、布尔、时间、配置枚举、文本字面量；
 *   2. 引用：用 id 指向数据库对象（开关 / 变量 / 角色 / 道具 / 公共事件……）。
 * 指令里的「常量或变量」寻址，则用 valueOrVariable 表示：值本身由数字或变量间接提供。
 */
export type DbRefKind =
  | 'switch'
  | 'variable'
  | 'actor'
  | 'item'
  | 'skill'
  | 'enemy'
  | 'troop'
  | 'commonEvent'
  | 'class'
  | 'map'
  | 'event';

/**
 * 角色 / 事件引用的特殊 id（与 RPG_RT 的 Game_Character 常量一致）。
 * 它们不是数据库里的对象 id，而是解释器的「魔法数」，固定指向玩家、载具或事件自身。
 */
export const CHARACTER_MAGIC_IDS = {
  player: 10001,
  boat: 10002,
  ship: 10003,
  airship: 10004,
  /** 事件自身 */
  thisEvent: 10005,
} as const;

export type ParamSpec =
  /** 基本整数，可限定取值范围 */
  | { kind: 'int'; min?: number; max?: number; label?: string }
  /** 布尔：0 / 1 */
  | { kind: 'bool'; label?: string }
  /** 时间，单位为 1/10 秒（RPG_RT 内部按帧换算） */
  | { kind: 'time'; label?: string }
  /** 配置枚举：取值必须落在给定集合内 */
  | { kind: 'enum'; options: Readonly<Record<number, string>>; label?: string }
  /** 文本字面量：存放于指令的 string 字段 */
  | { kind: 'text'; label?: string }
  /** 数据库对象引用，id 从 1 开始；magic 中的特殊值同样有效 */
  | {
      kind: 'ref';
      target: DbRefKind;
      label?: string;
      magic?: Readonly<Record<number, string>>;
    }
  /** 「常量或变量」：实际取值由同组内的模式参数决定 */
  | { kind: 'valueOrVariable'; label?: string }
  /** 尚未建模，不做取值校验 */
  | { kind: 'any'; label?: string };

/** 参数语义可能依赖同组其它参数（如「寻址模式」决定后面是 id 还是变量号） */
export type ParamCondition = (params: readonly number[]) => boolean;

export interface ParamSlot {
  spec: ParamSpec;
  /** 仅在条件成立时才校验该位置 */
  when?: ParamCondition;
}

export interface CommandSpec {
  code: number;
  /** 最少参数个数（取自 EasyRPG Player 的 CmdSetup 声明） */
  minParams: number;
  /** 已建模的参数，按位置排列；未列出的尾随参数不校验 */
  params?: ParamSlot[];
  /** 指令文本存于 string 字段 */
  usesText?: boolean;
}

const any = { kind: 'any' } as const;
const text = { kind: 'text', label: '文本' } as const;
const time = { kind: 'time', label: '时长' } as const;
const int = (min?: number, max?: number, label?: string): ParamSpec => ({ kind: 'int', min, max, label });
const ref = (
  target: DbRefKind,
  label?: string,
  magic?: Readonly<Record<number, string>>,
): ParamSpec => ({ kind: 'ref', target, label, magic });
const enumOf = (options: Record<number, string>, label?: string): ParamSpec => ({
  kind: 'enum',
  options,
  label,
});
/** 带条件的参数位置 */
const when =
  (spec: ParamSpec, condition: ParamCondition): ParamSlot => ({ spec, when: condition });
const slot = (spec: ParamSpec): ParamSlot => ({ spec });

/** 只写最少参数个数；参数语义随后逐步补齐 */
const MIN_PARAMS: Record<number, number> = {
  [Cmd.CallCommonEvent]: 1,
  [Cmd.ShowMessage]: 0,
  [Cmd.MessageOptions]: 4,
  [Cmd.ChangeFaceGraphic]: 3,
  [Cmd.ShowChoice]: 1,
  [Cmd.InputNumber]: 2,
  [Cmd.ControlSwitches]: 4,
  [Cmd.ControlVars]: 7,
  [Cmd.TimerOperation]: 5,
  [Cmd.ChangeGold]: 3,
  [Cmd.ChangeItems]: 5,
  [Cmd.ChangePartyMembers]: 3,
  [Cmd.ChangeExp]: 6,
  [Cmd.ChangeLevel]: 6,
  [Cmd.ChangeParameters]: 6,
  [Cmd.ChangeSkills]: 5,
  [Cmd.ChangeEquipment]: 5,
  [Cmd.ChangeHP]: 6,
  [Cmd.ChangeSP]: 5,
  [Cmd.ChangeCondition]: 4,
  [Cmd.FullHeal]: 2,
  [Cmd.SimulatedAttack]: 8,
  [Cmd.ChangeHeroName]: 1,
  [Cmd.ChangeHeroTitle]: 1,
  [Cmd.ChangeSpriteAssociation]: 3,
  [Cmd.ChangeActorFace]: 2,
  [Cmd.ChangeVehicleGraphic]: 2,
  [Cmd.ChangeSystemBGM]: 5,
  [Cmd.ChangeSystemSFX]: 4,
  [Cmd.ChangeSystemGraphics]: 2,
  [Cmd.ChangeScreenTransitions]: 2,
  [Cmd.EnemyEncounter]: 6,
  [Cmd.OpenShop]: 4,
  [Cmd.ShowInn]: 3,
  [Cmd.EnterHeroName]: 3,
  [Cmd.Teleport]: 3,
  [Cmd.MemorizeLocation]: 3,
  [Cmd.RecallToLocation]: 3,
  [Cmd.EnterExitVehicle]: 0,
  [Cmd.SetVehicleLocation]: 5,
  [Cmd.ChangeEventLocation]: 4,
  [Cmd.TradeEventLocations]: 2,
  [Cmd.StoreTerrainID]: 4,
  [Cmd.StoreEventID]: 4,
  [Cmd.EraseScreen]: 1,
  [Cmd.ShowScreen]: 1,
  [Cmd.TintScreen]: 6,
  [Cmd.FlashScreen]: 6,
  [Cmd.ShakeScreen]: 4,
  [Cmd.PanScreen]: 5,
  [Cmd.WeatherEffects]: 2,
  [Cmd.ShowPicture]: 14,
  [Cmd.MovePicture]: 16,
  [Cmd.ErasePicture]: 1,
  [Cmd.ShowBattleAnimation]: 3,
  [Cmd.PlayerVisibility]: 1,
  [Cmd.FlashSprite]: 7,
  [Cmd.MoveEvent]: 4,
  [Cmd.ProceedWithMovement]: 0,
  [Cmd.HaltAllMovement]: 0,
  [Cmd.Wait]: 1,
  [Cmd.PlayBGM]: 4,
  [Cmd.FadeOutBGM]: 1,
  [Cmd.MemorizeBGM]: 0,
  [Cmd.PlayMemorizedBGM]: 0,
  [Cmd.PlaySound]: 3,
  [Cmd.PlayMovie]: 5,
  [Cmd.KeyInputProc]: 5,
  [Cmd.ChangeMapTileset]: 1,
  [Cmd.ChangePBG]: 6,
  [Cmd.ChangeEncounterSteps]: 1,
  [Cmd.TileSubstitution]: 3,
  [Cmd.TeleportTargets]: 6,
  [Cmd.ChangeTeleportAccess]: 1,
  [Cmd.EscapeTarget]: 5,
  [Cmd.ChangeEscapeAccess]: 1,
  [Cmd.OpenSaveMenu]: 0,
  [Cmd.ChangeSaveAccess]: 1,
  [Cmd.OpenMainMenu]: 0,
  [Cmd.ChangeMainMenuAccess]: 1,
  [Cmd.ConditionalBranch]: 6,
  [Cmd.Label]: 0,
  [Cmd.JumpToLabel]: 1,
  [Cmd.Loop]: 0,
  [Cmd.BreakLoop]: 0,
  [Cmd.EndEventProcessing]: 0,
  [Cmd.EraseEvent]: 0,
  [Cmd.CallEvent]: 3,
  [Cmd.Comment]: 0,
  [Cmd.GameOver]: 0,
  [Cmd.ReturntoTitleScreen]: 0,
  // 2k3
  [Cmd.ForceFlee]: 3,
  [Cmd.EnableCombo]: 3,
  [Cmd.ChangeClass]: 7,
  [Cmd.ChangeBattleCommands]: 4,
  [Cmd.OpenLoadMenu]: 0,
  [Cmd.ExitGame]: 0,
  [Cmd.ToggleAtbMode]: 0,
  [Cmd.ToggleFullscreen]: 0,
  [Cmd.OpenVideoOptions]: 0,
  [Cmd.ChangeMonsterHP]: 5,
  [Cmd.ChangeMonsterMP]: 4,
  [Cmd.ChangeMonsterCondition]: 3,
  [Cmd.ShowHiddenMonster]: 1,
  [Cmd.ChangeBattleBG]: 0,
  [Cmd.ShowBattleAnimationB]: 3,
  [Cmd.ConditionalBranchB]: 5,
  [Cmd.TerminateBattle]: 0,
  // 结构标记
  [Cmd.ShowMessage2]: 0,
  [Cmd.ShowChoiceOption]: 1,
  [Cmd.ShowChoiceEnd]: 0,
  [Cmd.ElseBranch]: 0,
  [Cmd.EndBranch]: 0,
  [Cmd.EndLoop]: 0,
  [Cmd.Comment2]: 0,
  [Cmd.ElseBranchB]: 0,
  [Cmd.EndBranchB]: 0,
  [Cmd.VictoryHandler]: 0,
  [Cmd.EscapeHandler]: 0,
  [Cmd.DefeatHandler]: 0,
  [Cmd.EndBattle]: 0,
  [Cmd.Transaction]: 0,
  [Cmd.NoTransaction]: 0,
  [Cmd.EndShop]: 0,
  [Cmd.Stay]: 0,
  [Cmd.NoStay]: 0,
  [Cmd.EndInn]: 0,
  [Cmd.End]: 0,
  // EasyRPG
  [Cmd.EasyRpgTriggerEventAt]: 4,
  [Cmd.EasyRpgPathfinder]: 13,
  [Cmd.EasyRpgWaitForSingleMovement]: 6,
  [Cmd.EasyRpgSetInterpreterFlag]: 2,
  [Cmd.EasyRpgProcessJson]: 8,
  [Cmd.EasyRpgCloneMapEvent]: 10,
  [Cmd.EasyRpgDestroyMapEvent]: 2,
  // Maniac：EasyRPG 的 CmdSetup 对应的是特定 Maniac 版本，
  // 实测老工程里的参数个数会少一些（ManiacShowStringPicture 21、ManiacControlGlobalSave 1），
  // 因此不校验个数
};

/** 已建模参数语义的指令（其余指令的取值暂不校验） */
const PARAMS: Record<number, ParamSlot[]> = {
  // 消息与注释的正文都是文本字面量
  [Cmd.ShowMessage]: [slot(text)],
  [Cmd.ShowMessage2]: [slot(text)],
  [Cmd.Comment]: [slot(text)],
  [Cmd.Comment2]: [slot(text)],
  // 标签名同样是文本字面量
  [Cmd.Label]: [slot(text)],
  // 等待：参数 2 非 0 时优先，表示等待玩家输入
  [Cmd.Wait]: [slot(time), slot({ kind: 'bool', label: '等待输入' })],
  // 显示选项：参数为取消选项的处理方式（0 表示禁止取消）
  [Cmd.ShowChoice]: [slot(int(0, undefined, '取消选项'))],
  // 输入数字：位数 + 结果变量
  [Cmd.InputNumber]: [slot(int(1, undefined, '位数')), slot(ref('variable', '变量'))],
  // 控制开关：寻址模式 + 起止 id + 操作
  //   模式 0/1（单个 / 范围）时参数 2、3 是开关 id；
  //   模式 2 起是变量寻址，此时参数 3 未使用（常见为 0）
  [Cmd.ControlSwitches]: [
    slot(enumOf({ 0: '单个', 1: '范围', 2: '变量', 3: '变量范围', 4: '表达式' }, '寻址')),
    when(ref('switch', '开关'), (params) => params[0] === 0 || params[0] === 1),
    when(ref('switch', '开关'), (params) => params[0] === 1),
    slot(enumOf({ 0: '关', 1: '开', 2: '切换' }, '操作')),
  ],
  // 更改金钱：[操作, 数值来源, 数值]
  [Cmd.ChangeGold]: [
    slot(enumOf({ 0: '增加', 1: '减少' }, '操作')),
    slot(any),
    slot({ kind: 'valueOrVariable', label: '数值' }),
  ],
  // 调用事件：目标类型决定 id 的含义
  //   直接调用地图事件时，id 可以是本事件（魔法数 10005）
  [Cmd.CallEvent]: [
    slot(enumOf({ 0: '公共事件', 1: '地图事件', 2: '间接', 3: '变量', 4: '间接变量' }, '目标')),
    when(ref('event', '事件', CHARACTER_MAGIC_IDS), (params) => params[0] === 1),
    slot(any),
  ],
  // 调用公共事件
  [Cmd.CallCommonEvent]: [slot(ref('commonEvent', '公共事件'))],
};

export const COMMAND_SPECS: ReadonlyMap<number, CommandSpec> = new Map(
  Object.entries(MIN_PARAMS).map(([code, minParams]) => {
    const id = Number(code);
    const params = PARAMS[id];
    return [
      id,
      {
        code: id,
        minParams,
        params,
        usesText: params?.some((item) => item.spec.kind === 'text') ?? false,
      } satisfies CommandSpec,
    ];
  }),
);

export interface CommandEnvironment {
  engine: Engine;
  runtime: Runtime;
  /** 当前事件页所在的分类：战斗指令只能出现在敌群事件里 */
  scope?: EventPageRef['category'];
  /** 数据库对象是否存在（未提供的类型只检查 id 是否为正） */
  lookup?: Partial<Record<DbRefKind, (id: number) => boolean>>;
}

export interface Diagnostic {
  /** 指令在事件页指令数组中的下标 */
  index: number;
  severity: 'error' | 'warning';
  message: string;
}

/** 校验单条指令：指令集归属 + 参数个数 + 参数取值 */
export function validateCommand(line: CommandLine, env: CommandEnvironment): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const push = (severity: Diagnostic['severity'], message: string) =>
    diagnostics.push({ index: line.index, severity, message });

  if (!findCommandMeta(line.code)) {
    push('error', `未知指令 ${line.code}，可能来自未识别的事件指令扩展`);
    return diagnostics;
  }

  if (RPG2003_ONLY_COMMANDS.has(line.code) && env.engine === '2k') {
    push('error', '该指令只在 RPG Maker 2003 中可用');
  }
  if (EASYRPG_COMMANDS.has(line.code) && env.runtime === 'rpg_rt') {
    push('error', '该指令需要 EasyRPG Player 或 Maniac Patch');
  }
  if (MANIAC_COMMANDS.has(line.code) && env.runtime !== 'maniac') {
    push('error', '该指令需要 Maniac Patch');
  }
  if (BATTLE_ONLY_COMMANDS.has(line.code) && env.scope && env.scope !== 'troop') {
    push('error', '该指令只能在敌群（战斗）事件中使用');
  }

  const spec = COMMAND_SPECS.get(line.code);
  if (!spec) return diagnostics;

  const params = line.params;
  if (params.length < spec.minParams) {
    push('error', `参数不足：需要 ${spec.minParams} 个，实际 ${params.length} 个`);
  }

  for (const [position, item] of (spec.params ?? []).entries()) {
    const value = params[position];
    if (value === undefined) break;
    if (item.when && !item.when(params)) continue;

    const message = checkParam(item.spec, value, env);
    if (message) push('error', `参数 ${position + 1}：${message}`);
  }

  return diagnostics;
}

function checkParam(param: ParamSpec, value: number, env: CommandEnvironment): string | null {
  switch (param.kind) {
    case 'int':
      if (!Number.isInteger(value)) return '必须是整数';
      if (param.min !== undefined && value < param.min) return `不能小于 ${param.min}`;
      if (param.max !== undefined && value > param.max) return `不能大于 ${param.max}`;
      return null;

    case 'time':
      if (!Number.isInteger(value)) return '必须是整数';
      if (value < 0) return '不能为负数';
      return null;

    case 'bool':
      if (value !== 0 && value !== 1) return '只能是 0 或 1';
      return null;

    case 'enum':
      return value in param.options ? null : `取值 ${value} 不在允许范围内`;

    case 'ref': {
      // 10001 起是解释器的魔法数（玩家 / 载具 / 事件自身），不是数据库 id
      if (param.magic && value in param.magic) return null;
      if (!Number.isInteger(value) || value < 1) return 'id 必须是从 1 开始的整数';
      const lookup = env.lookup?.[param.target];
      if (lookup && !lookup(value)) return `引用的对象 ${value} 不存在`;
      return null;
    }

    case 'valueOrVariable':
    case 'text':
    case 'any':
      return null;
  }
}

/** 校验整页；返回的每条诊断都带有对应的指令下标 */
export function validateEventPage(
  lines: CommandLine[],
  env: CommandEnvironment,
): Diagnostic[] {
  return lines.flatMap((line) => validateCommand(line, env));
}
