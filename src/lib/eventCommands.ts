import type { EventCommand } from 'rpgrt';
import { Cmd, type CmdCode } from './commandCodes';

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

export const EVENT_COMMANDS: Record<CmdCode, CommandMeta> = {
  // ── 消息 ──────────────────────────────────────────────
  [Cmd.ShowMessage]: { name: '显示消息' },
  [Cmd.MessageOptions]: { name: '更改对话框' },
  [Cmd.ChangeFaceGraphic]: { name: '更改脸图' },
  [Cmd.ShowChoice]: { name: '显示选项', role: 'branch' },
  [Cmd.InputNumber]: { name: '输入数字' },
  // ── 开关 / 变量 / 计时器 ──────────────────────────────
  [Cmd.ControlSwitches]: { name: '控制开关' },
  [Cmd.ControlVars]: { name: '控制变量' },
  [Cmd.TimerOperation]: { name: '定时器操作' },
  // ── 队伍 / 物品 / 金钱 ────────────────────────────────
  [Cmd.ChangeGold]: { name: '更改金钱' },
  [Cmd.ChangeItems]: { name: '更改道具' },
  [Cmd.ChangePartyMembers]: { name: '更改队伍成员' },
  // ── 角色 ──────────────────────────────────────────────
  [Cmd.ChangeExp]: { name: '更改经验' },
  [Cmd.ChangeLevel]: { name: '更改等级' },
  [Cmd.ChangeParameters]: { name: '更改能力值' },
  [Cmd.ChangeSkills]: { name: '更改技能' },
  [Cmd.ChangeEquipment]: { name: '更改装备' },
  [Cmd.ChangeHP]: { name: '更改生命值' },
  [Cmd.ChangeSP]: { name: '更改魔法值' },
  [Cmd.ChangeCondition]: { name: '更改状态' },
  [Cmd.FullHeal]: { name: '完全治疗' },
  [Cmd.SimulatedAttack]: { name: '施加伤害' },
  // ── 角色外观 / 系统资源 ───────────────────────────────
  [Cmd.ChangeHeroName]: { name: '更改角色名字' },
  [Cmd.ChangeHeroTitle]: { name: '更改角色头衔' },
  [Cmd.ChangeSpriteAssociation]: { name: '更改角色图像' },
  [Cmd.ChangeActorFace]: { name: '更改角色脸图' },
  [Cmd.ChangeVehicleGraphic]: { name: '更改载具图像' },
  [Cmd.ChangeSystemBGM]: { name: '更改系统 BGM' },
  [Cmd.ChangeSystemSFX]: { name: '更改系统音效' },
  [Cmd.ChangeSystemGraphics]: { name: '更改系统图像' },
  [Cmd.ChangeScreenTransitions]: { name: '更改转场特效' },
  // ── 场景 ──────────────────────────────────────────────
  [Cmd.EnemyEncounter]: { name: '进入战斗' },
  [Cmd.OpenShop]: { name: '进入商店' },
  [Cmd.ShowInn]: { name: '进入旅馆' },
  [Cmd.EnterHeroName]: { name: '输入角色名字' },
  // ── 位置 / 载具 ───────────────────────────────────────
  [Cmd.Teleport]: { name: '转移玩家' },
  [Cmd.MemorizeLocation]: { name: '获取玩家位置' },
  [Cmd.RecallToLocation]: { name: '移动到保存位置' },
  [Cmd.EnterExitVehicle]: { name: '乘降交通工具' },
  [Cmd.SetVehicleLocation]: { name: '设置载具位置' },
  [Cmd.ChangeEventLocation]: { name: '更改事件位置' },
  [Cmd.TradeEventLocations]: { name: '交换事件位置' },
  [Cmd.StoreTerrainID]: { name: '获取地形 ID' },
  [Cmd.StoreEventID]: { name: '获取事件 ID' },
  // ── 画面 ──────────────────────────────────────────────
  [Cmd.EraseScreen]: { name: '淡出画面' },
  [Cmd.ShowScreen]: { name: '显示画面' },
  [Cmd.TintScreen]: { name: '着色画面' },
  [Cmd.FlashScreen]: { name: '画面闪烁' },
  [Cmd.ShakeScreen]: { name: '画面震动' },
  [Cmd.PanScreen]: { name: '移动镜头' },
  [Cmd.WeatherEffects]: { name: '天气效果' },
  // ── 图片 / 动画 ───────────────────────────────────────
  [Cmd.ShowPicture]: { name: '显示图片' },
  [Cmd.MovePicture]: { name: '移动图片' },
  [Cmd.ErasePicture]: { name: '消除图片' },
  [Cmd.ShowBattleAnimation]: { name: '显示动画' },
  // ── 角色 / 事件移动 ───────────────────────────────────
  [Cmd.PlayerVisibility]: { name: '隐藏玩家' },
  [Cmd.FlashSprite]: { name: '事件闪烁' },
  [Cmd.MoveEvent]: { name: '设置移动路线' },
  [Cmd.ProceedWithMovement]: { name: '等待移动完成' },
  [Cmd.HaltAllMovement]: { name: '停止所有移动' },
  [Cmd.Wait]: { name: '等待' },
  // ── 音频 / 视频 ───────────────────────────────────────
  [Cmd.PlayBGM]: { name: '播放 BGM' },
  [Cmd.FadeOutBGM]: { name: '淡出 BGM' },
  [Cmd.MemorizeBGM]: { name: '暂存 BGM' },
  [Cmd.PlayMemorizedBGM]: { name: '重放 BGM' },
  [Cmd.PlaySound]: { name: '播放 SE' },
  [Cmd.PlayMovie]: { name: '播放视频' },
  [Cmd.KeyInputProc]: { name: '按键监听' },
  // ── 地图 ──────────────────────────────────────────────
  [Cmd.ChangeMapTileset]: { name: '更改芯片组' },
  [Cmd.ChangePBG]: { name: '更改远景' },
  [Cmd.ChangeEncounterSteps]: { name: '更改遇敌步数' },
  [Cmd.TileSubstitution]: { name: '地图元件替换' },
  [Cmd.TeleportTargets]: { name: '设置传送点' },
  [Cmd.ChangeTeleportAccess]: { name: '更改传送权限' },
  [Cmd.EscapeTarget]: { name: '设置逃脱点' },
  [Cmd.ChangeEscapeAccess]: { name: '更改逃脱权限' },
  // ── 菜单 / 存档 ───────────────────────────────────────
  [Cmd.OpenSaveMenu]: { name: '打开存档界面' },
  [Cmd.ChangeSaveAccess]: { name: '更改存档权限' },
  [Cmd.OpenMainMenu]: { name: '打开菜单界面' },
  [Cmd.ChangeMainMenuAccess]: { name: '更改菜单权限' },
  // ── 流程控制 ──────────────────────────────────────────
  [Cmd.ConditionalBranch]: { name: '条件分支' },
  [Cmd.Label]: { name: '标签' },
  [Cmd.JumpToLabel]: { name: '跳转标签' },
  [Cmd.Loop]: { name: '循环' },
  [Cmd.BreakLoop]: { name: '跳出循环' },
  [Cmd.EndEventProcessing]: { name: '结束处理' },
  [Cmd.EraseEvent]: { name: '消除事件' },
  [Cmd.CallEvent]: { name: '调用事件' },
  [Cmd.CallCommonEvent]: { name: '调用公共事件' },
  [Cmd.Comment]: { name: '注释' },
  [Cmd.GameOver]: { name: '游戏结束' },
  [Cmd.ReturntoTitleScreen]: { name: '返回标题' },
  // ── 2k3 扩展 ──────────────────────────────────────────
  [Cmd.ChangeClass]: { name: '更改角色职业' },
  [Cmd.ChangeBattleCommands]: { name: '更改战斗指令' },
  [Cmd.OpenLoadMenu]: { name: '打开读档界面' },
  [Cmd.ExitGame]: { name: '退出游戏' },
  [Cmd.ToggleAtbMode]: { name: '切换 ATB 等待模式' },
  [Cmd.ToggleFullscreen]: { name: '切换全屏' },
  [Cmd.OpenVideoOptions]: { name: '打开游戏选项' },
  // ── 战斗事件 ──────────────────────────────────────────
  [Cmd.ForceFlee]: { name: '强制逃跑' },
  [Cmd.EnableCombo]: { name: '允许连击' },
  [Cmd.ChangeMonsterHP]: { name: '更改敌人 HP' },
  [Cmd.ChangeMonsterMP]: { name: '更改敌人 MP' },
  [Cmd.ChangeMonsterCondition]: { name: '更改敌人状态' },
  [Cmd.ShowHiddenMonster]: { name: '[内部] 显示/隐藏敌人' },
  [Cmd.ChangeBattleBG]: { name: '[内部] 更改战斗背景' },
  [Cmd.ShowBattleAnimationB]: { name: '显示动画（战斗）' },
  [Cmd.ConditionalBranchB]: { name: '条件分支（战斗）' },
  [Cmd.TerminateBattle]: { name: '中断战斗' },
  // ── 语法 / 结构标记 ───────────────────────────────────
  [Cmd.ShowMessage2]: { name: '消息续行' },
  [Cmd.ShowChoiceOption]: { name: '选项', role: 'branch' },
  [Cmd.ShowChoiceEnd]: { name: '选项结束', role: 'end' },
  [Cmd.ElseBranch]: { name: '否则', role: 'branch' },
  [Cmd.EndBranch]: { name: '结束分支', role: 'end' },
  [Cmd.EndLoop]: { name: '循环结束', role: 'end' },
  [Cmd.Comment2]: { name: '注释续行' },
  [Cmd.ElseBranchB]: { name: '否则（战斗）', role: 'branch' },
  [Cmd.EndBranchB]: { name: '结束分支（战斗）', role: 'end' },
  [Cmd.End]: { name: '@' },
  // ── 内部标记（作用未明） ──────────────────────────────
  [Cmd.VictoryHandler]: { name: '[内部] 胜利处理' },
  [Cmd.EscapeHandler]: { name: '[内部] 逃跑处理' },
  [Cmd.DefeatHandler]: { name: '[内部] 失败处理' },
  [Cmd.EndBattle]: { name: '[内部] 战斗结束' },
  [Cmd.Transaction]: { name: '[内部] 事务开始' },
  [Cmd.NoTransaction]: { name: '[内部] 事务结束' },
  [Cmd.EndShop]: { name: '[内部] 商店结束' },
  [Cmd.Stay]: { name: '[内部] 住宿停留' },
  [Cmd.NoStay]: { name: '[内部] 住宿结束' },
  [Cmd.EndInn]: { name: '[内部] 旅馆结束' },
  // ── EasyRPG 扩展 ──────────────────────────────────────
  [Cmd.EasyRpgTriggerEventAt]: { name: '[EasyRPG] 触发事件' },
  [Cmd.EasyRpgPathfinder]: { name: '[EasyRPG] 寻路' },
  [Cmd.EasyRpgCallMovementAction]: { name: '[EasyRPG] 调用移动动作' },
  [Cmd.EasyRpgWaitForSingleMovement]: { name: '[EasyRPG] 等待单个移动' },
  [Cmd.EasyRpgAnimateVariable]: { name: '[EasyRPG] 变量动画' },
  [Cmd.EasyRpgSetInterpreterFlag]: { name: '[EasyRPG] 设置解释器标志' },
  [Cmd.EasyRpgProcessJson]: { name: '[EasyRPG] 处理 JSON' },
  [Cmd.EasyRpgCloneMapEvent]: { name: '[EasyRPG] 克隆地图事件' },
  [Cmd.EasyRpgDestroyMapEvent]: { name: '[EasyRPG] 销毁地图事件' },
  [Cmd.EasyRpgStringPictureMenu]: { name: '[EasyRPG] 字符串图片菜单' },
  // ── Maniac Patch 扩展 ─────────────────────────────────
  [Cmd.ManiacGetSaveInfo]: { name: '[Maniac] 获取存档信息' },
  [Cmd.ManiacSave]: { name: '[Maniac] 新建存档' },
  [Cmd.ManiacLoad]: { name: '[Maniac] 加载存档' },
  [Cmd.ManiacEndLoadProcess]: { name: '[Maniac] 结束读档流程' },
  [Cmd.ManiacGetMousePosition]: { name: '[Maniac] 获取鼠标位置' },
  [Cmd.ManiacSetMousePosition]: { name: '[Maniac] 设置鼠标位置' },
  [Cmd.ManiacShowStringPicture]: { name: '[Maniac] 显示字符串图片' },
  [Cmd.ManiacGetPictureInfo]: { name: '[Maniac] 获取图片信息' },
  [Cmd.ManiacControlBattle]: { name: '[Maniac] 控制战斗' },
  [Cmd.ManiacControlAtbGauge]: { name: '[Maniac] 控制 ATB 等待' },
  [Cmd.ManiacChangeBattleCommandEx]: { name: '[Maniac] 更改战斗指令（增强）' },
  [Cmd.ManiacGetBattleInfo]: { name: '[Maniac] 获取战斗信息' },
  [Cmd.ManiacControlVarArray]: { name: '[Maniac] 控制数组' },
  [Cmd.ManiacKeyInputProcEx]: { name: '[Maniac] 按键监听（增强）' },
  [Cmd.ManiacRewriteMap]: { name: '[Maniac] 重写地图' },
  [Cmd.ManiacControlGlobalSave]: { name: '[Maniac] 控制全局保存' },
  [Cmd.ManiacChangePictureId]: { name: '[Maniac] 更改图片 ID' },
  [Cmd.ManiacSetGameOption]: { name: '[Maniac] 设置游戏选项' },
  [Cmd.ManiacCallCommand]: { name: '[Maniac] 调用命令' },
  [Cmd.ManiacControlStrings]: { name: '[Maniac] 控制字符串' },
  [Cmd.ManiacGetGameInfo]: { name: '[Maniac] 获取游戏信息' },
  [Cmd.ManiacEditPicture]: { name: '[Maniac] 编辑图片' },
  [Cmd.ManiacWritePicture]: { name: '[Maniac] 写入图片' },
  [Cmd.ManiacAddMoveRoute]: { name: '[Maniac] 添加移动路线' },
  [Cmd.ManiacEditTile]: { name: '[Maniac] 编辑图块' },
  [Cmd.ManiacControlTextProcessing]: { name: '[Maniac] 控制文本处理' },
  [Cmd.ManiacZoom]: { name: '[Maniac] 缩放' },
};

/** 未知指令码（可能来自未识别的扩展）返回 undefined */
export function findCommandMeta(code: number): CommandMeta | undefined {
  return (EVENT_COMMANDS as Partial<Record<number, CommandMeta>>)[code];
}

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
    const meta = findCommandMeta(command.code);
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

/**
 * 两组指令内容是否一致。
 * 事件页的“已修改”标记按内容比较（而不是粘性标记），
 * 这样改回原样后标记会自动消失。
 */
export function isSameCommands(a?: EventCommand[], b?: EventCommand[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left.code !== right.code || left.indent !== right.indent) return false;
    if (left.string !== right.string) return false;
    if (left.parameters.length !== right.parameters.length) return false;
    for (let i = 0; i < left.parameters.length; i += 1) {
      if (left.parameters[i] !== right.parameters[i]) return false;
    }
  }
  return true;
}

export type RenderRow =
  | { kind: 'command'; line: CommandLine }
  | { kind: 'comment'; lines: CommandLine[] }
  | { kind: 'message'; lines: CommandLine[] };

/** 可编辑的文本块类型：注释（Comment）与消息（ShowMessage）共用一套读写规则 */
export type TextBlockKind = 'comment' | 'message';

/** 文本块的编辑限制 */
export interface CommandLimits {
  /** 一行最多容纳的半角字符数（全角按两个半角计）；null 表示不限制 */
  maxLineWidth: number | null;
  /** 最多行数；null 表示不限制 */
  maxLines: number | null;
}

/** 一行最多容纳的半角字符数（全角按两个半角计） */
export const MAX_LINE_WIDTH = 64;
/** 一条指令最多拆成的行数（RPG_RT 对话框上限） */
export const MAX_LINES = 4;

/** 消息：受对话框 4 行 × 64 半角的限制 */
export const MESSAGE_LIMITS: CommandLimits = { maxLineWidth: MAX_LINE_WIDTH, maxLines: MAX_LINES };

/**
 * 注释：行宽与行数只是 2000 编辑器的软限制，
 * 运行时会把 Comment / Comment2 一路拼下去（EasyRPG 的 CommandComment 也是无上限的），
 * 因此这里不做任何限制。
 */
export const COMMENT_LIMITS: CommandLimits = { maxLineWidth: null, maxLines: null };

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
 * 按给定限制把编辑文本拆成多行。
 * 换行本身不会写进数据：每一行在 LCF 里都是独立的指令。
 */
export function splitCommandText(text: string, limits: CommandLimits = MESSAGE_LIMITS): string[] {
  const { maxLineWidth, maxLines } = limits;
  const result: string[] = [];

  for (const raw of splitLines(text)) {
    if (maxLineWidth === null) {
      result.push(raw);
      if (maxLines !== null && result.length >= maxLines) break;
      continue;
    }

    let current = '';
    let width = 0;

    for (const char of raw) {
      const charWidth = isWideChar(char.codePointAt(0) ?? 0) ? 2 : 1;
      if (width + charWidth > maxLineWidth && current) {
        result.push(current);
        current = '';
        width = 0;
        if (maxLines !== null && result.length >= maxLines) return result;
      }
      current += char;
      width += charWidth;
    }

    result.push(current);
    if (maxLines !== null && result.length >= maxLines) break;
  }

  return maxLines === null ? result : result.slice(0, maxLines);
}

/** 输入是否仍在给定限制内（编辑时用于拒绝超限输入） */
export function textFitsCommandLimits(text: string, limits: CommandLimits = MESSAGE_LIMITS): boolean {
  const lines = splitLines(text);
  if (limits.maxLines !== null && lines.length > limits.maxLines) return false;
  if (limits.maxLineWidth === null) return true;

  return lines.every((line) => {
    let width = 0;
    for (const char of line) width += isWideChar(char.codePointAt(0) ?? 0) ? 2 : 1;
    return width <= limits.maxLineWidth!;
  });
}

/**
 * 剔除指令文本里的换行符。
 * LCF 里每一行都是独立的指令（Comment / Comment2 等），文本本身不该含换行；
 * 但官方编辑器偶尔会把换行写进字符串（还会导致重读后行数对不上），
 * 这里统一视为数据残留，直接去掉，避免多出视觉行、行号错位。
 */
export function stripNewlines(text: string): string {
  return text.replace(/[\r\n]+/g, '');
}

/** 统一的换行切分：兼容 CRLF / CR / LF */
function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/**
 * 渲染分组：Comment 与后续 Comment2 合成注释块，
 * ShowMessage 与后续 ShowMessage2 合成消息块，其余指令各自一行。
 * 每个块仍保留每行对应的行号。
 */
export function groupCommandLines(lines: CommandLine[]): RenderRow[] {
  const rows: RenderRow[] = [];
  let group: CommandLine[] | null = null;
  let groupKind: TextBlockKind | null = null;

  for (const line of lines) {
    if (line.code === Cmd.Comment) {
      group = [line];
      groupKind = 'comment';
      rows.push({ kind: 'comment', lines: group });
      continue;
    }
    if (line.code === Cmd.ShowMessage) {
      group = [line];
      groupKind = 'message';
      rows.push({ kind: 'message', lines: group });
      continue;
    }
    if (groupKind === 'comment' && group && line.code === Cmd.Comment2) {
      group.push(line);
      continue;
    }
    if (groupKind === 'message' && group && line.code === Cmd.ShowMessage2) {
      group.push(line);
      continue;
    }
    group = null;
    groupKind = null;
    rows.push({ kind: 'command', line });
  }

  return rows;
}

/** 指令簇：以代码块内的一条指令为起点；带闭合符的块会包住整个子代码块 */
export interface CommandCluster {
  /** 簇首行在指令数组中的下标 */
  index: number;
  /** 簇所在代码块的缩进层级 */
  indent: number;
  /** 簇覆盖的最后一行下标（续行 / 子代码块 / 闭合符），用于整簇高亮 */
  end: number;
}

/** 打开子代码块的指令：直到对应闭合符前都属于该块 */
const BLOCK_OPENERS = new Set<number>([
  Cmd.ConditionalBranch,
  Cmd.ConditionalBranchB,
  Cmd.Loop,
  Cmd.ShowChoice,
]);

/** 闭合符：属于所在块，自身不是独立簇 */
const BLOCK_CLOSERS = new Set<number>([
  Cmd.EndBranch,
  Cmd.EndBranchB,
  Cmd.EndLoop,
  Cmd.ShowChoiceEnd,
]);

/** 块中间的标记（否则 / 选项）：属于所在块，自身不是独立簇 */
const BLOCK_MIDDLE = new Set<number>([Cmd.ElseBranch, Cmd.ElseBranchB, Cmd.ShowChoiceOption]);

/**
 * 计算每条指令所属的「最小指令簇」。
 *   if … 子代码块 … end   → if 到 end 在父块里是一个簇
 *   cmd1 / cmd2 / @>      → 分别是子代码块里的簇
 * 闭合符与否则/选项标记归属外层块，普通指令（含块头）自成一簇。
 */
export function findCommandClusters(lines: CommandLine[]): Map<number, CommandCluster> {
  const clusters = new Map<number, CommandCluster>();
  const stack: CommandCluster[] = [];
  /** 最近一个文本块首行，续行会并入它的簇范围 */
  let textBlock: CommandCluster | null = null;

  const findBlock = (indent: number): CommandCluster | undefined => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].indent === indent) return stack[i];
    }
    return undefined;
  };

  const takeBlock = (indent: number): CommandCluster | undefined => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].indent === indent) return stack.splice(i, 1)[0];
    }
    return undefined;
  };

  for (const line of lines) {
    // 注释 / 消息的续行属于首行所在的簇
    if (line.code === Cmd.Comment2 || line.code === Cmd.ShowMessage2) {
      if (textBlock && textBlock.indent === line.indent) {
        textBlock.end = line.index;
        clusters.set(line.index, textBlock);
        continue;
      }
    }

    textBlock = null;

    if (BLOCK_CLOSERS.has(line.code)) {
      // 闭合符属于外层的块：簇位置落回块头，并延伸簇的范围
      const owner = takeBlock(line.indent);
      if (owner) {
        owner.end = line.index;
        clusters.set(line.index, owner);
      } else {
        clusters.set(line.index, { index: line.index, indent: line.indent, end: line.index });
      }
      continue;
    }

    if (BLOCK_MIDDLE.has(line.code)) {
      const owner = findBlock(line.indent);
      if (owner) {
        clusters.set(line.index, owner);
        continue;
      }
    }

    const cluster: CommandCluster = { index: line.index, indent: line.indent, end: line.index };
    clusters.set(line.index, cluster);
    if (line.code === Cmd.Comment || line.code === Cmd.ShowMessage) textBlock = cluster;
    if (BLOCK_OPENERS.has(line.code)) stack.push(cluster);
  }

  return clusters;
}

/** 待插入指令的初始数据（来自「插入指令」弹窗的参数表单） */
export interface CommandDraft {
  code: number;
  parameters: number[];
  text?: string;
}

/** 消息预览用的脸图状态：本页上方最近的「更改脸图」指令 */
export interface FaceGraphicState {
  /** 脸图文件名（FaceSet 目录下，不含扩展名） */
  name: string;
  /** 脸图编号 0-15 */
  index: number;
  /** 显示在右侧 */
  atRight: boolean;
  /** 水平翻转 */
  flipped: boolean;
}

/**
 * 找 before 之前最近的一条「更改脸图」指令。
 * 名字为空的更改脸图表示清空脸图，因此遇到就停止向上找。
 */
export function findFaceGraphicBefore(
  lines: CommandLine[],
  before: number,
): FaceGraphicState | null {
  for (let index = Math.min(before, lines.length) - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.code !== Cmd.ChangeFaceGraphic) continue;
    if (!line.text) return null;
    return {
      name: line.text,
      index: line.params[0] ?? 0,
      atRight: (line.params[1] ?? 0) !== 0,
      flipped: (line.params[2] ?? 0) !== 0,
    };
  }
  return null;
}

/** 消息预览用的 System 图状态：本页上方最近的「更改系统图像」指令 */
export interface SystemGraphicState {
  /** System 图文件名（System 目录下，不含扩展名） */
  name: string;
}

/**
 * 找 before 之前最近的一条「更改系统图像」指令。
 * 正常情况下文件名不会为空；若遇到空名（错误数据），按 EasyRPG Player 的处理
 * （Game_System::GetSystemName：graphics_name 为空时退回数据库的 system_name）
 * 返回 null，表示使用数据库里的默认 System 图。
 */
export function findSystemGraphicBefore(
  lines: CommandLine[],
  before: number,
): SystemGraphicState | null {
  for (let index = Math.min(before, lines.length) - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.code !== Cmd.ChangeSystemGraphics) continue;
    const name = line.text?.trim();
    return name ? { name } : null;
  }
  return null;
}

/** 打开子代码块的指令 → 它需要的闭合符 */
const INSERT_BLOCK_CLOSERS: Record<number, number> = {
  [Cmd.ConditionalBranch]: Cmd.EndBranch,
  [Cmd.ConditionalBranchB]: Cmd.EndBranchB,
  [Cmd.Loop]: Cmd.EndLoop,
};

/** 显示选项：可见选项上限（索引 0..3） */
const CHOICE_VISIBLE_LIMIT = 4;
/** 显示选项：取消时新建分支的分支索引（固定 4，不参与选项显示） */
const CHOICE_CANCEL_INDEX = 4;

/**
 * 把弹窗里配置好的一条指令展开成实际写入的指令序列。
 * 消息 / 注释按限制拆成首行 + 续行；带代码块的指令补齐空行（@>）与闭合符，
 * 与 RPG Maker 2000/2003 自己写出的结构保持一致。
 */
export function buildInsertedCommands(draft: CommandDraft, indent: number): EventCommand[] {
  const make = (
    code: number,
    level: number,
    parameters: number[] = [],
    string = '',
  ): EventCommand => ({
    code,
    indent: Math.max(0, level),
    parameters,
    string,
  });

  if (draft.code === Cmd.Comment || draft.code === Cmd.ShowMessage) {
    const isComment = draft.code === Cmd.Comment;
    const lines = splitCommandText(draft.text ?? '', isComment ? COMMENT_LIMITS : MESSAGE_LIMITS);
    const continuation = isComment ? Cmd.Comment2 : Cmd.ShowMessage2;
    return lines.map((line, index) =>
      make(index === 0 ? draft.code : continuation, indent, [], line),
    );
  }

  // 显示选项：结构由参数 0（取消方式）决定
  //   params[0] = 取消索引 + 1：0 禁止取消，1..4 取消时跳到选项 1..4，
  //   5 取消时新建分支（固定为索引 4 的隐藏分支，R48: choice_index_magic 4 = invisibleCancel）
  // 运行时的选项只取 parameters[0] < 4 的 20140（EasyRPG Player GetChoices），
  // 所以可见选项最多 4 个，索引必须与顺序一致；隐藏分支固定索引 4。
  if (draft.code === Cmd.ShowChoice) {
    const cancelType = draft.parameters[0] ?? 0;
    const labels = normalizeChoiceLabels(draft.text ?? '', cancelType);

    const commands = [make(Cmd.ShowChoice, indent, [cancelType], labels.join(', '))];
    const pushBranch = (index: number, label: string) => {
      commands.push(make(Cmd.ShowChoiceOption, indent, [index], label));
      commands.push(make(Cmd.End, indent + 1));
    };
    labels.forEach((label, index) => pushBranch(index, label));
    // 取消时新建分支：它的分支体是索引 4（不参与选项显示）
    if (cancelType === CHOICE_CANCEL_INDEX + 1) pushBranch(CHOICE_CANCEL_INDEX, '');
    commands.push(make(Cmd.ShowChoiceEnd, indent));
    return commands;
  }

  const closer = INSERT_BLOCK_CLOSERS[draft.code];
  if (closer !== undefined) {
    return [
      make(draft.code, indent, draft.parameters, draft.text ?? ''),
      make(Cmd.End, indent + 1),
      make(closer, indent),
    ];
  }

  return [make(draft.code, indent, draft.parameters, draft.text ?? '')];
}

function makeCommand(
  code: number,
  indent: number,
  parameters: number[] = [],
  string = '',
): EventCommand {
  return { code, indent: Math.max(0, indent), parameters, string };
}

/**
 * 对话框里的「每行一个选项」→ 最终写回的选项表。
 * 取消时跳回某个选项：该选项必须存在，缺的补空行以保持索引对应。
 */
function normalizeChoiceLabels(text: string, cancelType: number): string[] {
  const labels = text
    .split(/\r\n|\r|\n/)
    .slice(0, CHOICE_VISIBLE_LIMIT)
    .map((line) => line.trim());
  while (labels.length > 0 && labels[labels.length - 1] === '') labels.pop();

  if (cancelType >= 1 && cancelType <= CHOICE_VISIBLE_LIMIT) {
    while (labels.length < cancelType) labels.push('');
  }
  if (labels.length === 0) labels.push('');
  return labels;
}

/**
 * 双击编辑：从整簇快照里还原面板需要回填的内容。
 * 消息 / 注释按行拼回文本；显示选项取各选项行的标签（隐藏分支不算选项）。
 */
export function buildCommandEditState(snapshot: EventCommand[]): CommandDraft {
  const head = snapshot[0];
  if (!head) return { code: Cmd.End, parameters: [] };

  if (head.code === Cmd.Comment || head.code === Cmd.ShowMessage) {
    return {
      code: head.code,
      parameters: [],
      text: snapshot.map((command) => command.string ?? '').join('\n'),
    };
  }

  if (head.code === Cmd.ShowChoice) {
    const labels = snapshot
      .filter(
        (command) =>
          command.code === Cmd.ShowChoiceOption &&
          (command.parameters[0] ?? 0) !== CHOICE_CANCEL_INDEX,
      )
      .map((command) => command.string ?? '');
    return { code: head.code, parameters: [...head.parameters], text: labels.join('\n') };
  }

  return {
    code: head.code,
    parameters: [...head.parameters],
    text: head.string ? head.string : undefined,
  };
}

/**
 * 双击编辑的结果：用新配置替换整簇快照。
 *
 * - 指令码没变时保留子代码块：带块的指令只换块头，分支体与闭合符原样接回；
 * - 显示选项按新标签重建选项行，各分支体按索引原样保留；
 * - 指令码变了则等同于插入，按新指令的完整结构重建。
 */
export function buildEditedCommands(
  draft: CommandDraft,
  snapshot: EventCommand[],
  indent: number,
): EventCommand[] {
  const head = snapshot[0];
  if (!head || draft.code !== head.code) return buildInsertedCommands(draft, indent);

  // 消息 / 注释：整簇就是文本本身，按新文本重新拆行
  if (draft.code === Cmd.Comment || draft.code === Cmd.ShowMessage) {
    return buildInsertedCommands(draft, indent);
  }

  if (draft.code === Cmd.ShowChoice) {
    return rebuildChoice(draft, snapshot, indent);
  }

  const header = makeCommand(
    draft.code,
    indent,
    [...draft.parameters],
    draft.text ?? head.string ?? '',
  );

  // 条件分歧 / 循环：只替换块头，子代码块与闭合符保持原样
  if (BLOCK_OPENERS.has(draft.code)) return [header, ...snapshot.slice(1)];

  return [header];
}

/** 显示选项：重建块头与选项行，分支体按选项索引接回 */
function rebuildChoice(
  draft: CommandDraft,
  snapshot: EventCommand[],
  indent: number,
): EventCommand[] {
  const cancelType = draft.parameters[0] ?? 0;
  const labels = normalizeChoiceLabels(draft.text ?? '', cancelType);

  const bodyEnd =
    snapshot.length > 0 && snapshot[snapshot.length - 1].code === Cmd.ShowChoiceEnd
      ? snapshot.length - 1
      : snapshot.length;

  // 原有分支：选项行之后的指令都属于该选项
  const branches = new Map<number, EventCommand[]>();
  let current: number | null = null;
  for (let index = 1; index < bodyEnd; index += 1) {
    const command = snapshot[index];
    if (command.code === Cmd.ShowChoiceOption) {
      current = command.parameters[0] ?? branches.size;
      if (!branches.has(current)) branches.set(current, []);
      continue;
    }
    branches.get(current ?? -1)?.push(command);
  }

  const result: EventCommand[] = [makeCommand(Cmd.ShowChoice, indent, [...draft.parameters], labels.join(', '))];
  const pushBranch = (optionIndex: number, label: string) => {
    result.push(makeCommand(Cmd.ShowChoiceOption, indent, [optionIndex], label));
    const body = branches.get(optionIndex);
    // 新加的选项没有旧分支体：留一行空指令，和插入时的结构一致
    result.push(...(body && body.length > 0 ? body : [makeCommand(Cmd.End, indent + 1)]));
  };

  labels.forEach((label, optionIndex) => pushBranch(optionIndex, label));

  // 「取消时新建分支」的隐藏分支（索引 4）不属于 4 个可见选项，原样保留
  if (branches.has(CHOICE_CANCEL_INDEX)) pushBranch(CHOICE_CANCEL_INDEX, '');

  result.push(makeCommand(Cmd.ShowChoiceEnd, indent));
  return result;
}
