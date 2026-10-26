import {
  BATTLE_ONLY_COMMANDS,
  EASYRPG_COMMANDS,
  MANIAC_COMMANDS,
  RPG2003_ONLY_COMMANDS,
  type Engine,
  type Runtime,
} from './environment';
import { EVENT_COMMANDS, type CommandLine } from './eventCommands';
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
  /** 数据库对象引用，id 从 1 开始 */
  | { kind: 'ref'; target: DbRefKind; label?: string }
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
const ref = (target: DbRefKind, label?: string): ParamSpec => ({ kind: 'ref', target, label });
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
  1005: 1,
  10110: 0,
  10120: 4,
  10130: 3,
  10140: 1,
  10150: 2,
  10210: 4,
  10220: 7,
  10230: 5,
  10310: 3,
  10320: 5,
  10330: 3,
  10410: 6,
  10420: 6,
  10430: 6,
  10440: 5,
  10450: 5,
  10460: 6,
  10470: 5,
  10480: 4,
  10490: 2,
  10500: 8,
  10610: 1,
  10620: 1,
  10630: 3,
  10640: 2,
  10650: 2,
  10660: 5,
  10670: 4,
  10680: 2,
  10690: 2,
  10710: 6,
  10720: 4,
  10730: 3,
  10740: 3,
  10810: 3,
  10820: 3,
  10830: 3,
  10840: 0,
  10850: 5,
  10860: 4,
  10870: 2,
  10910: 4,
  10920: 4,
  11010: 1,
  11020: 1,
  11030: 6,
  11040: 6,
  11050: 4,
  11060: 5,
  11070: 2,
  11110: 14,
  11120: 16,
  11130: 1,
  11210: 3,
  11310: 1,
  11320: 7,
  11330: 4,
  11340: 0,
  11350: 0,
  11410: 1,
  11510: 4,
  11520: 1,
  11530: 0,
  11540: 0,
  11550: 3,
  11560: 5,
  11610: 5,
  11710: 1,
  11720: 6,
  11740: 1,
  11750: 3,
  11810: 6,
  11820: 1,
  11830: 5,
  11840: 1,
  11910: 0,
  11930: 1,
  11950: 0,
  11960: 1,
  12010: 6,
  12110: 0,
  12120: 1,
  12210: 0,
  12220: 0,
  12310: 0,
  12320: 0,
  12330: 3,
  12410: 0,
  12420: 0,
  12510: 0,
  // 2k3
  1006: 3,
  1007: 3,
  1008: 7,
  1009: 4,
  5001: 0,
  5002: 0,
  5003: 0,
  5004: 0,
  5005: 0,
  13110: 5,
  13120: 4,
  13130: 3,
  13150: 1,
  13210: 0,
  13260: 3,
  13310: 5,
  13410: 0,
  // 结构标记
  20110: 0,
  20140: 1,
  20141: 0,
  22010: 0,
  22011: 0,
  22210: 0,
  22410: 0,
  23310: 0,
  23311: 0,
  20710: 0,
  20711: 0,
  20712: 0,
  20713: 0,
  20720: 0,
  20721: 0,
  20722: 0,
  20730: 0,
  20731: 0,
  20732: 0,
  10: 0,
  // EasyRPG
  2002: 4,
  2003: 13,
  2051: 6,
  2053: 2,
  2055: 8,
  2056: 10,
  2057: 2,
  // Maniac：EasyRPG 的 CmdSetup 对应的是特定 Maniac 版本，
  // 实测老工程里的参数个数会少一些（如 3007 = 21、3016 = 1），因此不校验个数
};

/** 已建模参数语义的指令（其余指令的取值暂不校验） */
const PARAMS: Record<number, ParamSlot[]> = {
  // 消息与注释的正文都是文本字面量
  10110: [slot(text)],
  20110: [slot(text)],
  12410: [slot(text)],
  22410: [slot(text)],
  // 标签名同样是文本字面量
  12110: [slot(text)],
  // 等待：参数 2 非 0 时优先，表示等待玩家输入
  11410: [slot(time), slot({ kind: 'bool', label: '等待输入' })],
  // 显示选项：参数为取消选项的处理方式（0 表示禁止取消）
  10140: [slot(int(0, undefined, '取消选项'))],
  // 输入数字：位数 + 结果变量
  10150: [slot(int(1, undefined, '位数')), slot(ref('variable', '变量'))],
  // 控制开关：寻址模式 + 起止 id + 操作
  //   模式 0/1（单个 / 范围）时参数 2、3 是开关 id；
  //   模式 2 起是变量寻址，此时参数 3 未使用（常见为 0）
  10210: [
    slot(enumOf({ 0: '单个', 1: '范围', 2: '变量', 3: '变量范围', 4: '表达式' }, '寻址')),
    when(ref('switch', '开关'), (params) => params[0] === 0 || params[0] === 1),
    when(ref('switch', '开关'), (params) => params[0] === 1),
    slot(enumOf({ 0: '关', 1: '开', 2: '切换' }, '操作')),
  ],
  // 更改金钱：[操作, 数值来源, 数值]
  10310: [
    slot(enumOf({ 0: '增加', 1: '减少' }, '操作')),
    slot(any),
    slot({ kind: 'valueOrVariable', label: '数值' }),
  ],
  // 调用事件：目标类型决定 id 的含义，只有直接调用公共事件时才是对象引用
  12330: [
    slot(enumOf({ 0: '公共事件', 1: '地图事件', 2: '间接', 3: '变量', 4: '间接变量' }, '目标')),
    when(ref('commonEvent', '公共事件'), (params) => params[0] === 0),
    slot(any),
  ],
  // 调用公共事件
  1005: [slot(ref('commonEvent', '公共事件'))],
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

  if (!EVENT_COMMANDS[line.code]) {
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
