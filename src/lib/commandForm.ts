import type { Engine } from './environment';
import {
  commandUsesText,
  getCommandMinParams,
  getCommandParams,
  type DbRefKind,
  type ParamSpec,
} from './commandSpec';

/**
 * 插入指令的表单模型。
 *
 * 参数语义来自 R48 的 schema；同一位置在不同取值下语义不同的（如控制开关的
 * 「单个 / 范围 / 间接指定」），schema 会给出多个带 `when` 的变体，
 * 表单按当前参数值实时挑选应显示的那一个。
 * schema 没覆盖到的位置保留为「原始数值」，作为后续细化 UI 的兜底。
 */

export interface FieldVariant {
  name: string;
  spec: ParamSpec;
  whenIndex?: number;
  whenEquals?: number[];
}

export interface FormField {
  position: number;
  variants: FieldVariant[];
  /** schema 未描述该位置，只能按原始数值填写 */
  synthetic: boolean;
}

export interface CommandFormModel {
  usesText: boolean;
  paramCount: number;
  fields: FormField[];
  /** 存在 schema 未建模的参数位置 */
  incomplete: boolean;
  /** schema 完全没有参数信息（EasyRPG / Maniac 等扩展指令） */
  unknownLayout: boolean;
}

export function buildCommandForm(code: number, engine: Engine): CommandFormModel {
  const slots = getCommandParams(code).filter((slot) => !slot.since || slot.since === engine);
  const min = getCommandMinParams(code, engine);
  const maxPosition = slots.reduce((max, slot) => Math.max(max, slot.position), -1);
  const paramCount = Math.max(min ?? 0, maxPosition + 1);

  const byPosition = new Map<number, FormField>();
  for (const slot of slots) {
    const field = byPosition.get(slot.position) ?? {
      position: slot.position,
      variants: [],
      synthetic: false,
    };
    field.variants.push({
      name: slot.name ?? '',
      spec: slot.spec,
      whenIndex: slot.whenIndex,
      whenEquals: slot.whenEquals,
    });
    byPosition.set(slot.position, field);
  }

  for (let position = 0; position < paramCount; position += 1) {
    if (!byPosition.has(position)) {
      byPosition.set(position, { position, variants: [], synthetic: true });
    }
  }

  const fields = [...byPosition.values()].sort((a, b) => a.position - b.position);

  return {
    usesText: commandUsesText(code),
    paramCount,
    fields,
    incomplete: fields.some((field) => field.synthetic),
    // 参数个数本身都无法推导（Maniac 等扩展），只能按原始数组填写
    unknownLayout: slots.length === 0 && min === null,
  };
}

/** 按当前参数值挑出该位置实际生效的语义 */
export function resolveField(field: FormField, values: number[]): FieldVariant {
  const conditional = field.variants.filter((variant) => variant.whenIndex !== undefined);
  const matched = conditional.find((variant) =>
    (variant.whenEquals ?? []).includes(values[variant.whenIndex as number] ?? 0),
  );
  if (matched) return matched;

  const base = field.variants.find((variant) => variant.whenIndex === undefined);
  if (base) return base;

  return { name: '', spec: { kind: 'int' } };
}

/** 表单初始值：枚举取第一个合法值，引用默认 1，其余为 0 */
export function initialValues(model: CommandFormModel): number[] {
  const values = Array.from({ length: model.paramCount }, () => 0);
  for (const field of model.fields) {
    values[field.position] = defaultValue(resolveField(field, values).spec);
  }
  return values;
}

function defaultValue(spec: ParamSpec): number {
  switch (spec.kind) {
    case 'ref':
      return 1;
    case 'enum': {
      const keys = Object.keys(spec.options)
        .map(Number)
        .sort((a, b) => a - b);
      return keys.includes(0) ? 0 : (keys[0] ?? 0);
    }
    case 'int':
      return spec.min !== undefined && spec.min > 0 ? spec.min : 0;
    default:
      return 0;
  }
}

/** R48 的参数名 → 中文标签；未收录的保持原名 */
const PARAM_LABELS: Record<string, string> = {
  transparent: '透明',
  position: '显示位置',
  positionLocked: '锁定位置',
  continueEvents: '允许并行',
  faceIndex: '脸图编号',
  faceAtRight: '脸图在右侧',
  faceFlipped: '水平翻转',
  type: '类型',
  targetType: '目标',
  target: '目标',
  targetVar: '目标变量',
  rangeFirst: '起始',
  rangeLast: '结束',
  targIndVar: '变量（间接指定）',
  changeMode: '操作',
  value: '数值',
  valueVar: '变量',
  switch: '开关',
  switchId: '开关',
  switch_id: '开关',
  var: '变量',
  varId: '变量',
  var_id: '变量',
  item: '道具',
  itemId: '道具',
  item_id: '道具',
  itemIsVar: '道具由变量指定',
  itemVar: '道具变量',
  actor: '角色',
  actorId: '角色',
  actor_id: '角色',
  actorIsVar: '角色由变量指定',
  actorVar: '角色变量',
  enemy: '敌人',
  enemyId: '敌人',
  enemy_id: '敌人',
  troop: '敌群',
  troopId: '敌群',
  troop_id: '敌群',
  skill: '技能',
  skillId: '技能',
  skill_id: '技能',
  state: '状态',
  stateId: '状态',
  state_id: '状态',
  commonEv: '公共事件',
  commonEvent: '公共事件',
  cev: '公共事件',
  class: '职业',
  classId: '职业',
  class_id: '职业',
  battleCommand: '战斗指令',
  animation: '动画',
  animationId: '动画',
  animation_id: '动画',
  map: '地图',
  mapId: '地图',
  map_id: '地图',
  terrain: '地形',
  tileset: '图块集',
  attribute: '属性',
  event: '事件',
  page: '页面',
  pageVar: '页面变量',
  char: '角色',
  charVar: '角色变量',
  amount: '数量',
  count: '数量',
  countIsVar: '数量由变量指定',
  countVar: '数量变量',
  remove: '减少',
  takeGold: '减少',
  goldIsVar: '数值由变量指定',
  goldVar: '数值变量',
  gold: '数值',
  exp: '经验值',
  expIsVar: '经验值由变量指定',
  expVar: '经验值变量',
  removeExp: '减少',
  showLvlUp: '显示升级提示',
  lvl: '等级',
  lvlIsVar: '等级由变量指定',
  lvlVar: '等级变量',
  removeLvl: '降低',
  level: '等级',
  hero: '角色',
  hp: 'HP',
  sp: 'MP',
  mode: '模式',
  operation: '操作',
  speed: '速度',
  frequency: '频率',
  waitForKey: '等待按键',
  secTenthCount: '时长',
  ignoreChecks: '无视条件',
  uses: '次数',
  command: '指令',
  add: '增加',
  varTarg: '变量',
  lastTarg: '结束变量',
  source: '数值来源',
  high: '上限',
  low: '下限',
  fadeTime: '淡入时间',
  volume: '音量',
  tempo: '节奏',
  balance: '平衡',
  pictureId: '图片编号',
  posVars: '坐标由变量指定',
  xVar: 'X 变量',
  yVar: 'Y 变量',
  mapAttach: '固定在地图上',
  effectMode: '效果',
};

const REF_LABELS: Record<DbRefKind, string> = {
  switch: '开关',
  variable: '变量',
  actor: '角色',
  item: '道具',
  skill: '技能',
  state: '状态',
  enemy: '敌人',
  troop: '敌群',
  commonEvent: '公共事件',
  class: '职业',
  battleCommand: '战斗指令',
  tileset: '图块集',
  terrain: '地形',
  animation: '动画',
  attribute: '属性',
  map: '地图',
  event: '事件',
};

/** 常见枚举取值的显示名；未收录的保持原样 */
const OPTION_LABELS: Record<string, string> = {
  on: '开启',
  off: '关闭',
  toggle: '反转',
  single: '单个',
  range: '范围',
  indirect: '间接指定',
  top: '上方',
  centre: '居中',
  bottom: '下方',
  add: '增加',
  remove: '减少',
  replace: '替换',
};

export function fieldLabel(variant: FieldVariant, position: number): string {
  const raw = variant.name.replace(/\?$/, '');
  if (!raw || raw === '_' || raw.startsWith('unk')) return `参数 ${position + 1}`;
  return PARAM_LABELS[raw] ?? raw;
}

export function fieldHint(spec: ParamSpec): string | null {
  switch (spec.kind) {
    case 'time':
      return '× 0.1 秒';
    case 'ref': {
      const magic = spec.magic
        ? `特殊值：${Object.entries(spec.magic)
            .map(([id, name]) => `${id}=${name}`)
            .join('、')}`
        : '';
      const zero = spec.allowZero ? '0 = 未使用' : '';
      return [`${REF_LABELS[spec.target]} ID`, zero, magic].filter(Boolean).join('；');
    }
    case 'valueOrVariable':
      return '常量，或由同组参数指定的变量';
    default:
      return null;
  }
}

export function optionLabel(value: string): string {
  return OPTION_LABELS[value] ?? value;
}

/** 按 schema 的取值范围收敛输入 */
export function clampParam(spec: ParamSpec, value: number): number {
  let next = Number.isFinite(value) ? Math.trunc(value) : 0;
  if (spec.kind === 'int') {
    if (spec.min !== undefined) next = Math.max(spec.min, next);
    if (spec.max !== undefined) next = Math.min(spec.max, next);
  }
  if (spec.kind === 'time') next = Math.max(0, next);
  if (spec.kind === 'ref' && !spec.allowZero) next = Math.max(1, next);
  if (spec.kind === 'bool') next = next === 0 ? 0 : 1;
  return next;
}
