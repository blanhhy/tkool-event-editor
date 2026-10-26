import {
  BATTLE_ONLY_COMMANDS,
  EASYRPG_COMMANDS,
  MANIAC_COMMANDS,
  RPG2003_ONLY_COMMANDS,
  type Engine,
  type Runtime,
} from './environment';
import { Cmd } from './commandCodes';
import { COMMAND_SCHEMA, type SchemaCommand, type SchemaParamSlot } from './commandSchema.generated';
import { findCommandMeta, type CommandLine } from './eventCommands';
import type { EventPageRef } from './events';

/**
 * 事件指令参数的统一建模。
 *
 * 数据库里的对象类型有限，指令参数只有两类：
 *   1. 基本值：整数、布尔、时间、配置枚举、文本字面量；
 *   2. 引用：用 id 指向数据库对象（开关 / 变量 / 角色 / 道具 / 公共事件……）。
 * 指令里的「常量或变量」寻址，则用 valueOrVariable 表示。
 *
 * 参数语义以 R48 的 schema 为准（见 commandSchema.generated.ts），
 * 本文件只补充 R48 未覆盖的扩展指令与少量特例。
 */
export type DbRefKind =
  | 'switch'
  | 'variable'
  | 'actor'
  | 'item'
  | 'skill'
  | 'state'
  | 'enemy'
  | 'troop'
  | 'commonEvent'
  | 'class'
  | 'battleCommand'
  | 'tileset'
  | 'terrain'
  | 'animation'
  | 'attribute'
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
      /** 0 也是合法值（如变量 id 的「未使用」） */
      allowZero?: boolean;
    }
  /** 「常量或变量」：实际取值由同组内的模式参数决定 */
  | { kind: 'valueOrVariable'; label?: string }
  /** 尚未建模，不做取值校验 */
  | { kind: 'any'; label?: string };

const time = { kind: 'time', label: '时长' } as const;
const bool = { kind: 'bool' } as const;

/** 单条参数的语义；`whenIndex`/`whenEquals` 表示仅在另一参数取特定值时才生效 */
export interface ParamSlot {
  position: number;
  name?: string;
  spec: ParamSpec;
  whenIndex?: number;
  whenEquals?: number[];
  /** 该参数只在指定引擎里存在（2003 新增的参数） */
  since?: Engine;
}

interface CommandSpec {
  /** 最少参数个数，按引擎区分；null 表示未知（跳过个数校验） */
  minParams: Record<Engine, number> | null;
  params: ParamSlot[];
}

const slot = (position: number, spec: ParamSpec, name?: string): ParamSlot => ({ position, spec, name });
/** 两个引擎都用同一个参数个数 */
const same = (count: number): Record<Engine, number> => ({ '2k': count, '2k3': count });

/**
 * R48 未覆盖的指令：
 *   - EasyRPG / Maniac 的扩展指令；
 *   - 参数结构写在 X-code 里、且无法从 schema 推导出布局的个别指令。
 * `Cmd.Wait` 在 R48 里由 wait_illogical_parameters 描述，但布局取决于数组长度，
 * 这里按 EasyRPG 的实现补上：1 个参数是时长，2 个参数的第二位是「等待输入」标志（2k3）。
 */
const MANUAL_SPECS: Record<number, CommandSpec> = {
  [Cmd.Wait]: {
    minParams: { '2k': 1, '2k3': 1 },
    params: [slot(0, time, 'secTenthCount'), { ...slot(1, bool, 'waitForKey'), since: '2k3' }],
  },

  // EasyRPG Player 扩展（最少参数个数取自 EasyRPG Player 的 CmdSetup）
  [Cmd.EasyRpgTriggerEventAt]: { minParams: same(4), params: [] },
  [Cmd.EasyRpgPathfinder]: { minParams: same(13), params: [] },
  [Cmd.EasyRpgCallMovementAction]: { minParams: same(1), params: [] },
  [Cmd.EasyRpgWaitForSingleMovement]: { minParams: same(6), params: [] },
  [Cmd.EasyRpgAnimateVariable]: { minParams: same(1), params: [] },
  [Cmd.EasyRpgSetInterpreterFlag]: { minParams: same(2), params: [] },
  [Cmd.EasyRpgProcessJson]: { minParams: same(8), params: [] },
  [Cmd.EasyRpgCloneMapEvent]: { minParams: same(10), params: [] },
  [Cmd.EasyRpgDestroyMapEvent]: { minParams: same(2), params: [] },
  [Cmd.EasyRpgStringPictureMenu]: { minParams: same(1), params: [] },
};

/** Maniac Patch 的参数个数随版本变化（实测老工程会少一些），因此只做指令集检查 */
const MANIAC_SPEC: CommandSpec = { minParams: null, params: [] };

function toSpecs(command: SchemaCommand): ParamSlot[] {
  return command.params.map((param: SchemaParamSlot) => ({
    position: param.position,
    name: param.name,
    spec: param.spec,
    whenIndex: param.when?.index,
    whenEquals: param.when?.equals,
    since: param.since,
  }));
}

const SPECS: ReadonlyMap<number, CommandSpec> = (() => {
  const map = new Map<number, CommandSpec>(
    Object.entries(COMMAND_SCHEMA).map(([code, command]) => [
      Number(code),
      { minParams: command.minParams, params: toSpecs(command) },
    ]),
  );

  for (const [code, spec] of Object.entries(MANUAL_SPECS)) {
    map.set(Number(code), spec);
  }
  for (const code of MANIAC_COMMANDS) {
    if (!map.has(code)) map.set(code, MANIAC_SPEC);
  }

  return map;
})();

/** 指令文本是否有意义（用于决定是否按文本块渲染） */
export function commandUsesText(code: number): boolean {
  return COMMAND_SCHEMA[code]?.usesText ?? false;
}

/** 指令的参数槽（供插入指令的表单使用）；未建模的指令返回空数组 */
export function getCommandParams(code: number): ParamSlot[] {
  return SPECS.get(code)?.params ?? [];
}

/** 指定引擎下该指令需要的最少参数个数；null 表示无法静态推导 */
export function getCommandMinParams(code: number, engine: Engine): number | null {
  const spec = SPECS.get(code);
  if (!spec || !spec.minParams) return null;
  return spec.minParams[engine];
}

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
  // 同一位置在多个分派分支里可能被重复声明，因此按内容去重
  const seen = new Set<string>();
  const push = (severity: Diagnostic['severity'], message: string) => {
    const key = `${severity}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push({ index: line.index, severity, message });
  };

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

  const spec = SPECS.get(line.code);
  if (!spec) return diagnostics;

  const params = line.params;
  const minParams = spec.minParams?.[env.engine];
  if (minParams !== undefined && params.length < minParams) {
    push('error', `参数不足：${env.engine} 需要 ${minParams} 个，实际 ${params.length} 个`);
  }

  for (const item of spec.params) {
    const value = params[item.position];
    if (value === undefined) continue;
    // 2003 新增的参数在 2k 工程里不存在，跳过校验
    if (item.since && item.since !== env.engine) continue;
    if (item.whenIndex !== undefined && item.whenEquals) {
      const actual = params[item.whenIndex];
      if (!item.whenEquals.includes(actual)) continue;
    }

    const problem = checkParam(item.spec, value, env);
    if (problem) {
      push(problem.severity, `参数 ${item.position + 1}（${item.name ?? '?'}）：${problem.message}`);
    }
  }

  return diagnostics;
}

function checkParam(
  param: ParamSpec,
  value: number,
  env: CommandEnvironment,
): { severity: Diagnostic['severity']; message: string } | null {
  const error = (message: string) => ({ severity: 'error' as const, message });
  // 补丁 / EasyRPG 会扩展枚举取值，此时越界只作提醒
  const outOfRange = (message: string) => ({
    severity: env.runtime === 'rpg_rt' ? ('error' as const) : ('warning' as const),
    message,
  });

  switch (param.kind) {
    case 'int':
      if (!Number.isInteger(value)) return error('必须是整数');
      if (param.min !== undefined && value < param.min) return error(`不能小于 ${param.min}`);
      if (param.max !== undefined && value > param.max) return error(`不能大于 ${param.max}`);
      return null;

    case 'time':
      if (!Number.isInteger(value)) return error('必须是整数');
      if (value < 0) return error('不能为负数');
      return null;

    case 'bool':
      if (value !== 0 && value !== 1) return outOfRange('只能是 0 或 1');
      return null;

    case 'enum':
      return value in param.options ? null : outOfRange(`取值 ${value} 不在允许范围内`);

    case 'ref': {
      // 10001 起是解释器的魔法数（玩家 / 载具 / 事件自身），不是数据库 id
      if (param.magic && value in param.magic) return null;
      if (param.allowZero && value === 0) return null;
      if (!Number.isInteger(value) || value < 1) return error('id 必须是从 1 开始的整数');
      const lookup = env.lookup?.[param.target];
      if (lookup && !lookup(value)) return error(`引用的对象 ${value} 不存在`);
      return null;
    }

    case 'valueOrVariable':
    case 'text':
    case 'any':
      return null;
  }
}

/** 校验整页；返回的每条诊断都带有对应的指令下标 */
export function validateEventPage(lines: CommandLine[], env: CommandEnvironment): Diagnostic[] {
  return lines.flatMap((line) => validateCommand(line, env));
}
