import { Cmd } from './commandCodes';
import type { CommandLine } from './eventCommands';

/**
 * 事件指令的显示摘要。
 *
 * 移植自 EasyRPG Editor 的 `Stringizer`：列表里每条指令显示为
 *   中文指令名: 参数摘要
 * 参数按语义拆成片段，便于着色、复制以及后续做符号查找 / 跳转。
 * 数据库对象暂时只显示 ID（形如 开关[0001]），接入数据库后再补名字。
 */

export type DisplayTone =
  | 'name'
  | 'punct'
  | 'number'
  | 'string'
  | 'keyword'
  | 'variable'
  | 'switch'
  | 'database'
  | 'time';

export type RefKind =
  | 'switch'
  | 'variable'
  | 'item'
  | 'actor'
  | 'class'
  | 'state'
  | 'skill'
  | 'battleCommand'
  | 'animation'
  | 'troop'
  | 'terrain'
  | 'map'
  | 'event'
  | 'commonEvent'
  | 'label';

/** 数据库引用：为后续符号查找保留目标 */
export interface DisplayRef {
  kind: RefKind;
  id: number;
}

export interface DisplaySegment {
  text: string;
  tone: DisplayTone;
  ref?: DisplayRef;
}

export interface CommandDisplay {
  /** 中文指令名 */
  name: string;
  /** 冒号之后的摘要片段 */
  segments: DisplaySegment[];
}

const seg = (text: string, tone: DisplayTone, ref?: DisplayRef): DisplaySegment => ({
  text,
  tone,
  ref,
});

const pad4 = (id: number) => String(id).padStart(4, '0');
const num = (value: number) => seg(String(value), 'number');
const kw = (value: string) => seg(value, 'keyword');
const str = (value: string) => seg(value, 'string');
const sep = (value = ', ') => seg(value, 'punct');

const variable = (id: number) => seg(`变量[${pad4(id)}]`, 'variable', { kind: 'variable', id });
const switchRef = (id: number) =>
  seg(`开关[${pad4(id)}]`, 'switch', { kind: 'switch', id });
const dbRef = (label: string, kind: RefKind, id: number, prefix = '') =>
  seg(`${prefix}${label}[${pad4(id)}]`, 'database', { kind, id });

const valueOrVariable = (isVariable: number, value: number) =>
  isVariable ? variable(value) : num(value);

const heroes = (mode: number, id: number): DisplaySegment => {
  switch (mode) {
    case 0:
      return kw('全体队友');
    case 1:
      return dbRef('角色', 'actor', id);
    case 2:
      return seg(`角色 变量[${pad4(id)}]`, 'variable', { kind: 'variable', id });
    default:
      return kw('未知');
  }
};

const characterName = (id: number): DisplaySegment => {
  switch (id) {
    case 10001:
      return kw('主角');
    case 10002:
      return kw('小船');
    case 10003:
      return kw('大船');
    case 10004:
      return kw('飞艇');
    case 10005:
      return kw('本事件');
    default:
      return dbRef('事件', 'event', id);
  }
};

const mapRef = (id: number) => dbRef('地图', 'map', id);
const vehicleName = (id: number) => ['小船', '大船', '飞艇'][id] ?? '未知';
const tenthSeconds = (value: number) => seg(`${(value / 10).toFixed(1)}s`, 'time');
const formatTime = (seconds: number) =>
  seg(`${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`, 'time');

const DIRECTIONS = ['上', '右', '下', '左', '右上', '右下', '左下', '左上'];
const directionName = (id: number) => DIRECTIONS[id] ?? '未知';

const ERASE_TRANSITIONS = [
  '淡出',
  '随机块',
  '随机块（上）',
  '随机块（下）',
  '百叶窗关闭',
  '纵向条纹',
  '横向条纹',
  '边框向内',
  '向上滚动',
  '向下滚动',
  '向左滚动',
  '纵向分割',
  '横向分割',
  '十字分割',
  '缩放',
  '马赛克',
  '波浪',
  '瞬间',
];
const SHOW_TRANSITIONS = [
  '淡入',
  '随机块',
  '随机块（上）',
  '随机块（下）',
  '百叶窗打开',
  '纵向条纹',
  '横向条纹',
  '边框向内',
  '中心向外',
  '向上滚动',
  '向下滚动',
  '向左滚动',
  '纵向合并',
  '横向合并',
  '十字合并',
  '缩放',
  '马赛克',
  '波浪',
  '瞬间',
];

const eraseTransition = (id: number) =>
  id < 0 ? kw('使用默认') : kw(ERASE_TRANSITIONS[id] ?? '未知');
const showTransition = (id: number) =>
  id < 0 ? kw('使用默认') : kw(SHOW_TRANSITIONS[id] ?? '未知');

const WEATHER_TYPES = ['无', '雨', '雪', '雾', '沙尘暴'];
const WEATHER_STRENGTH = ['弱', '中', '强'];

const SYSTEM_BGM_CONTEXTS = ['战斗', '胜利', '旅馆', '小船', '大船', '飞艇', '游戏结束'];
const SYSTEM_SFX = [
  '光标',
  '决定',
  '取消',
  '蜂鸣',
  '战斗开始',
  '逃跑',
  '敌人攻击',
  '敌人受伤',
  '同伴受伤',
  '回避',
  '敌人被击败',
  '使用道具',
];

/** 移动路线的命令名（EasyRPG MoveCommand 的前半部分常用命令） */
const MOVE_COMMANDS: Record<number, string> = {
  0: '向上移动',
  1: '向右移动',
  2: '向下移动',
  3: '向左移动',
  4: '向右上移动',
  5: '向右下移动',
  6: '向左下移动',
  7: '向左上移动',
  8: '随机移动',
  9: '接近主角',
  10: '远离主角',
  11: '向前移动',
  12: '面朝上',
  13: '面朝右',
  14: '面朝下',
  15: '面朝左',
  16: '右转 90°',
  17: '左转 90°',
  18: '转身 180°',
  19: '随机转向 90°',
  20: '随机朝向',
  21: '面向主角',
  22: '背对主角',
  23: '等待',
  24: '开始跳跃',
  25: '结束跳跃',
  26: '锁定朝向',
  27: '解除锁定朝向',
  28: '移动速度提升',
  29: '移动速度降低',
  30: '移动频率提升',
  31: '移动频率降低',
  32: '开关 ON',
  33: '开关 OFF',
  34: '更改图像',
  35: '播放 SE',
  36: '允许穿透',
  37: '禁止穿透',
  38: '停止动画',
  39: '开始动画',
  40: '透明度提升',
  41: '透明度降低',
};

const moveCommandName = (id: number) => MOVE_COMMANDS[id] ?? `移动命令 ${id}`;

/** 把参数按「数字, 数字, …」平铺，给没有专门摘要的指令兜底 */
function plainParams(values: number[]): DisplaySegment[] {
  const result: DisplaySegment[] = [];
  values.forEach((value, index) => {
    if (index > 0) result.push(sep());
    result.push(num(value));
  });
  return result;
}

/**
 * 生成一条指令的显示摘要。
 * 有专门实现的指令按 EasyRPG Editor 的格式展开，其余用裸参数兜底。
 */
export function buildCommandDisplay(line: CommandLine): CommandDisplay {
  const p = line.params;
  const at = (index: number) => p[index] ?? 0;
  const text = line.text ?? '';
  const display = (...segments: DisplaySegment[]): CommandDisplay => ({
    name: line.name,
    segments,
  });

  switch (line.code) {
    // ── 消息 / 选项 / 输入 ──────────────────────────────
    case Cmd.MessageOptions:
      return display(
        kw(at(0) ? '透明' : '普通'),
        sep(),
        kw(['上', '中', '下'][at(1)] ?? '未知'),
        sep(),
        kw(at(2) ? '自动' : '固定'),
        sep(),
        kw(at(3) ? '继续处理' : '停止处理'),
      );

    case Cmd.ChangeFaceGraphic:
      return display(
        str(text),
        sep(),
        num(at(0)),
        sep(),
        // p1 = face_right（与 schema / 对话框的「显示在右侧」一致）
        kw(at(1) ? '右' : '左'),
        ...(at(2) ? [sep(), kw('翻转')] : []),
      );

    case Cmd.InputNumber:
      return display(num(at(0)), kw(' 位'), sep(), variable(at(1)));

    // ── 开关 / 变量 / 计时器 ────────────────────────────
    case Cmd.ControlSwitches: {
      const target =
        at(0) === 0
          ? switchRef(at(1))
          : at(0) === 1
            ? seg(`开关[${pad4(at(1))}-${pad4(at(2))}]`, 'switch', {
                kind: 'switch',
                id: at(1),
              })
            : seg(`开关[V${pad4(at(1))}]`, 'switch', { kind: 'variable', id: at(1) });
      return display(
        target,
        seg(' ', 'punct'),
        kw(['开', '关', '切换'][at(3)] ?? '未知'),
      );
    }

    case Cmd.ControlVars: {
      const target =
        at(0) === 0
          ? variable(at(1))
          : at(0) === 1
            ? seg(`变量[${pad4(at(1))}-${pad4(at(2))}]`, 'variable', {
                kind: 'variable',
                id: at(1),
              })
            : seg(`变量[V${pad4(at(1))}]`, 'variable', { kind: 'variable', id: at(1) });
      const operator = ['=', '+', '-', '*', '/', '%'][at(3)] ?? '?';
      const operand = controlVarOperand(at(4), at(5), at(6));
      return display(target, seg(` ${operator} `, 'punct'), ...operand);
    }

    case Cmd.TimerOperation: {
      const label = p.length <= 5 ? 1 : at(5) + 1;
      return {
        name: `计时器 ${label} 操作`,
        segments:
          at(0) === 0
            ? [
                kw('设置'),
                seg(' ', 'punct'),
                at(1) ? variable(at(2)) : formatTime(at(2)),
              ]
            : at(0) === 1
              ? [kw('开始')]
              : at(0) === 2
                ? [kw('停止')]
                : [kw('未知')],
      };
    }

    // ── 金钱 / 道具 / 队伍 ──────────────────────────────
    case Cmd.ChangeGold:
      return display(
        seg(at(0) ? '-' : '+', 'punct'),
        valueOrVariable(at(1), at(2)),
      );

    case Cmd.ChangeItems:
      return display(
        seg(at(0) ? '-' : '+', 'punct'),
        seg(' ', 'punct'),
        ...(at(1)
          ? [variable(at(2))]
          : [dbRef('物品', 'item', at(2))]),
        sep(),
        valueOrVariable(at(3), at(4)),
      );

    case Cmd.ChangePartyMembers:
      return display(
        kw(at(0) ? '移除' : '加入'),
        seg(' ', 'punct'),
        at(1) ? variable(at(2)) : dbRef('角色', 'actor', at(2)),
      );

    case Cmd.ChangeExp:
    case Cmd.ChangeLevel:
      return display(
        heroes(at(0), at(1)),
        sep(),
        seg(at(2) ? '-' : '+', 'punct'),
        valueOrVariable(at(3), at(4)),
      );

    case Cmd.ChangeParameters:
      return display(
        heroes(at(0), at(1)),
        sep(),
        kw(['最大 HP', '最大 MP', '攻击', '防御', '精神', '敏捷'][at(3)] ?? '未知'),
        seg(' ', 'punct'),
        seg(at(2) ? '-' : '+', 'punct'),
        valueOrVariable(at(4), at(5)),
      );

    case Cmd.ChangeSkills:
      return display(
        heroes(at(0), at(1)),
        sep(),
        kw(at(2) ? '移除' : '习得'),
        seg(' ', 'punct'),
        at(3) ? variable(at(4)) : dbRef('技能', 'skill', at(4)),
      );

    case Cmd.ChangeEquipment: {
      const equip = at(2);
      const slot = ['武器', '盾牌', '护甲', '头盔', '饰品', '全部'][at(4)] ?? '未知';
      return display(
        heroes(at(0), at(1)),
        sep(),
        kw(equip ? '装备' : '卸下'),
        seg(' ', 'punct'),
        equip ? kw(slot) : at(3) ? variable(at(4)) : dbRef('物品', 'item', at(4)),
      );
    }

    case Cmd.ChangeHP:
    case Cmd.ChangeSP:
      return display(
        heroes(at(0), at(1)),
        sep(),
        seg(at(2) ? '-' : '+', 'punct'),
        valueOrVariable(at(3), at(4)),
      );

    case Cmd.ChangeCondition:
      return display(
        heroes(at(0), at(1)),
        sep(),
        kw(at(2) ? '附加' : '解除'),
        seg(' ', 'punct'),
        dbRef('状态', 'state', at(3)),
      );

    case Cmd.FullHeal:
    case Cmd.SimulatedAttack:
      return display(heroes(at(0), at(1)));

    // ── 角色外观 / 系统资源 ─────────────────────────────
    case Cmd.ChangeHeroName:
      return display(dbRef('角色', 'actor', at(0)), seg(' → ', 'punct'), str(text));

    case Cmd.ChangeHeroTitle:
      return display(dbRef('角色', 'actor', at(0)), sep(), str(text));

    case Cmd.ChangeSpriteAssociation:
      return display(
        dbRef('角色', 'actor', at(0)),
        sep(),
        str(text),
        seg('-', 'punct'),
        num(at(1)),
      );

    case Cmd.ChangeActorFace:
      return display(
        dbRef('角色', 'actor', at(0)),
        sep(),
        str(text),
        seg('-', 'punct'),
        num(at(1)),
      );

    case Cmd.ChangeVehicleGraphic:
      return display(
        kw(vehicleName(at(0))),
        sep(),
        str(text),
        seg('-', 'punct'),
        num(at(1)),
      );

    case Cmd.ChangeSystemBGM:
      return display(kw(SYSTEM_BGM_CONTEXTS[at(0)] ?? '未知'), sep(), str(text));

    case Cmd.ChangeSystemSFX:
      return display(kw(SYSTEM_SFX[at(0)] ?? '未知'), sep(), str(text));

    case Cmd.ChangeSystemGraphics:
      return display(str(text));

    case Cmd.ChangeScreenTransitions:
      return display(at(0) ? showTransition(at(1)) : eraseTransition(at(1)));

    // ── 场景 ────────────────────────────────────────────
    case Cmd.EnemyEncounter:
      return display(
        at(0) ? variable(at(1)) : dbRef('敌群', 'troop', at(1)),
      );

    case Cmd.OpenShop:
      return display(kw(['买卖', '买', '卖'][at(0)] ?? '未知'));

    case Cmd.ShowInn:
      return display(kw('价格'), seg(' ', 'punct'), num(at(1)));

    case Cmd.EnterHeroName:
      return display(dbRef('角色', 'actor', at(0)));

    // ── 位置 / 载具 ─────────────────────────────────────
    case Cmd.Teleport:
      return display(
        mapRef(at(0)),
        seg(' (', 'punct'),
        num(at(1)),
        seg(',', 'punct'),
        num(at(2)),
        seg(')', 'punct'),
        sep(),
        kw(at(3) >= 0 && at(3) <= 3 ? directionName(at(3)) : '保持朝向'),
      );

    case Cmd.MemorizeLocation:
      return display(variable(at(0)), sep(), variable(at(1)), sep(), variable(at(2)));

    case Cmd.RecallToLocation:
      return display(
        variable(at(0)),
        seg(' (', 'punct'),
        variable(at(1)),
        seg(',', 'punct'),
        variable(at(2)),
        seg(')', 'punct'),
      );

    case Cmd.SetVehicleLocation:
      return display(kw(vehicleName(at(0))), sep(), ...plainParams(p.slice(1)));

    case Cmd.ChangeEventLocation:
      return display(
        characterName(at(0)),
        sep(),
        seg('(', 'punct'),
        valueOrVariable(at(1), at(2)),
        seg(',', 'punct'),
        valueOrVariable(at(1), at(3)),
        seg(')', 'punct'),
      );

    case Cmd.TradeEventLocations:
      return display(characterName(at(0)), sep(), characterName(at(1)));

    case Cmd.StoreTerrainID:
    case Cmd.StoreEventID:
      return display(
        seg('(', 'punct'),
        valueOrVariable(at(0), at(1)),
        seg(',', 'punct'),
        valueOrVariable(at(0), at(2)),
        seg(')', 'punct'),
        sep(),
        variable(at(3)),
      );

    // ── 画面 ────────────────────────────────────────────
    case Cmd.EraseScreen:
      return display(eraseTransition(at(0)));

    case Cmd.ShowScreen:
      return display(showTransition(at(0)));

    case Cmd.TintScreen:
    case Cmd.FlashScreen:
      return display(
        seg('(R', 'punct'),
        num(at(0)),
        seg(',G', 'punct'),
        num(at(1)),
        seg(',B', 'punct'),
        num(at(2)),
        seg(',S', 'punct'),
        num(at(3)),
        seg(')', 'punct'),
        sep(),
        tenthSeconds(at(4)),
        ...(at(5) ? [seg(' ', 'punct'), kw('(等待)')] : []),
      );

    case Cmd.ShakeScreen:
      return display(
        kw('强度'),
        num(at(0)),
        sep(),
        kw('速度'),
        num(at(1)),
        sep(),
        tenthSeconds(at(2)),
        ...(at(3) ? [seg(' ', 'punct'), kw('(等待)')] : []),
      );

    case Cmd.PanScreen:
      switch (at(0)) {
        case 0:
          return display(kw('锁定位置'));
        case 1:
          return display(kw('解除锁定'));
        case 2:
          return display(
            kw(directionName(at(1))),
            seg(' ', 'punct'),
            num(at(2)),
            kw(' 格'),
            sep(),
            kw('速度'),
            seg(' ', 'punct'),
            num(at(3)),
            ...(at(4) ? [seg(' ', 'punct'), kw('(等待)')] : []),
          );
        default:
          return display(
            kw('重置位置'),
            sep(),
            kw('速度'),
            seg(' ', 'punct'),
            num(at(3)),
            ...(at(4) ? [seg(' ', 'punct'), kw('(等待)')] : []),
          );
      }

    case Cmd.WeatherEffects:
      return display(
        kw(WEATHER_TYPES[at(0)] ?? '未知'),
        sep(),
        kw(WEATHER_STRENGTH[at(1)] ?? '未知'),
      );

    // ── 图片 / 动画 ─────────────────────────────────────
    case Cmd.ShowPicture:
      return display(num(at(0)), sep(), str(text));

    case Cmd.MovePicture:
      return display(
        num(at(0)),
        seg(' (', 'punct'),
        valueOrVariable(at(1), at(2)),
        seg(',', 'punct'),
        valueOrVariable(at(1), at(3)),
        seg(')', 'punct'),
        sep(),
        tenthSeconds(at(14)),
        ...(at(15) ? [seg(' ', 'punct'), kw('(等待)')] : []),
      );

    case Cmd.ErasePicture:
      return display(num(at(0)));

    case Cmd.ShowBattleAnimation:
      return display(
        dbRef('动画', 'animation', at(0)),
        sep(),
        characterName(at(1)),
        ...(at(2) ? [seg(' ', 'punct'), kw('(等待)')] : []),
      );

    case Cmd.PlayerVisibility:
      return display(kw(at(0) ? '不透明' : '透明'));

    case Cmd.FlashSprite:
      return display(
        characterName(at(0)),
        sep(),
        tenthSeconds(at(5)),
        ...(at(6) ? [seg(' ', 'punct'), kw('(等待)')] : []),
      );

    case Cmd.MoveEvent: {
      const parts: DisplaySegment[] = [];
      for (const code of p.slice(4, 8)) parts.push(sep(), kw(moveCommandName(code)));
      if (p.length >= 8) parts.push(seg('…', 'punct'));
      return display(characterName(at(0)), ...parts);
    }

    case Cmd.Wait:
      return p.length <= 1 || at(1) === 0
        ? display(tenthSeconds(at(0)))
        : display(kw('直到按键'));

    // ── 音频 / 视频 ─────────────────────────────────────
    case Cmd.PlayBGM:
    case Cmd.PlaySound:
    case Cmd.PlayMovie:
      return display(str(text));

    case Cmd.FadeOutBGM:
      return display(num(Math.trunc(at(0) / 1000)), kw('s'));

    case Cmd.KeyInputProc:
      return display(variable(at(0)));

    // ── 地图 ────────────────────────────────────────────
    case Cmd.ChangeMapTileset:
      return display(str(text));

    case Cmd.ChangePBG:
      return display(
        str(text),
        ...(at(0) ? [sep(), kw('横向滚动')] : []),
        ...(at(1) ? [sep(), kw('纵向滚动')] : []),
      );

    case Cmd.ChangeEncounterSteps:
      return display(num(at(0)));

    case Cmd.TileSubstitution:
      return display(
        kw(at(0) ? '上层' : '下层'),
        sep(),
        num(at(1)),
        seg(' → ', 'punct'),
        num(at(2)),
      );

    case Cmd.TeleportTargets:
      return at(1)
        ? display(kw('移除'), seg(' ', 'punct'), mapRef(at(1)))
        : display(
            kw('添加'),
            seg(' ', 'punct'),
            mapRef(at(1)),
            seg(' (', 'punct'),
            num(at(2)),
            seg(',', 'punct'),
            num(at(3)),
            seg(')', 'punct'),
          );

    case Cmd.ChangeTeleportAccess:
    case Cmd.ChangeEscapeAccess:
    case Cmd.ChangeSaveAccess:
    case Cmd.ChangeMainMenuAccess:
      return display(kw(at(0) ? '允许' : '禁止'));

    case Cmd.EscapeTarget:
      return display(
        mapRef(at(0)),
        seg(' (', 'punct'),
        num(at(1)),
        seg(',', 'punct'),
        num(at(2)),
        seg(')', 'punct'),
      );

    // ── 流程控制 / 文本 ─────────────────────────────────
    case Cmd.ConditionalBranch:
    case Cmd.ConditionalBranchB:
      return display(...conditionSegments(p, text));

    case Cmd.ShowMessage:
    case Cmd.ShowMessage2:
    case Cmd.Comment:
    case Cmd.Comment2:
      return display(str(text));

    case Cmd.ShowChoice:
      return display(...choiceSegments(text));

    case Cmd.ShowChoiceOption:
      return display(text ? seg(`[${text}]`, 'string') : kw('取消'));

    case Cmd.Label:
    case Cmd.JumpToLabel:
      return display(num(at(0)));

    case Cmd.CallEvent:
      return display(...callEventSegments(p));

    case Cmd.ShowChoiceEnd:
    case Cmd.ElseBranch:
    case Cmd.ElseBranchB:
    case Cmd.EndBranch:
    case Cmd.EndBranchB:
    case Cmd.EndLoop:
      return display();

    default:
      return { name: line.name, segments: plainParams(p) };
  }
}

/** 条件分支的条件部分 */
function conditionSegments(p: number[], text: string): DisplaySegment[] {
  const at = (index: number) => p[index] ?? 0;

  switch (at(0)) {
    case 0:
      return [switchRef(at(1)), seg(' ', 'punct'), kw(at(2) ? '开' : '关')];
    case 1:
      return [
        variable(at(1)),
        seg(` ${['==', '>=', '<=', '>', '<', '!='][at(4)] ?? '?'} `, 'punct'),
        valueOrVariable(at(2), at(3)),
      ];
    case 2:
      return [kw('计时器 1'), seg(at(2) ? ' <= ' : ' >= ', 'punct'), formatTime(at(1))];
    case 3:
      return [kw('金钱'), seg(at(2) ? ' <= ' : ' >= ', 'punct'), num(at(1))];
    case 4:
      return [
        dbRef('物品', 'item', at(1)),
        seg(' ', 'punct'),
        kw(at(2) ? '未持有' : '持有'),
      ];
    case 5: {
      const actor = dbRef('角色', 'actor', at(1));
      switch (at(2)) {
        case 0:
          return [actor, sep(), kw('在队伍中')];
        case 1:
          return [actor, sep(), kw('名字为 '), str(text)];
        case 2:
          return [actor, sep(), kw('等级至少 '), num(at(3))];
        case 3:
          return [actor, sep(), kw('HP 超过 '), num(at(3))];
        case 4:
          return [actor, sep(), kw('可使用 '), dbRef('技能', 'skill', at(3))];
        case 5:
          return [
            actor,
            sep(),
            dbRef('物品', 'item', at(3)),
            seg(' ', 'punct'),
            kw('已装备'),
          ];
        case 6:
          return [actor, sep(), kw('状态为 '), dbRef('状态', 'state', at(3))];
        default:
          return [actor, sep(), kw('未知')];
      }
    }
    case 6:
      return [
        characterName(at(1)),
        seg(' ', 'punct'),
        kw(`朝向${directionName(at(2))}`),
      ];
    case 7:
      return [kw('载具'), seg(' ', 'punct'), kw(vehicleName(at(1)))];
    case 8:
      return [kw('用决定键启动事件')];
    case 9:
      return [kw('BGM 已播放完毕')];
    case 10:
      return [kw('计时器 2'), seg(at(2) ? ' <= ' : ' >= ', 'punct'), formatTime(at(1))];
    default:
      return [kw('未知')];
  }
}

/** 显示选项：文本里每行是一个选项 */
function choiceSegments(text: string): DisplaySegment[] {
  const options = text.split(/\r\n|\r|\n|\u0000/).filter((item) => item.length > 0);
  const result: DisplaySegment[] = [];
  options.forEach((option, index) => {
    if (index > 0) result.push(seg(' / ', 'punct'));
    result.push(seg(`[${option}]`, 'string'));
  });
  return result;
}

/** 调用事件的目标（公共事件 / 本图事件 / 变量指定） */
function callEventSegments(p: number[]): DisplaySegment[] {
  const at = (index: number) => p[index] ?? 0;

  switch (at(0)) {
    case 0:
      return [dbRef('公共事件', 'commonEvent', at(1))];
    case 1:
      return [dbRef('事件', 'event', at(1)), seg(`[${at(2)}]`, 'number')];
    case 2:
      return [variable(at(1)), seg('[', 'punct'), variable(at(2)), seg(']', 'punct')];
    default:
      return plainParams(p);
  }
}

/** 控制变量的操作数（常量 / 变量 / 随机 / 角色属性 / 角色坐标 / 其他） */
function controlVarOperand(kind: number, a: number, b: number): DisplaySegment[] {
  switch (kind) {
    case 0:
      return [num(a)];
    case 1:
      return [variable(a)];
    case 2:
      return [seg(`变量[变量[${pad4(a)}]]`, 'variable', { kind: 'variable', id: a })];
    case 3:
      return [kw('随机'), seg(' ', 'punct'), num(a), seg('-', 'punct'), num(b)];
    case 4:
      return [
        kw(b ? '装备数量' : '持有数量'),
        seg(' ', 'punct'),
        dbRef('物品', 'item', a),
      ];
    case 5:
      return [
        dbRef('角色', 'actor', a),
        seg(' ', 'punct'),
        kw(
          [
            '等级',
            '经验',
            'HP',
            'MP',
            '最大 HP',
            '最大 MP',
            '攻击',
            '防御',
            '精神',
            '敏捷',
            '武器 ID',
            '盾牌 ID',
            '护甲 ID',
            '头盔 ID',
            '饰品 ID',
          ][b] ?? '未知',
        ),
      ];
    case 6:
      return [
        characterName(a),
        seg(' ', 'punct'),
        kw(
          ['地图 ID', 'X 坐标', 'Y 坐标', '朝向', '画面 X', '画面 Y'][b] ?? '未知',
        ),
      ];
    case 7:
      return [
        kw(
          [
            '金钱',
            '计时器 1',
            '队伍人数',
            '存档次数',
            '战斗次数',
            '胜利次数',
            '失败次数',
            '逃跑次数',
            'MIDI 播放位置',
            '计时器 2',
          ][a] ?? '未知',
        ),
      ];
    default:
      return [kw('未知')];
  }
}
