import { Cmd } from './commandCodes';
import type { DbRefKind } from './commandSpec';

/**
 * 逐条指令的编辑器布局，仿照 RPG Maker 的指令对话框：
 * 左侧标签、右侧控件，同一行的控件按 RM 的语序并排。
 *
 * 参数位置与 LCF 的 parameters 数组一致；未出现在布局里的参数
 * 不显示，但仍以默认值参与提交。没有定义布局的指令会退回
 * 「按 schema 自动排列」的兜底模式。
 */

export interface DialogField {
  p: number;
  label?: string;
  kind: 'num' | 'ref' | 'select' | 'check';
  options?: Readonly<Record<number, string>>;
  target?: DbRefKind;
  suffix?: string;
  min?: number;
  max?: number;
}

export interface DialogRow {
  label?: string;
  fields: DialogField[];
  /** 仅当参数 when[0] 取 when[1] 中的值时显示 */
  when?: [number, number[]];
}

export interface DialogSpec {
  /** 文本字段（指令的 string 部分） */
  text?: { label: string; rows?: number; lines?: number };
  rows?: DialogRow[];
  sections?: GroupSection[];
  defaults?: Record<number, number>;
  /** 覆盖参数个数（schema 推导不准时使用） */
  paramCount?: number;
  note?: string;
}

/* ── 官方对话框结构：分组框 + 单选行 + 同行控件 ───────── */

export type GroupControl =
  | { kind: 'num'; p: number; min?: number; max?: number; suffix?: string; width?: number }
  | { kind: 'ref'; p: number; target: DbRefKind }
  | { kind: 'select'; p: number; options: Readonly<Record<number, string>> }
  | { kind: 'check'; p: number };

/** 同一行里可以混排控件和字面量（如 "~"、"'s"） */
export type GroupPart = GroupControl | string;

export interface GroupOption {
  value: number;
  label: string;
  parts?: GroupPart[];
}

export interface GroupRow {
  type: 'radio' | 'field' | 'check';
  /** radio / check 绑定的参数位置 */
  p?: number;
  label?: string;
  options?: GroupOption[];
  parts?: GroupPart[];
  when?: [number, number[]];
}

export interface GroupSection {
  title?: string;
  rows: GroupRow[];
  /** 整组仅在条件满足时显示 */
  when?: [number, number[]];
}

const num = (p: number, label?: string, extra: Partial<DialogField> = {}): DialogField => ({
  p,
  label,
  kind: 'num',
  ...extra,
});
const ref = (p: number, target: DbRefKind, label?: string): DialogField => ({
  p,
  label,
  kind: 'ref',
  target,
});
const sel = (
  p: number,
  options: Record<number, string>,
  label?: string,
): DialogField => ({ p, label, kind: 'select', options });
const chk = (p: number, label: string): DialogField => ({ p, label, kind: 'check' });
const row = (label: string | undefined, ...fields: DialogField[]): DialogRow => ({ label, fields });
const when = (rowSpec: DialogRow, p: number, values: number[]): DialogRow => ({
  ...rowSpec,
  when: [p, values],
});

/** 常用选项表 */
const ADD_REMOVE = { 0: '增加', 1: '减少' };
const TARGET = { 0: '全体队友', 1: '指定角色', 2: '变量指定' };
const OPERAND = { 0: '常量', 1: '变量' };
const TIMER_OP = { 0: '设置时间', 1: '设置并启动', 2: '停止' };
const COMPARE = { 0: '等于', 1: '大于等于', 2: '小于等于', 3: '大于', 4: '小于', 5: '不等于' };
const DIRECTION = { 0: '忽略', 1: '上', 2: '右', 3: '下', 4: '左' };
const VEHICLE = { 0: '小船', 1: '大船', 2: '飞艇' };
const PICTURE_EFFECT = { 0: '无', 1: '旋转', 2: '波动' };
const FLASH_MODE = { 0: '暂时', 1: '开始', 2: '结束' };

/** 角色目标的通用两行：目标 + 角色/变量 */
function actorTargets(): DialogRow[] {
  return [
    row('目标', sel(0, TARGET)),
    when(row('角色', ref(1, 'actor')), 0, [1]),
    when(row('角色变量', ref(1, 'variable')), 0, [2]),
  ];
}

const PAGE_1: Record<number, DialogSpec> = {
  [Cmd.ShowMessage]: { text: { label: '文本', rows: 4 }, rows: [] },
  [Cmd.MessageOptions]: {
    rows: [
      row('对话框', chk(0, '透明背景')),
      row('显示位置', sel(1, { 0: '上方', 1: '居中', 2: '下方' })),
      row(undefined, chk(2, '固定位置')),
      row(undefined, chk(3, '允许事件并行')),
    ],
  },
  [Cmd.ChangeFaceGraphic]: {
    text: { label: '脸图文件' },
    rows: [
      row('脸图编号', num(0, undefined, { min: 0 })),
      row(undefined, chk(1, '显示在右侧')),
      row(undefined, chk(2, '水平翻转')),
    ],
  },
  [Cmd.ShowChoice]: {
    text: { label: '选项（每行一个）', rows: 4 },
    rows: [
      row(
        '取消操作',
        sel(0, { 0: '不允许取消', 1: '选项 1', 2: '选项 2', 3: '选项 3', 4: '选项 4' }),
      ),
    ],
  },
  [Cmd.InputNumber]: {
    rows: [row('位数', num(0, undefined, { min: 1, max: 6 })), row('存入变量', ref(1, 'variable'))],
  },
  [Cmd.ControlSwitches]: {
    rows: [
      row('操作', sel(0, { 0: '单个', 1: '范围', 2: '间接指定' })),
      when(row('开关', ref(1, 'switch')), 0, [0]),
      when(row('起始开关', ref(1, 'switch')), 0, [1]),
      when(row('结束开关', ref(2, 'switch')), 0, [1]),
      when(row('变量', ref(1, 'variable')), 0, [2]),
      row('行为', sel(3, { 0: '开启', 1: '关闭', 2: '反转' })),
    ],
  },
  [Cmd.ControlVars]: {
    rows: [
      row('目标', sel(0, { 0: '单个', 1: '范围', 2: '间接指定' })),
      row('变量', ref(1, 'variable')),
      when(row('结束变量', ref(2, 'variable')), 0, [1]),
      row('操作', sel(3, { 0: '代入', 1: '加', 2: '减', 3: '乘', 4: '除', 5: '取余' })),
      row(
        '数值来源',
        sel(4, {
          0: '常量',
          1: '变量',
          2: '间接变量',
          3: '随机数',
          4: '道具',
          5: '角色',
          6: '事件或玩家',
          7: '游戏信息',
          8: '战斗敌人',
        }),
      ),
      when(row('数值', num(5)), 4, [0]),
      when(row('变量', ref(5, 'variable')), 4, [1]),
      when(row('变量', ref(5, 'variable')), 4, [2]),
      when(row('下限', num(5)), 4, [3]),
      when(row('上限', num(6)), 4, [3]),
      when(row('道具', ref(5, 'item')), 4, [4]),
      when(row('属性', num(6)), 4, [4]),
      when(row('角色', ref(5, 'actor')), 4, [5]),
      when(row('属性', num(6)), 4, [5]),
      when(row('事件', ref(5, 'event')), 4, [6]),
      when(row('属性', num(6)), 4, [6]),
      when(row('信息', num(5)), 4, [7]),
      when(row('敌人', ref(5, 'enemy')), 4, [8]),
      when(row('属性', num(6)), 4, [8]),
    ],
    paramCount: 7,
  },
  [Cmd.TimerOperation]: {
    rows: [
      row('计时器', sel(5, { 0: '计时器 1', 1: '计时器 2' })),
      row('操作', sel(0, TIMER_OP)),
      when(row(undefined, chk(1, '时间由变量指定')), 0, [0]),
      when(row('时间', num(2, undefined, { suffix: '秒' })), 0, [0, 1]),
      when(row(undefined, chk(3, '显示计时器')), 0, [1]),
      when(row(undefined, chk(4, '战斗中也计时')), 0, [1]),
    ],
    paramCount: 6,
  },
  [Cmd.ChangeGold]: {
    rows: [
      row('操作', sel(0, ADD_REMOVE)),
      row(undefined, chk(1, '数值由变量指定')),
      when(row('数值', num(2, undefined, { min: 0 })), 1, [0]),
      when(row('变量', ref(2, 'variable')), 1, [1]),
    ],
  },
  [Cmd.ChangeItems]: {
    rows: [
      row('操作', sel(0, ADD_REMOVE)),
      row(undefined, chk(1, '道具由变量指定')),
      when(row('道具', ref(2, 'item')), 1, [0]),
      when(row('变量', ref(2, 'variable')), 1, [1]),
      row(undefined, chk(3, '数量由变量指定')),
      when(row('数量', num(4, undefined, { min: 0 })), 3, [0]),
      when(row('变量', ref(4, 'variable')), 3, [1]),
    ],
  },
  [Cmd.ChangePartyMembers]: {
    rows: [
      row('操作', sel(0, { 0: '加入', 1: '离开' })),
      row(undefined, chk(1, '角色由变量指定')),
      when(row('角色', ref(2, 'actor')), 1, [0]),
      when(row('变量', ref(2, 'variable')), 1, [1]),
    ],
  },
  [Cmd.ChangeExp]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, ADD_REMOVE)),
      row(undefined, chk(3, '数值由变量指定')),
      when(row('经验值', num(4, undefined, { min: 0 })), 3, [0]),
      when(row('变量', ref(4, 'variable')), 3, [1]),
      row(undefined, chk(5, '显示升级提示')),
    ],
  },
  [Cmd.ChangeLevel]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, ADD_REMOVE)),
      row(undefined, chk(3, '数值由变量指定')),
      when(row('等级', num(4, undefined, { min: 1 })), 3, [0]),
      when(row('变量', ref(4, 'variable')), 3, [1]),
      row(undefined, chk(5, '显示升级提示')),
    ],
  },
  [Cmd.ChangeParameters]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, ADD_REMOVE)),
      row(
        '能力',
        sel(3, {
          0: '最大 HP',
          1: '最大 MP',
          2: '攻击力',
          3: '防御力',
          4: '精神力',
          5: '敏捷',
        }),
      ),
      row(undefined, chk(4, '数值由变量指定')),
      when(row('数值', num(5)), 4, [0]),
      when(row('变量', ref(5, 'variable')), 4, [1]),
    ],
  },
  [Cmd.ChangeSkills]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, { 0: '学习', 1: '遗忘' })),
      row(undefined, chk(3, '技能由变量指定')),
      when(row('技能', ref(4, 'skill')), 3, [0]),
      when(row('变量', ref(4, 'variable')), 3, [1]),
    ],
  },
  [Cmd.ChangeEquipment]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, { 0: '更换', 1: '卸下' })),
      row('装备', num(3, undefined, { min: 0 })),
    ],
  },
  [Cmd.ChangeHP]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, { 0: '恢复', 1: '伤害' })),
      row(undefined, chk(3, '数值由变量指定')),
      when(row('数值', num(4, undefined, { min: 0 })), 3, [0]),
      when(row('变量', ref(4, 'variable')), 3, [1]),
      row(undefined, chk(5, '允许濒死')),
    ],
  },
  [Cmd.ChangeSP]: {
    rows: [
      ...actorTargets(),
      row('操作', sel(2, ADD_REMOVE)),
      row(undefined, chk(3, '数值由变量指定')),
      when(row('数值', num(4, undefined, { min: 0 })), 3, [0]),
      when(row('变量', ref(4, 'variable')), 3, [1]),
    ],
  },
  [Cmd.ChangeCondition]: {
    rows: [...actorTargets(), row('操作', sel(2, { 0: '附加', 1: '解除' })), row('状态', ref(3, 'state'))],
  },
  [Cmd.FullHeal]: { rows: actorTargets() },
  [Cmd.SimulatedAttack]: {
    rows: [
      ...actorTargets(),
      row('攻击力', num(2)),
      row('防御修正', num(3)),
      row('精神修正', num(4)),
      row('分散度', num(5, undefined, { min: 0, max: 10 })),
      row(undefined, chk(6, '记录伤害到变量')),
      row('结果变量', ref(7, 'variable')),
    ],
  },
  [Cmd.ChangeHeroName]: {
    text: { label: '名字' },
    rows: [row('角色', ref(0, 'actor'))],
  },
  [Cmd.ChangeHeroTitle]: {
    text: { label: '称号' },
    rows: [row('角色', ref(0, 'actor'))],
  },
  [Cmd.ChangeSpriteAssociation]: {
    text: { label: '行走图文件' },
    rows: [row('角色', ref(0, 'actor')), row('图像编号', num(1, undefined, { min: 0 })), row(undefined, chk(2, '透明'))],
  },
  [Cmd.ChangeActorFace]: {
    text: { label: '脸图文件' },
    rows: [row('角色', ref(0, 'actor')), row('脸图编号', num(1, undefined, { min: 0 }))],
  },
  [Cmd.ChangeVehicleGraphic]: {
    text: { label: '行走图文件' },
    rows: [row('载具', sel(0, VEHICLE)), row('图像编号', num(1, undefined, { min: 0 }))],
  },
  [Cmd.ChangeSystemBGM]: {
    text: { label: 'BGM 文件' },
    rows: [
      row(
        '用途',
        sel(0, {
          0: '战斗',
          1: '胜利',
          2: '旅馆',
          3: '小船',
          4: '大船',
          5: '飞艇',
          6: '游戏结束',
        }),
      ),
      row('淡入时间', num(1, undefined, { min: 0, suffix: '×0.1 秒' })),
      row('音量', num(2, undefined, { min: 0, max: 100 })),
      row('节奏', num(3, undefined, { min: 50, max: 150 })),
      row('平衡', num(4, undefined, { min: 0, max: 100 })),
    ],
    defaults: { 2: 100, 3: 100, 4: 50 },
  },
  [Cmd.ChangeSystemSFX]: {
    text: { label: 'SE 文件' },
    rows: [
      row(
        '用途',
        sel(0, {
          0: '光标',
          1: '决定',
          2: '取消',
          3: '无效',
          4: '战斗',
          5: '逃跑',
          6: '敌人攻击',
          7: '敌人受伤',
          8: '角色受伤',
          9: '回避',
          10: '敌人死亡',
          11: '道具',
        }),
      ),
      row('音量', num(1, undefined, { min: 0, max: 100 })),
      row('节奏', num(2, undefined, { min: 50, max: 150 })),
      row('平衡', num(3, undefined, { min: 0, max: 100 })),
    ],
    defaults: { 1: 100, 2: 100, 3: 50 },
  },
  [Cmd.ChangeSystemGraphics]: {
    text: { label: '系统图像文件' },
    rows: [
      row(undefined, chk(0, '平铺显示')),
      row('字体', sel(1, { 0: 'MS Gothic', 1: 'MS Mincho' })),
    ],
  },
  [Cmd.ChangeScreenTransitions]: {
    rows: [
      row(
        '场合',
        sel(0, {
          0: '地图切换前',
          1: '地图切换后',
          2: '进入战斗前',
          3: '进入战斗后',
          4: '离开战斗前',
          5: '离开战斗后',
        }),
      ),
      row(
        '转场',
        sel(1, {
          0: '默认',
          1: '淡入淡出',
          2: '块',
          3: '向下',
          4: '向上',
          5: '百叶窗 A',
          6: '百叶窗 B',
          7: '百叶窗 C',
          8: '缩放进入',
          9: '缩放退出',
          10: '上下移动',
          11: '下上移动',
          12: '左右移动',
          13: '右左移动',
          14: '纵向重叠',
          15: '横向重叠',
          16: '四分割',
          17: '放大',
          18: '碎片',
          19: '雾',
          20: 'null',
          21: '无',
        }),
      ),
    ],
  },
};

/* ── 第 1 页：按官方手册与截图逐条还原 ───────────────── */

const gnum = (
  p: number,
  extra: Partial<Extract<GroupControl, { kind: 'num' }>> = {},
): GroupControl => ({ kind: 'num', p, ...extra });
const gref = (p: number, target: DbRefKind): GroupControl => ({ kind: 'ref', p, target });
const gsel = (p: number, options: Record<number, string>): GroupControl => ({
  kind: 'select',
  p,
  options,
});
const gchk = (p: number): GroupControl => ({ kind: 'check', p });
void gchk;
const radio = (p: number, options: GroupOption[]): GroupRow => ({ type: 'radio', p, options });
const fieldRow = (label: string, ...parts: GroupPart[]): GroupRow => ({
  type: 'field',
  label,
  parts,
});
const checkRow = (p: number, label: string): GroupRow => ({ type: 'check', p, label });
const sec = (title: string | undefined, ...rows: GroupRow[]): GroupSection => ({ title, rows });
const secWhen = (
  title: string | undefined,
  when: [number, number[]],
  ...rows: GroupRow[]
): GroupSection => ({ title, rows, when });

/** 角色 / 变量二选一（各指令通用的「固定 / 变量」） */
const fixedOrVar = (
  p: number,
  control: DbRefKind,
  fixedLabel = '固定',
): GroupRow => ({
  type: 'radio',
  p,
  options: [
    { value: 0, label: fixedLabel, parts: [gref(p + 1, control)] },
    { value: 1, label: '变量', parts: [gref(p + 1, 'variable')] },
  ],
});

/** 角色目标：全体 / 固定 / 变量 */
const actorTargetRow = (): GroupRow => ({
  type: 'radio',
  p: 0,
  options: [
    { value: 0, label: '全体队友' },
    { value: 1, label: '固定', parts: [gref(1, 'actor')] },
    { value: 2, label: '变量', parts: [gref(1, 'variable')] },
  ],
});

/** 常量 / 变量操作数 */
const operandRow = (p: number, valuePosition: number, min = 0, max?: number): GroupRow => ({
  type: 'radio',
  p,
  options: [
    {
      value: 0,
      label: '常量',
      parts: [gnum(valuePosition, { min, max })],
    },
    { value: 1, label: '变量', parts: [gref(valuePosition, 'variable')] },
  ],
});

const PAGE_1_V2: Record<number, DialogSpec> = {
  [Cmd.MessageOptions]: {
    sections: [
      sec('窗口样式', radio(0, [{ value: 0, label: '正常' }, { value: 1, label: '透明' }])),
      sec(
        '显示位置',
        radio(1, [
          { value: 0, label: '上方' },
          { value: 1, label: '居中' },
          { value: 2, label: '下方' },
        ]),
      ),
      sec(
        '选项',
        checkRow(2, '防止窗口遮挡玩家'),
        checkRow(3, '允许其他事件并行'),
      ),
    ],
  },
  [Cmd.ChangeFaceGraphic]: {
    text: { label: '脸图文件' },
    sections: [
      sec('脸图', fieldRow('编号', gnum(0, { min: 0 }))),
      sec(
        '显示位置',
        radio(1, [{ value: 0, label: '左侧' }, { value: 1, label: '右侧' }]),
      ),
      sec('选项', checkRow(2, '水平翻转')),
    ],
  },
  [Cmd.ShowChoice]: {
    text: { label: '选项', lines: 4 },
    sections: [
      sec(
        '取消时',
        radio(0, [
          { value: 0, label: '禁止取消' },
          { value: 1, label: '选项 1' },
          { value: 2, label: '选项 2' },
          { value: 3, label: '选项 3' },
          { value: 4, label: '选项 4' },
          { value: 5, label: '新建分支' },
        ]),
      ),
    ],
  },
  [Cmd.InputNumber]: {
    sections: [
      sec('位数', fieldRow('位数', gnum(0, { min: 1, max: 6 }))),
      sec('变量', fieldRow('变量', gref(1, 'variable'))),
    ],
  },
  [Cmd.ControlSwitches]: {
    sections: [
      sec(
        '开关',
        radio(0, [
          { value: 0, label: '单个', parts: [gref(1, 'switch')] },
          { value: 1, label: '批量', parts: [gnum(1, { min: 1 }), '~', gnum(2, { min: 1 })] },
          { value: 2, label: '变量', parts: [gref(1, 'variable')] },
        ]),
      ),
      sec(
        '操作',
        radio(3, [
          { value: 0, label: '开启' },
          { value: 1, label: '关闭' },
          { value: 2, label: '反转' },
        ]),
      ),
    ],
  },
  [Cmd.ControlVars]: {
    sections: [
      sec(
        '变量',
        radio(0, [
          { value: 0, label: '单个', parts: [gref(1, 'variable')] },
          { value: 1, label: '批量', parts: [gnum(1, { min: 1 }), '~', gnum(2, { min: 1 })] },
          { value: 2, label: '变量', parts: [gref(1, 'variable')] },
        ]),
      ),
      sec(
        '操作',
        radio(3, [
          { value: 0, label: '代入' },
          { value: 1, label: '加' },
          { value: 2, label: '减' },
          { value: 3, label: '乘' },
          { value: 4, label: '除' },
          { value: 5, label: '取余' },
        ]),
      ),
      sec(
        '操作数',
        radio(4, [
          { value: 0, label: '常量', parts: [gnum(5)] },
          { value: 1, label: '变量', parts: [gref(5, 'variable')] },
          { value: 2, label: '变量 ID', parts: [gref(5, 'variable')] },
          { value: 3, label: '随机', parts: [gnum(5), '~', gnum(6)] },
          {
            value: 4,
            label: '道具',
            parts: [gref(5, 'item'), '的', gsel(6, { 0: '持有数', 1: '装备数' })],
          },
          {
            value: 5,
            label: '角色',
            parts: [
              gref(5, 'actor'),
              '的',
              gsel(6, {
                0: '等级',
                1: '经验',
                2: 'HP',
                3: 'MP',
                4: '最大 HP',
                5: '最大 MP',
                6: '攻击力',
                7: '防御力',
                8: '精神力',
                9: '敏捷',
                10: '装备',
              }),
            ],
          },
          {
            value: 6,
            label: '事件或玩家',
            parts: [
              gsel(5, {
                10001: '玩家',
                10002: '小船',
                10003: '大船',
                10004: '飞艇',
                10005: '本事件',
              }),
              '的',
              gsel(6, {
                0: '地图 ID',
                1: 'X 坐标',
                2: 'Y 坐标',
                3: '朝向',
                4: '画面 X',
                5: '画面 Y',
              }),
            ],
          },
          {
            value: 7,
            label: '其他',
            parts: [
              gsel(5, {
                0: '金钱',
                1: '计时器 1 剩余',
                2: '计时器 2 剩余',
                3: '队伍人数',
                4: '存档次数',
                5: '战斗次数',
                6: '胜利次数',
                7: '失败次数',
                8: '逃跑次数',
                9: 'MIDI 播放位置',
              }),
            ],
          },
          {
            value: 8,
            label: '敌人',
            parts: [
              gref(5, 'enemy'),
              '的',
              gsel(6, {
                0: 'HP',
                1: 'MP',
                2: '最大 HP',
                3: '最大 MP',
                4: '攻击力',
                5: '防御力',
                6: '精神力',
                7: '敏捷',
              }),
            ],
          },
        ]),
      ),
    ],
    paramCount: 7,
    note: '「事件或玩家」在官方对话框里拆成 Player / Event 两项，二者写入同一个操作数类型（6）。',
  },
  [Cmd.TimerOperation]: {
    sections: [
      sec(
        '目标计时器',
        radio(5, [{ value: 0, label: '计时器 1' }, { value: 1, label: '计时器 2' }]),
      ),
      sec(
        '操作',
        radio(0, [
          { value: 0, label: '设置时间' },
          { value: 1, label: '开始计时' },
          { value: 2, label: '停止计时' },
        ]),
      ),
      secWhen(
        '操作数',
        [0, [0]],
        radio(1, [
          { value: 0, label: '常量', parts: [gnum(2, { min: 0, suffix: '秒' })] },
          { value: 1, label: '变量', parts: [gref(2, 'variable')] },
        ]),
      ),
      secWhen('选项', [0, [1]], checkRow(3, '显示计时器'), checkRow(4, '战斗中也计时')),
    ],
    paramCount: 6,
  },
  [Cmd.ChangeGold]: {
    sections: [
      sec(
        '操作',
        radio(0, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec('操作数', operandRow(1, 2, 1, 999999)),
    ],
  },
  [Cmd.ChangeItems]: {
    sections: [
      sec(
        '操作',
        radio(0, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec('道具', fixedOrVar(1, 'item')),
      sec('操作数', operandRow(3, 4, 1)),
    ],
  },
  [Cmd.ChangePartyMembers]: {
    sections: [
      sec(
        '操作',
        radio(0, [{ value: 0, label: '加入' }, { value: 1, label: '离开' }]),
      ),
      sec('角色', fixedOrVar(1, 'actor')),
    ],
  },
  [Cmd.ChangeExp]: {
    sections: [
      sec('角色', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec('操作数', operandRow(3, 4)),
      sec('选项', checkRow(5, '显示升级提示')),
    ],
  },
  [Cmd.ChangeLevel]: {
    sections: [
      sec('角色', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec('操作数', operandRow(3, 4, 1)),
      sec('选项', checkRow(5, '显示升级提示')),
    ],
  },
  [Cmd.ChangeParameters]: {
    sections: [
      sec('目标', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec(
        '能力值',
        fieldRow(
          '能力值',
          gsel(3, {
            0: '最大 HP',
            1: '最大 MP',
            2: '攻击力',
            3: '防御力',
            4: '精神力',
            5: '敏捷',
          }),
        ),
      ),
      sec('操作数', operandRow(4, 5)),
    ],
  },
  [Cmd.ChangeSkills]: {
    sections: [
      sec('角色', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '学习' }, { value: 1, label: '遗忘' }]),
      ),
      sec('技能', fixedOrVar(3, 'skill')),
    ],
  },
  [Cmd.ChangeEquipment]: {
    sections: [
      sec('角色', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '更换' }, { value: 1, label: '卸下' }]),
      ),
      sec('装备', fieldRow('装备', gnum(3, { min: 0 }))),
    ],
  },
  [Cmd.ChangeHP]: {
    sections: [
      sec('目标', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec('操作数', operandRow(3, 4)),
      sec('选项', checkRow(5, '允许濒死')),
    ],
  },
  [Cmd.ChangeSP]: {
    sections: [
      sec('目标', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '增加' }, { value: 1, label: '减少' }]),
      ),
      sec('操作数', operandRow(3, 4)),
    ],
  },
  [Cmd.ChangeCondition]: {
    sections: [
      sec('目标', actorTargetRow()),
      sec(
        '操作',
        radio(2, [{ value: 0, label: '附加' }, { value: 1, label: '解除' }]),
      ),
      sec('状态', fieldRow('状态', gref(3, 'state'))),
    ],
  },
  [Cmd.FullHeal]: { sections: [sec('目标', actorTargetRow())] },
  [Cmd.SimulatedAttack]: {
    sections: [
      sec('目标', actorTargetRow()),
      sec('攻击', fieldRow('攻击力', gnum(2, { min: 1, max: 999 }))),
      sec('防御修正', fieldRow('修正值', gnum(3))),
      sec('精神修正', fieldRow('修正值', gnum(4))),
      sec('分散度', fieldRow('分散度', gnum(5, { min: 0, max: 10 }))),
      sec('选项', checkRow(6, '记录伤害到变量')),
      sec('结果变量', fieldRow('变量', gref(7, 'variable'))),
    ],
  },
  [Cmd.ChangeHeroName]: {
    text: { label: '名字' },
    sections: [sec('角色', fieldRow('角色', gref(0, 'actor')))],
  },
  [Cmd.ChangeHeroTitle]: {
    text: { label: '称号' },
    sections: [sec('角色', fieldRow('角色', gref(0, 'actor')))],
  },
  [Cmd.ChangeSpriteAssociation]: {
    text: { label: '行走图文件' },
    sections: [
      sec('角色', fieldRow('角色', gref(0, 'actor'))),
      sec('图像', fieldRow('图像编号', gnum(1, { min: 0 }))),
      sec('选项', checkRow(2, '透明')),
    ],
  },
  [Cmd.ChangeActorFace]: {
    text: { label: '脸图文件' },
    sections: [
      sec('角色', fieldRow('角色', gref(0, 'actor'))),
      sec('脸图', fieldRow('编号', gnum(1, { min: 0 }))),
    ],
  },
  [Cmd.ChangeVehicleGraphic]: {
    text: { label: '行走图文件' },
    sections: [
      sec(
        '载具',
        radio(0, [
          { value: 0, label: '小船' },
          { value: 1, label: '大船' },
          { value: 2, label: '飞艇' },
        ]),
      ),
      sec('图像', fieldRow('图像编号', gnum(1, { min: 0 }))),
    ],
  },
  [Cmd.ChangeSystemBGM]: {
    text: { label: 'BGM 文件' },
    sections: [
      sec(
        '用途',
        fieldRow(
          '用途',
          gsel(0, {
            0: '战斗',
            1: '胜利',
            2: '旅馆',
            3: '小船',
            4: '大船',
            5: '飞艇',
            6: '游戏结束',
          }),
        ),
      ),
      sec('淡入时间', fieldRow('淡入时间', gnum(1, { min: 0, suffix: '×0.1 秒' }))),
      sec('音量', fieldRow('音量', gnum(2, { min: 0, max: 100 }))),
      sec('节奏', fieldRow('节奏', gnum(3, { min: 50, max: 150 }))),
      sec('平衡', fieldRow('平衡', gnum(4, { min: 0, max: 100 }))),
    ],
    defaults: { 2: 100, 3: 100, 4: 50 },
  },
  [Cmd.ChangeSystemSFX]: {
    text: { label: 'SE 文件' },
    sections: [
      sec(
        '用途',
        fieldRow(
          '用途',
          gsel(0, {
            0: '光标',
            1: '决定',
            2: '取消',
            3: '无效',
            4: '战斗',
            5: '逃跑',
            6: '敌人攻击',
            7: '敌人受伤',
            8: '角色受伤',
            9: '回避',
            10: '敌人死亡',
            11: '道具',
          }),
        ),
      ),
      sec('音量', fieldRow('音量', gnum(1, { min: 0, max: 100 }))),
      sec('节奏', fieldRow('节奏', gnum(2, { min: 50, max: 150 }))),
      sec('平衡', fieldRow('平衡', gnum(3, { min: 0, max: 100 }))),
    ],
    defaults: { 1: 100, 2: 100, 3: 50 },
  },
  [Cmd.ChangeSystemGraphics]: {
    text: { label: '系统图像文件' },
    sections: [
      sec('选项', checkRow(0, '平铺显示')),
      sec(
        '字体',
        radio(1, [{ value: 0, label: 'MS Gothic' }, { value: 1, label: 'MS Mincho' }]),
      ),
    ],
  },
  [Cmd.ChangeScreenTransitions]: {
    sections: [
      sec(
        '场合',
        fieldRow(
          '场合',
          gsel(0, {
            0: '地图切换前',
            1: '地图切换后',
            2: '进入战斗前',
            3: '进入战斗后',
            4: '离开战斗前',
            5: '离开战斗后',
          }),
        ),
      ),
      sec(
        '转场',
        fieldRow(
          '转场',
          gsel(1, {
            0: '默认',
            1: '淡入淡出',
            2: '块',
            3: '向下',
            4: '向上',
            5: '百叶窗 A',
            6: '百叶窗 B',
            7: '百叶窗 C',
            8: '缩放进入',
            9: '缩放退出',
            10: '上下移动',
            11: '下上移动',
            12: '左右移动',
            13: '右左移动',
            14: '纵向重叠',
            15: '横向重叠',
            16: '四分割',
            17: '放大',
            18: '碎片',
            19: '雾',
            20: 'null',
            21: '无',
          }),
        ),
      ),
    ],
  },
};


const PAGE_2: Record<number, DialogSpec> = {
  [Cmd.EnemyEncounter]: {
    rows: [
      row(undefined, chk(0, '敌群由变量指定')),
      when(row('敌群', num(1, undefined, { min: 1 })), 0, [0]),
      when(row('变量', ref(1, 'variable')), 0, [1]),
      row(
        '战斗背景',
        sel(2, { 0: '使用地图设置', 1: '指定背景', 2: '按地形' }),
      ),
      when(row('地形', ref(8, 'terrain')), 2, [2]),
      row('可逃跑', sel(3, { 0: '禁止', 1: '中断事件', 2: '执行逃跑处理' })),
      row('失败时', sel(4, { 0: '游戏结束', 1: '执行失败处理' })),
      row(undefined, chk(5, '先制攻击')),
      row(
        '战斗模式',
        sel(6, { 0: '普通', 1: '先制', 2: '包围', 3: '背后', 4: '夹击' }),
      ),
      row('阵型', num(7, undefined, { min: 0 })),
    ],
    paramCount: 9,
  },
  [Cmd.OpenShop]: {
    rows: [
      row('交易', sel(0, { 0: '买卖', 1: '只买', 2: '只卖' })),
      row('商店', sel(1, { 0: '商店 A', 1: '商店 B', 2: '商店 C' })),
      row(undefined, chk(2, '使用内嵌商品')),
    ],
  },
  [Cmd.ShowInn]: {
    rows: [
      row(undefined, chk(0, '2k3 旅馆')),
      row('价格', num(1, undefined, { min: 0 })),
      row(undefined, chk(2, '使用内嵌设置')),
    ],
  },
  [Cmd.EnterHeroName]: {
    rows: [
      row('角色', ref(0, 'actor')),
      row(undefined, chk(1, '使用第二套字符')),
      row(undefined, chk(2, '显示原名')),
    ],
  },
  [Cmd.Teleport]: {
    rows: [row('地图', ref(0, 'map')), row('X', num(1)), row('Y', num(2))],
  },
  [Cmd.MemorizeLocation]: {
    rows: [
      row('地图变量', ref(0, 'variable')),
      row('X 变量', ref(1, 'variable')),
      row('Y 变量', ref(2, 'variable')),
    ],
  },
  [Cmd.RecallToLocation]: {
    rows: [
      row('地图变量', ref(0, 'variable')),
      row('X 变量', ref(1, 'variable')),
      row('Y 变量', ref(2, 'variable')),
    ],
  },
  [Cmd.EnterExitVehicle]: { rows: [] },
  [Cmd.SetVehicleLocation]: {
    rows: [
      row('载具', sel(0, VEHICLE)),
      row(undefined, chk(1, '坐标由变量指定')),
      when(row('地图', ref(2, 'map')), 1, [0]),
      when(row('地图变量', ref(2, 'variable')), 1, [1]),
      when(row('X', num(3)), 1, [0]),
      when(row('X 变量', ref(3, 'variable')), 1, [1]),
      when(row('Y', num(4)), 1, [0]),
      when(row('Y 变量', ref(4, 'variable')), 1, [1]),
      row('朝向', sel(5, DIRECTION)),
    ],
  },
  [Cmd.ChangeEventLocation]: {
    rows: [
      row('事件', ref(0, 'event')),
      row(undefined, chk(1, '坐标由变量指定')),
      when(row('X', num(2)), 1, [0]),
      when(row('X 变量', ref(2, 'variable')), 1, [1]),
      when(row('Y', num(3)), 1, [0]),
      when(row('Y 变量', ref(3, 'variable')), 1, [1]),
      row('朝向', sel(4, DIRECTION)),
    ],
  },
  [Cmd.TradeEventLocations]: {
    rows: [row('事件 A', ref(0, 'event')), row('事件 B', ref(1, 'event'))],
  },
  [Cmd.StoreTerrainID]: {
    rows: [
      row(undefined, chk(0, '坐标由变量指定')),
      when(row('X', num(1)), 0, [0]),
      when(row('X 变量', ref(1, 'variable')), 0, [1]),
      when(row('Y', num(2)), 0, [0]),
      when(row('Y 变量', ref(2, 'variable')), 0, [1]),
      row('结果变量', ref(3, 'variable')),
    ],
  },
  [Cmd.StoreEventID]: {
    rows: [
      row(undefined, chk(0, '坐标由变量指定')),
      when(row('X', num(1)), 0, [0]),
      when(row('X 变量', ref(1, 'variable')), 0, [1]),
      when(row('Y', num(2)), 0, [0]),
      when(row('Y 变量', ref(2, 'variable')), 0, [1]),
      row('结果变量', ref(3, 'variable')),
    ],
  },
  [Cmd.EraseScreen]: {
    rows: [row('转场', num(0, undefined, { min: 0, max: 21 }))],
  },
  [Cmd.ShowScreen]: {
    rows: [row('转场', num(0, undefined, { min: 0, max: 21 }))],
  },
  [Cmd.TintScreen]: {
    rows: [
      row('红', num(0, undefined, { min: -255, max: 255 })),
      row('绿', num(1, undefined, { min: -255, max: 255 })),
      row('蓝', num(2, undefined, { min: -255, max: 255 })),
      row('饱和度', num(3, undefined, { min: 0, max: 200 })),
      row('时间', num(4, undefined, { min: 0, suffix: '×0.1 秒' })),
      row(undefined, chk(5, '等待完成')),
    ],
    defaults: { 0: 100, 1: 100, 2: 100, 3: 100 },
  },
  [Cmd.FlashScreen]: {
    rows: [
      row('红', num(0, undefined, { min: 0, max: 31 })),
      row('绿', num(1, undefined, { min: 0, max: 31 })),
      row('蓝', num(2, undefined, { min: 0, max: 31 })),
      row('强度', num(3, undefined, { min: 0, max: 31 })),
      row('时间', num(4, undefined, { min: 0, suffix: '×0.1 秒' })),
      row(undefined, chk(5, '等待完成')),
      row('模式', sel(6, FLASH_MODE)),
    ],
    defaults: { 0: 31, 1: 31, 2: 31, 3: 31 },
  },
  [Cmd.ShakeScreen]: {
    rows: [
      row('强度', num(0, undefined, { min: 1, max: 9 })),
      row('速度', num(1, undefined, { min: 1, max: 9 })),
      row('时间', num(2, undefined, { min: 0, suffix: '×0.1 秒' })),
      row(undefined, chk(3, '等待完成')),
      row('模式', sel(4, FLASH_MODE)),
    ],
    defaults: { 0: 3, 1: 3, 2: 10 },
  },
  [Cmd.PanScreen]: {
    rows: [
      row(
        '模式',
        sel(0, {
          0: '锁定镜头',
          1: '解除锁定',
          2: '线性移动镜头',
          3: '线性跟随玩家',
        }),
      ),
      when(row('方向', sel(1, { 0: '上', 1: '右', 2: '下', 3: '左' })), 0, [2]),
      when(row('距离', num(2, undefined, { suffix: '格' })), 0, [2]),
      when(row('速度', num(3, undefined, { min: 1, max: 6 })), 0, [2, 3]),
      when(row(undefined, chk(4, '等待完成')), 0, [2, 3]),
    ],
  },
  [Cmd.WeatherEffects]: {
    rows: [
      row(
        '天气',
        sel(0, { 0: '无', 1: '雨', 2: '雪', 3: '雾（2k3）', 4: '沙尘暴（2k3）' }),
      ),
      row('强度', sel(1, { 0: '弱', 1: '中', 2: '强' })),
    ],
  },
  [Cmd.ShowPicture]: {
    text: { label: '图片文件' },
    rows: [
      row('图片编号', num(0, undefined, { min: 1, max: 50 })),
      row(undefined, chk(1, '坐标由变量指定')),
      when(row('X', num(2)), 1, [0]),
      when(row('X 变量', ref(2, 'variable')), 1, [1]),
      when(row('Y', num(3)), 1, [0]),
      when(row('Y 变量', ref(3, 'variable')), 1, [1]),
      row(undefined, chk(4, '固定在地图上')),
      row('混合模式', chk(7, '使用颜色遮罩')),
      row('红', num(8, undefined, { min: 0, max: 200 })),
      row('绿', num(9, undefined, { min: 0, max: 200 })),
      row('蓝', num(10, undefined, { min: 0, max: 200 })),
      row('饱和度', num(11, undefined, { min: 0, max: 200 })),
      row('效果', sel(12, PICTURE_EFFECT)),
    ],
    defaults: { 8: 100, 9: 100, 10: 100, 11: 100 },
    paramCount: 13,
  },
  [Cmd.MovePicture]: {
    rows: [
      row('图片编号', num(0, undefined, { min: 1, max: 50 })),
      row(undefined, chk(1, '坐标由变量指定')),
      when(row('X', num(2)), 1, [0]),
      when(row('X 变量', ref(2, 'variable')), 1, [1]),
      when(row('Y', num(3)), 1, [0]),
      when(row('Y 变量', ref(3, 'variable')), 1, [1]),
      row(undefined, chk(4, '固定在地图上')),
      row('时间', num(14, undefined, { min: 0, suffix: '×0.1 秒' })),
      row(undefined, chk(15, '等待完成')),
    ],
    paramCount: 16,
  },
  [Cmd.ErasePicture]: {
    rows: [row('图片编号', num(0, undefined, { min: 1, max: 50 }))],
    paramCount: 1,
  },
  [Cmd.ShowBattleAnimation]: {
    rows: [
      row('动画', ref(0, 'animation')),
      row('对象', ref(1, 'event')),
      row(undefined, chk(2, '等待完成')),
      row(undefined, chk(3, '全屏')),
    ],
  },
  [Cmd.PlayerVisibility]: { rows: [row(undefined, chk(0, '显示玩家'))] },
  [Cmd.FlashSprite]: {
    rows: [
      row('对象', ref(0, 'event')),
      row('红', num(1, undefined, { min: 0, max: 31 })),
      row('绿', num(2, undefined, { min: 0, max: 31 })),
      row('蓝', num(3, undefined, { min: 0, max: 31 })),
      row('强度', num(4, undefined, { min: 0, max: 31 })),
      row('时间', num(5, undefined, { min: 0, suffix: '×0.1 秒' })),
      row(undefined, chk(6, '等待完成')),
    ],
    defaults: { 1: 31, 2: 31, 3: 31, 4: 31 },
  },
  [Cmd.MoveEvent]: {
    rows: [
      row('对象', ref(0, 'event')),
      row('移动频率', num(1, undefined, { min: 1, max: 8 })),
      row(undefined, chk(2, '重复')),
      row(undefined, chk(3, '忽略障碍')),
    ],
    note: '移动路线编辑器待接入',
  },
  [Cmd.ProceedWithMovement]: { rows: [] },
  [Cmd.HaltAllMovement]: { rows: [] },
  [Cmd.Wait]: {
    rows: [
      row('时长', num(0, undefined, { min: 0, suffix: '×0.1 秒' })),
      row(undefined, chk(1, '等待按键')),
    ],
    defaults: { 0: 10 },
    paramCount: 2,
  },
};

const PAGE_3: Record<number, DialogSpec> = {
  [Cmd.PlayBGM]: {
    text: { label: 'BGM 文件' },
    rows: [
      row('淡入时间', num(0, undefined, { min: 0, suffix: '×0.1 秒' })),
      row('音量', num(1, undefined, { min: 0, max: 100 })),
      row('节奏', num(2, undefined, { min: 50, max: 150 })),
      row('平衡', num(3, undefined, { min: 0, max: 100 })),
    ],
    defaults: { 1: 100, 2: 100, 3: 50 },
  },
  [Cmd.FadeOutBGM]: {
    rows: [row('淡出时间', num(0, undefined, { min: 0, suffix: '×0.1 秒' }))],
  },
  [Cmd.MemorizeBGM]: { rows: [] },
  [Cmd.PlayMemorizedBGM]: { rows: [] },
  [Cmd.PlaySound]: {
    text: { label: 'SE 文件' },
    rows: [
      row('音量', num(0, undefined, { min: 0, max: 100 })),
      row('节奏', num(1, undefined, { min: 50, max: 150 })),
      row('平衡', num(2, undefined, { min: 0, max: 100 })),
    ],
    defaults: { 0: 100, 1: 100, 2: 50 },
  },
  [Cmd.PlayMovie]: {
    text: { label: '影片文件' },
    rows: [
      row(undefined, chk(0, '坐标由变量指定')),
      when(row('X', num(1)), 0, [0]),
      when(row('X 变量', ref(1, 'variable')), 0, [1]),
      when(row('Y', num(2)), 0, [0]),
      when(row('Y 变量', ref(2, 'variable')), 0, [1]),
      row('宽度', num(3, undefined, { min: 0 })),
      row('高度', num(4, undefined, { min: 0 })),
    ],
  },
  [Cmd.KeyInputProc]: {
    rows: [
      row('变量', ref(0, 'variable')),
      row('等待', num(1, undefined, { suffix: '×0.1 秒' })),
      row(undefined, chk(3, '检查决定键')),
      row(undefined, chk(4, '检查取消键')),
    ],
  },
  [Cmd.ChangeMapTileset]: { rows: [row('图块集', ref(0, 'tileset'))] },
  [Cmd.ChangePBG]: {
    text: { label: '远景文件' },
    rows: [
      row(undefined, chk(0, '横向滚动')),
      row(undefined, chk(1, '纵向滚动')),
      row(undefined, chk(2, '横向自动滚动')),
      row('横向速度', num(3)),
      row(undefined, chk(4, '纵向自动滚动')),
      row('纵向速度', num(5)),
    ],
  },
  [Cmd.ChangeEncounterSteps]: {
    rows: [row('遭遇概率', num(0, undefined, { min: 0, max: 999 }))],
  },
  [Cmd.TileSubstitution]: {
    rows: [
      row(undefined, chk(0, '上层图块')),
      row('图块 A', num(1)),
      row('图块 B', num(2)),
    ],
  },
  [Cmd.TeleportTargets]: {
    rows: [
      row('操作', sel(0, { 0: '设置', 1: '删除' })),
      row('地图', ref(1, 'map')),
      row('X', num(2)),
      row('Y', num(3)),
      row(undefined, chk(4, '需要开关')),
    ],
  },
  [Cmd.ChangeTeleportAccess]: { rows: [row(undefined, chk(0, '允许传送'))] },
  [Cmd.EscapeTarget]: {
    rows: [
      row('地图', ref(0, 'map')),
      row('X', num(1)),
      row('Y', num(2)),
      row(undefined, chk(3, '使用开关')),
      row('开关', ref(4, 'switch')),
    ],
  },
  [Cmd.ChangeEscapeAccess]: { rows: [row(undefined, chk(0, '允许逃跑'))] },
  [Cmd.OpenSaveMenu]: { rows: [] },
  [Cmd.ChangeSaveAccess]: { rows: [row(undefined, chk(0, '允许存档'))] },
  [Cmd.OpenMainMenu]: { rows: [] },
  [Cmd.ChangeMainMenuAccess]: { rows: [row(undefined, chk(0, '允许打开选单'))] },
  [Cmd.ConditionalBranch]: {
    rows: [
      row(
        '条件类型',
        sel(0, {
          0: '开关',
          1: '变量',
          2: '计时器 1',
          3: '金钱',
          4: '道具',
          5: '角色',
          6: '朝向',
          7: '乘坐交通工具',
          8: '按键初始化',
          9: 'BGM 循环',
          10: '计时器 2',
          11: '2k3 其他',
        }),
      ),
      when(row('开关', ref(1, 'switch')), 0, [0]),
      when(row(undefined, chk(2, '反转结果')), 0, [0]),
      when(row('变量', ref(1, 'variable')), 0, [1]),
      // 变量比较的 LCF 布局：p2 = 操作数类型，p3 = 数值 / 变量编号，p4 = 比较符
      when(row('操作数', sel(2, OPERAND)), 0, [1]),
      when(row('数值', num(3)), 0, [1]),
      when(row('比较', sel(4, COMPARE)), 0, [1]),
      when(row('时间', num(1, undefined, { suffix: '秒' })), 0, [2, 10]),
      when(row('比较', sel(2, { 0: '大于等于', 1: '小于等于' })), 0, [2, 10]),
      when(row('金钱', num(1, undefined, { min: 0 })), 0, [3]),
      when(row('比较', sel(2, COMPARE)), 0, [3]),
      when(row('道具', ref(1, 'item')), 0, [4]),
      when(row('条件', sel(2, { 0: '持有', 1: '未持有' })), 0, [4]),
      when(row('角色', ref(1, 'actor')), 0, [5]),
      when(
        row(
          '判定',
          sel(2, {
            0: '在队伍中',
            1: '名字等于',
            2: '等级不低于',
            3: 'HP 不低于',
            4: '掌握技能',
            5: '装备中',
            6: '处于状态',
          }),
        ),
        0,
        [5],
      ),
      when(row('参数', num(3)), 0, [5]),
      when(row('角色', ref(1, 'event')), 0, [6]),
      when(row('朝向', sel(2, DIRECTION)), 0, [6]),
      when(row('载具', sel(1, VEHICLE)), 0, [7]),
      when(row('属性', num(1)), 0, [11]),
      when(row('比较', sel(2, COMPARE)), 0, [11]),
    ],
    paramCount: 5,
  },
  [Cmd.Label]: { rows: [row('标签编号', num(0, undefined, { min: 1 }))] },
  [Cmd.JumpToLabel]: { rows: [row('标签编号', num(0, undefined, { min: 1 }))] },
  [Cmd.Loop]: { rows: [] },
  [Cmd.BreakLoop]: { rows: [] },
  [Cmd.EndEventProcessing]: { rows: [] },
  [Cmd.EraseEvent]: { rows: [] },
  [Cmd.CallEvent]: {
    rows: [
      row('类型', sel(0, { 0: '公共事件', 1: '地图事件', 2: '间接指定' })),
      when(row('公共事件', ref(1, 'commonEvent')), 0, [0]),
      when(row('事件', ref(1, 'event')), 0, [1]),
      when(row('页面', num(2, undefined, { min: 0 })), 0, [1]),
      when(row('变量', ref(1, 'variable')), 0, [2]),
      when(row('页面变量', ref(2, 'variable')), 0, [2]),
    ],
    paramCount: 3,
  },
  [Cmd.Comment]: { text: { label: '注释', rows: 4 }, rows: [] },
  [Cmd.GameOver]: { rows: [] },
  [Cmd.ReturntoTitleScreen]: { rows: [] },
};

const PAGE_4: Record<number, DialogSpec> = {
  [Cmd.ChangeClass]: {
    rows: [
      ...actorTargets(),
      row('职业', ref(2, 'class')),
      row(undefined, chk(3, '等级降为 1')),
      row('技能', sel(4, { 0: '不变', 1: '替换', 2: '追加' })),
      row(
        '能力值',
        sel(5, { 0: '不变', 1: '减半', 2: '1 级数值', 3: '当前等级数值' }),
      ),
      row(undefined, chk(6, '显示职业变更')),
    ],
  },
  [Cmd.ChangeBattleCommands]: {
    rows: [
      ...actorTargets(),
      row('战斗指令', ref(2, 'battleCommand')),
      row(undefined, chk(3, '追加')),
    ],
  },
  [Cmd.OpenLoadMenu]: { rows: [] },
  [Cmd.ExitGame]: { rows: [] },
  [Cmd.ToggleAtbMode]: { rows: [] },
  [Cmd.ToggleFullscreen]: { rows: [] },
  [Cmd.OpenVideoOptions]: { rows: [] },
};

/** 敌群事件（战斗）专用指令 */
const BATTLE: Record<number, DialogSpec> = {
  [Cmd.ChangeMonsterHP]: {
    rows: [
      row('敌人编号', num(0, undefined, { min: 1 })),
      row('操作', sel(1, { 0: '恢复', 1: '伤害' })),
      row('方式', sel(2, { 0: '直接', 1: '变量', 2: '当前 HP 百分比' })),
      when(row('数值', num(3, undefined, { min: 0 })), 2, [0]),
      when(row('变量', ref(3, 'variable')), 2, [1]),
      when(row('百分比', num(3, undefined, { min: 0, max: 100, suffix: '%' })), 2, [2]),
    ],
    paramCount: 5,
  },
  [Cmd.ChangeMonsterMP]: {
    rows: [
      row('敌人编号', num(0, undefined, { min: 1 })),
      row('操作', sel(1, ADD_REMOVE)),
      row(undefined, chk(2, '数值由变量指定')),
      when(row('数值', num(3, undefined, { min: 0 })), 2, [0]),
      when(row('变量', ref(3, 'variable')), 2, [1]),
    ],
  },
  [Cmd.ChangeMonsterCondition]: {
    rows: [
      row('敌人编号', num(0, undefined, { min: 1 })),
      row('操作', sel(1, { 0: '附加', 1: '解除' })),
      row('状态', ref(2, 'state')),
    ],
  },
  [Cmd.ChangeBattleBG]: {
    text: { label: '战斗背景文件' },
    rows: [],
  },
  [Cmd.ShowBattleAnimationB]: {
    rows: [
      row('动画', ref(0, 'animation')),
      row('目标编号', num(1, undefined, { min: 0 })),
      row(undefined, chk(2, '等待完成')),
      row(undefined, chk(3, '全体角色')),
    ],
  },
  [Cmd.EnableCombo]: {
    rows: [
      row('角色', ref(0, 'actor')),
      row('战斗指令', ref(1, 'battleCommand')),
      row('次数', num(2, undefined, { min: 1 })),
    ],
  },
  [Cmd.ForceFlee]: {
    rows: [
      row('方式', sel(0, { 0: '逃跑', 1: '秒杀全体并胜利', 2: '秒杀单个并胜利' })),
      when(row('敌人编号', num(1, undefined, { min: 1 })), 0, [2]),
      row(undefined, chk(2, '无视条件')),
    ],
  },
  [Cmd.ConditionalBranchB]: {
    rows: [
      row(
        '条件类型',
        sel(0, {
          0: '开关',
          1: '变量',
          2: '角色可行动',
          3: '敌人可行动',
          4: '目标敌人是',
          5: '角色上次指令',
        }),
      ),
      when(row('开关', ref(1, 'switch')), 0, [0]),
      when(row(undefined, chk(2, '反转结果')), 0, [0]),
      when(row('变量', ref(1, 'variable')), 0, [1]),
      when(row(undefined, chk(2, '比较对象为变量')), 0, [1]),
      when(row('数值', num(3)), 0, [1]),
      when(row('比较', sel(4, COMPARE)), 0, [1]),
      when(row('角色', ref(1, 'actor')), 0, [2, 5]),
      when(row('敌人编号', num(1, undefined, { min: 1 })), 0, [3, 4]),
      when(row('战斗指令', ref(2, 'battleCommand')), 0, [5]),
    ],
    paramCount: 5,
  },
  [Cmd.CallCommonEvent]: {
    rows: [row('公共事件', ref(0, 'commonEvent'))],
  },
  [Cmd.TerminateBattle]: { rows: [] },
};

export const COMMAND_DIALOGS: Record<number, DialogSpec> = {
  ...PAGE_1,
  ...PAGE_1_V2,
  ...PAGE_2,
  ...PAGE_3,
  ...PAGE_4,
  ...BATTLE,
};
