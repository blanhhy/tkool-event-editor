import type { EventCommand } from 'rpgrt';

/**
 * 事件指令码表（RPG Maker 2000/2003 + EasyRPG / Maniac Patch 扩展）。
 * 名称取自 docs/raw_events_table.md 的「参考显示名」。
 *
 * role 只用于着色区分代码块的分支与结束标记；
 * 所有指令（包括消息续行、注释续行、End 占位）都按「一条指令一行」渲染。
 */
export type CommandRole = 'command' | 'branch' | 'end';

interface CommandMeta {
  name: string;
  role?: CommandRole;
}

export const EVENT_COMMANDS: Record<number, CommandMeta> = {
  // ── 消息 ──────────────────────────────────────────────
  10110: { name: '显示消息' },
  10120: { name: '更改对话框' },
  10130: { name: '更改脸图' },
  10140: { name: '显示选项', role: 'branch' },
  10150: { name: '输入数字' },
  // ── 开关 / 变量 / 计时器 ──────────────────────────────
  10210: { name: '控制开关' },
  10220: { name: '控制变量' },
  10230: { name: '定时器操作' },
  // ── 队伍 / 物品 / 金钱 ────────────────────────────────
  10310: { name: '更改金钱' },
  10320: { name: '更改道具' },
  10330: { name: '更改队伍成员' },
  // ── 角色 ──────────────────────────────────────────────
  10410: { name: '更改经验' },
  10420: { name: '更改等级' },
  10430: { name: '更改能力值' },
  10440: { name: '更改技能' },
  10450: { name: '更改装备' },
  10460: { name: '更改生命值' },
  10470: { name: '更改魔法值' },
  10480: { name: '更改状态' },
  10490: { name: '完全治疗' },
  10500: { name: '施加伤害' },
  // ── 角色外观 / 系统资源 ───────────────────────────────
  10610: { name: '更改角色名字' },
  10620: { name: '更改角色头衔' },
  10630: { name: '更改角色图像' },
  10640: { name: '更改角色脸图' },
  10650: { name: '更改载具图像' },
  10660: { name: '更改系统 BGM' },
  10670: { name: '更改系统音效' },
  10680: { name: '更改系统图像' },
  10690: { name: '更改转场特效' },
  // ── 场景 ──────────────────────────────────────────────
  10710: { name: '进入战斗' },
  10720: { name: '进入商店' },
  10730: { name: '进入旅馆' },
  10740: { name: '输入角色名字' },
  // ── 位置 / 载具 ───────────────────────────────────────
  10810: { name: '转移玩家' },
  10820: { name: '获取玩家位置' },
  10830: { name: '移动到保存位置' },
  10840: { name: '乘降交通工具' },
  10850: { name: '设置载具位置' },
  10860: { name: '更改事件位置' },
  10870: { name: '交换事件位置' },
  10910: { name: '获取地形 ID' },
  10920: { name: '获取事件 ID' },
  // ── 画面 ──────────────────────────────────────────────
  11010: { name: '淡出画面' },
  11020: { name: '显示画面' },
  11030: { name: '着色画面' },
  11040: { name: '画面闪烁' },
  11050: { name: '画面震动' },
  11060: { name: '移动镜头' },
  11070: { name: '天气效果' },
  // ── 图片 / 动画 ───────────────────────────────────────
  11110: { name: '显示图片' },
  11120: { name: '移动图片' },
  11130: { name: '消除图片' },
  11210: { name: '显示动画' },
  // ── 角色 / 事件移动 ───────────────────────────────────
  11310: { name: '隐藏玩家' },
  11320: { name: '事件闪烁' },
  11330: { name: '设置移动路线' },
  11340: { name: '等待移动完成' },
  11350: { name: '停止所有移动' },
  11410: { name: '等待' },
  // ── 音频 / 视频 ───────────────────────────────────────
  11510: { name: '播放 BGM' },
  11520: { name: '淡出 BGM' },
  11530: { name: '暂存 BGM' },
  11540: { name: '重放 BGM' },
  11550: { name: '播放 SE' },
  11560: { name: '播放视频' },
  11610: { name: '按键监听' },
  // ── 地图 ──────────────────────────────────────────────
  11710: { name: '更改芯片组' },
  11720: { name: '更改远景' },
  11740: { name: '更改遇敌步数' },
  11750: { name: '地图元件替换' },
  11810: { name: '设置传送点' },
  11820: { name: '更改传送权限' },
  11830: { name: '设置逃脱点' },
  11840: { name: '更改逃脱权限' },
  // ── 菜单 / 存档 ───────────────────────────────────────
  11910: { name: '打开存档界面' },
  11930: { name: '更改存档权限' },
  11950: { name: '打开菜单界面' },
  11960: { name: '更改菜单权限' },
  // ── 流程控制 ──────────────────────────────────────────
  12010: { name: '条件分支' },
  12110: { name: '标签' },
  12120: { name: '跳转标签' },
  12210: { name: '循环' },
  12220: { name: '跳出循环' },
  12310: { name: '结束处理' },
  12320: { name: '消除事件' },
  12330: { name: '调用事件' },
  1005: { name: '调用公共事件' },
  12410: { name: '注释' },
  12420: { name: '游戏结束' },
  12510: { name: '返回标题' },
  // ── 2k3 扩展 ──────────────────────────────────────────
  1008: { name: '更改角色职业' },
  1009: { name: '更改战斗指令' },
  5001: { name: '打开读档界面' },
  5002: { name: '退出游戏' },
  5003: { name: '切换 ATB 等待模式' },
  5004: { name: '切换全屏' },
  5005: { name: '打开游戏选项' },
  // ── 战斗事件 ──────────────────────────────────────────
  1006: { name: '强制逃跑' },
  1007: { name: '允许连击' },
  13110: { name: '更改敌人 HP' },
  13120: { name: '更改敌人 MP' },
  13130: { name: '更改敌人状态' },
  13150: { name: '[内部] 显示/隐藏敌人' },
  13210: { name: '[内部] 更改战斗背景' },
  13260: { name: '显示动画（战斗）' },
  13310: { name: '条件分支（战斗）' },
  13410: { name: '中断战斗' },
  // ── 语法 / 结构标记 ───────────────────────────────────
  20110: { name: '消息续行' },
  20140: { name: '选项', role: 'branch' },
  20141: { name: '选项结束', role: 'end' },
  22010: { name: '否则', role: 'branch' },
  22011: { name: '结束分支', role: 'end' },
  22210: { name: '循环结束', role: 'end' },
  22410: { name: '注释续行' },
  23310: { name: '否则（战斗）', role: 'branch' },
  23311: { name: '结束分支（战斗）', role: 'end' },
  10: { name: '空行' },
  // ── 内部标记（作用未明） ──────────────────────────────
  20710: { name: '[内部] 胜利处理' },
  20711: { name: '[内部] 逃跑处理' },
  20712: { name: '[内部] 失败处理' },
  20713: { name: '[内部] 战斗结束' },
  20720: { name: '[内部] 事务开始' },
  20721: { name: '[内部] 事务结束' },
  20722: { name: '[内部] 商店结束' },
  20730: { name: '[内部] 住宿停留' },
  20731: { name: '[内部] 住宿结束' },
  20732: { name: '[内部] 旅馆结束' },
  // ── EasyRPG 扩展 ──────────────────────────────────────
  2002: { name: '[EasyRPG] 触发事件' },
  2003: { name: '[EasyRPG] 寻路' },
  2050: { name: '[EasyRPG] 调用移动动作' },
  2051: { name: '[EasyRPG] 等待单个移动' },
  2052: { name: '[EasyRPG] 变量动画' },
  2053: { name: '[EasyRPG] 设置解释器标志' },
  2055: { name: '[EasyRPG] 处理 JSON' },
  2056: { name: '[EasyRPG] 克隆地图事件' },
  2057: { name: '[EasyRPG] 销毁地图事件' },
  2058: { name: '[EasyRPG] 字符串图片菜单' },
  // ── Maniac Patch 扩展 ─────────────────────────────────
  3001: { name: '[Maniac] 获取存档信息' },
  3002: { name: '[Maniac] 新建存档' },
  3003: { name: '[Maniac] 加载存档' },
  3004: { name: '[Maniac] 结束读档流程' },
  3005: { name: '[Maniac] 获取鼠标位置' },
  3006: { name: '[Maniac] 设置鼠标位置' },
  3007: { name: '[Maniac] 显示字符串图片' },
  3008: { name: '[Maniac] 获取图片信息' },
  3009: { name: '[Maniac] 控制战斗' },
  3010: { name: '[Maniac] 控制 ATB 等待' },
  3011: { name: '[Maniac] 更改战斗指令（增强）' },
  3012: { name: '[Maniac] 获取战斗信息' },
  3013: { name: '[Maniac] 控制数组' },
  3014: { name: '[Maniac] 按键监听（增强）' },
  3015: { name: '[Maniac] 重写地图' },
  3016: { name: '[Maniac] 控制全局保存' },
  3017: { name: '[Maniac] 更改图片 ID' },
  3018: { name: '[Maniac] 设置游戏选项' },
  3019: { name: '[Maniac] 调用命令' },
  3020: { name: '[Maniac] 控制字符串' },
  3021: { name: '[Maniac] 获取游戏信息' },
  3025: { name: '[Maniac] 编辑图片' },
  3026: { name: '[Maniac] 写入图片' },
  3027: { name: '[Maniac] 添加移动路线' },
  3028: { name: '[Maniac] 编辑图块' },
  3029: { name: '[Maniac] 控制文本处理' },
  3032: { name: '[Maniac] 缩放' },
};

export interface CommandLine {
  /** 原始指令数组中的下标，供后续编辑定位 */
  index: number;
  code: number;
  indent: number;
  name: string;
  /** 裸参数，语义化留给指令集与数据库视图 */
  params: number[];
  /** 指令携带的文本（消息 / 注释 / 部分指令的字符串参数） */
  text: string | null;
  role: CommandRole;
  unknown: boolean;
}

/**
 * 把原始指令数组整理成可渲染的行。
 * 一条指令对应一行（消息续行、注释续行、End 占位都单独成行），
 * 行号即指令在数组中的序号。
 */
export function buildCommandLines(commands: EventCommand[]): CommandLine[] {
  return commands.map((command, index) => {
    const meta = EVENT_COMMANDS[command.code];
    return {
      index,
      code: command.code,
      indent: command.indent ?? 0,
      name: meta?.name ?? `未知指令 ${command.code}`,
      params: command.parameters ?? [],
      text: command.string ? command.string : null,
      role: meta?.role ?? 'command',
      unknown: !meta,
    };
  });
}

export type RenderRow =
  | { kind: 'command'; line: CommandLine }
  | { kind: 'comment'; lines: CommandLine[] }
  | { kind: 'message'; lines: CommandLine[] };

/** 可编辑的文本块类型：注释（12410）与消息（10110）共用一套读写规则 */
export type TextBlockKind = 'comment' | 'message';

/** 一行最多容纳的半角字符数（全角按两个半角计） */
export const MAX_LINE_WIDTH = 64;
/** 一条指令最多拆成的行数（RPG_RT 对话框上限） */
export const MAX_LINES = 4;

/** 粗略的东亚宽字符判定：全角字符占两个半角位 */
function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}

/**
 * 按「每行最多 MAX_LINE_WIDTH 个半角、最多 MAX_LINES 行」把编辑文本拆成多行。
 * 换行本身不会写进数据：每一行在 LCF 里都是独立的指令。
 */
export function splitCommandText(text: string): string[] {
  const result: string[] = [];

  for (const raw of text.split('\n')) {
    let current = '';
    let width = 0;

    for (const char of raw) {
      const charWidth = isWideChar(char.codePointAt(0) ?? 0) ? 2 : 1;
      if (width + charWidth > MAX_LINE_WIDTH && current) {
        result.push(current);
        current = '';
        width = 0;
        if (result.length >= MAX_LINES) return result;
      }
      current += char;
      width += charWidth;
    }

    result.push(current);
    if (result.length >= MAX_LINES) return result;
  }

  return result.slice(0, MAX_LINES);
}

/** 输入是否仍在「每行宽度 + 总行数」限制内（编辑时用于拒绝超限输入） */
export function textFitsCommandLimits(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length > MAX_LINES) return false;

  return lines.every((line) => {
    let width = 0;
    for (const char of line) width += isWideChar(char.codePointAt(0) ?? 0) ? 2 : 1;
    return width <= MAX_LINE_WIDTH;
  });
}

/**
 * 渲染分组：把 12410（注释）与后续 22410 合成注释块，
 * 把 10110（显示消息）与后续 20110 合成消息块，其余指令各自一行。
 * 每个块仍保留每行对应的行号。
 */
export function groupCommandLines(lines: CommandLine[]): RenderRow[] {
  const rows: RenderRow[] = [];
  let group: CommandLine[] | null = null;
  let groupKind: TextBlockKind | null = null;

  for (const line of lines) {
    if (line.code === 12410) {
      group = [line];
      groupKind = 'comment';
      rows.push({ kind: 'comment', lines: group });
      continue;
    }
    if (line.code === 10110) {
      group = [line];
      groupKind = 'message';
      rows.push({ kind: 'message', lines: group });
      continue;
    }
    if (groupKind === 'comment' && group && line.code === 22410) {
      group.push(line);
      continue;
    }
    if (groupKind === 'message' && group && line.code === 20110) {
      group.push(line);
      continue;
    }
    group = null;
    groupKind = null;
    rows.push({ kind: 'command', line });
  }

  return rows;
}
