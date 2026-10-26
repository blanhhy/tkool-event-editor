import { Cmd } from './commandCodes';
import { EASYRPG_COMMANDS, MANIAC_COMMANDS, type Engine, type Runtime } from './environment';
import { findCommandMeta } from './eventCommands';
import type { EventCategory } from './events';

/**
 * 指令选择面板的内容。
 *
 * 顺序与 RPG Maker 2003 的「插入指令」面板保持一致（图 1–4），
 * 敌群事件页改用「战斗事件指令」面板（图 5）。
 * 2000 里属于内部、2003 才公开的指令（读档、离开游戏、调用公共事件等）
 * 在 2k 下也照常列出——它们可读可运行，只是官方面板不提供入口。
 * 第三方扩展指令集不混页：各自从新页开始，即使上一页没排满。
 */

export interface CommandEntry {
  code: number;
  label: string;
  /** 仅在该引擎的编辑器里出现 */
  since?: Engine;
}

export interface CommandPage {
  /** 页标签：官方页是序号，扩展页是指令集名 */
  label: string;
  /** 单列最大行数，决定页面分几列（也决定对话框高度） */
  maxRows: number;
  entries: CommandEntry[];
}

const PAGE_1: CommandEntry[] = [
  { code: Cmd.ShowMessage, label: '显示文字…' },
  { code: Cmd.MessageOptions, label: '文字显示选项…' },
  { code: Cmd.ChangeFaceGraphic, label: '更改头像…' },
  { code: Cmd.ShowChoice, label: '显示选择项…' },
  { code: Cmd.InputNumber, label: '数值输入处理…' },
  { code: Cmd.ControlSwitches, label: '控制开关…' },
  { code: Cmd.ControlVars, label: '控制变量…' },
  { code: Cmd.TimerOperation, label: '控制计时器…' },
  { code: Cmd.ChangeGold, label: '更改金钱…' },
  { code: Cmd.ChangeItems, label: '更改道具…' },
  { code: Cmd.ChangePartyMembers, label: '更改队伍成员…' },
  { code: Cmd.ChangeExp, label: '更改经验值…' },
  { code: Cmd.ChangeLevel, label: '更改等级…' },
  { code: Cmd.ChangeParameters, label: '更改能力值…' },
  { code: Cmd.ChangeSkills, label: '更改技能…' },
  { code: Cmd.ChangeEquipment, label: '更改装备…' },
  { code: Cmd.ChangeHP, label: '更改 HP…' },
  { code: Cmd.ChangeSP, label: '更改 MP…' },
  { code: Cmd.ChangeCondition, label: '更改状态…' },
  { code: Cmd.FullHeal, label: '全体恢复…' },
  { code: Cmd.SimulatedAttack, label: '伤害处理…' },
  { code: Cmd.ChangeHeroName, label: '更改角色名字…' },
  { code: Cmd.ChangeHeroTitle, label: '更改角色称号…' },
  { code: Cmd.ChangeSpriteAssociation, label: '更改角色图像…' },
  { code: Cmd.ChangeActorFace, label: '更改角色头像…' },
  { code: Cmd.ChangeVehicleGraphic, label: '更改交通工具图像…' },
  { code: Cmd.ChangeSystemBGM, label: '更改系统 BGM…' },
  { code: Cmd.ChangeSystemSFX, label: '更改系统 SE…' },
  { code: Cmd.ChangeSystemGraphics, label: '更改系统图像…' },
  { code: Cmd.ChangeScreenTransitions, label: '更改画面转场…' },
];

const PAGE_2: CommandEntry[] = [
  { code: Cmd.EnemyEncounter, label: '战斗处理…' },
  { code: Cmd.OpenShop, label: '商店处理…' },
  { code: Cmd.ShowInn, label: '旅馆处理…' },
  { code: Cmd.EnterHeroName, label: '名字输入处理…' },
  { code: Cmd.Teleport, label: '转移玩家…' },
  { code: Cmd.MemorizeLocation, label: '获取玩家位置…' },
  { code: Cmd.RecallToLocation, label: '移动到保存位置…' },
  { code: Cmd.EnterExitVehicle, label: '乘降交通工具' },
  { code: Cmd.SetVehicleLocation, label: '设置交通工具位置…' },
  { code: Cmd.ChangeEventLocation, label: '设置事件位置…' },
  { code: Cmd.TradeEventLocations, label: '交换事件位置…' },
  { code: Cmd.StoreTerrainID, label: '获取地形 ID…' },
  { code: Cmd.StoreEventID, label: '获取事件 ID…' },
  { code: Cmd.EraseScreen, label: '淡出画面…' },
  { code: Cmd.ShowScreen, label: '淡入画面…' },
  { code: Cmd.TintScreen, label: '着色画面…' },
  { code: Cmd.FlashScreen, label: '闪光画面…' },
  { code: Cmd.ShakeScreen, label: '震动画面…' },
  { code: Cmd.PanScreen, label: '滚动地图…' },
  { code: Cmd.WeatherEffects, label: '设置天气效果…' },
  { code: Cmd.ShowPicture, label: '显示图片…' },
  { code: Cmd.MovePicture, label: '移动图片…' },
  { code: Cmd.ErasePicture, label: '清除图片…' },
  { code: Cmd.ShowBattleAnimation, label: '显示动画…' },
  { code: Cmd.PlayerVisibility, label: '显示/隐藏玩家…' },
  { code: Cmd.FlashSprite, label: '闪光事件…' },
  { code: Cmd.MoveEvent, label: '设置移动路线…' },
  { code: Cmd.ProceedWithMovement, label: '执行所有移动路线' },
  { code: Cmd.HaltAllMovement, label: '停止所有移动路线' },
  { code: Cmd.Wait, label: '等待…' },
];

const PAGE_3: CommandEntry[] = [
  { code: Cmd.PlayBGM, label: '播放 BGM…' },
  { code: Cmd.FadeOutBGM, label: '淡出 BGM…' },
  { code: Cmd.MemorizeBGM, label: '保存 BGM' },
  { code: Cmd.PlayMemorizedBGM, label: '重放 BGM' },
  { code: Cmd.PlaySound, label: '播放 SE…' },
  { code: Cmd.PlayMovie, label: '播放影片…' },
  { code: Cmd.KeyInputProc, label: '按键输入处理…' },
  { code: Cmd.ChangeMapTileset, label: '更改地图图块…' },
  { code: Cmd.ChangePBG, label: '更改远景…' },
  { code: Cmd.ChangeEncounterSteps, label: '设置遭遇机率…' },
  { code: Cmd.TileSubstitution, label: '更改图块…' },
  { code: Cmd.TeleportTargets, label: '设置传送点…' },
  { code: Cmd.ChangeTeleportAccess, label: '更改传送权限…' },
  { code: Cmd.EscapeTarget, label: '设置逃跑位置…' },
  { code: Cmd.ChangeEscapeAccess, label: '更改逃跑权限…' },
  { code: Cmd.OpenSaveMenu, label: '打开存档画面' },
  { code: Cmd.ChangeSaveAccess, label: '更改存档权限…' },
  { code: Cmd.OpenMainMenu, label: '打开选单画面' },
  { code: Cmd.ChangeMainMenuAccess, label: '更改选单权限…' },
  { code: Cmd.ConditionalBranch, label: '条件分歧…' },
  { code: Cmd.Label, label: '标签…' },
  { code: Cmd.JumpToLabel, label: '跳转至标签…' },
  { code: Cmd.Loop, label: '循环' },
  { code: Cmd.BreakLoop, label: '中断循环' },
  { code: Cmd.EndEventProcessing, label: '中断事件处理' },
  { code: Cmd.EraseEvent, label: '暂时消除事件' },
  { code: Cmd.CallEvent, label: '调用指定事件…' },
  { code: Cmd.Comment, label: '注释…' },
  { code: Cmd.GameOver, label: '游戏结束' },
  { code: Cmd.ReturntoTitleScreen, label: '回到标题画面' },
];

/**
 * 2000 里是内部指令、2003 才公开的条目要照常显示：
 * 实测 2000 编辑器能渲染它们（只是不能编辑），运行时也能执行。
 */
const PAGE_4: CommandEntry[] = [
  { code: Cmd.ChangeClass, label: '更改角色职业…', since: '2k3' },
  { code: Cmd.ChangeBattleCommands, label: '更改战斗指令…', since: '2k3' },
  // 2k 内部指令：2000 面板原本不提供，但数据里存在且可运行
  { code: Cmd.OpenLoadMenu, label: '打开读档画面' },
  { code: Cmd.ExitGame, label: '离开游戏' },
  { code: Cmd.ToggleAtbMode, label: '切换 ATB 等待模式', since: '2k3' },
  { code: Cmd.ToggleFullscreen, label: '切换全萤幕模式', since: '2k3' },
  { code: Cmd.OpenVideoOptions, label: '打开游戏选项设置', since: '2k3' },
];

/** 敌群事件页的「战斗事件指令」面板 */
const BATTLE_PAGE: CommandEntry[] = [
  { code: Cmd.ShowMessage, label: '显示文字…' },
  { code: Cmd.ChangeFaceGraphic, label: '更改头像…' },
  { code: Cmd.ShowChoice, label: '显示选择项…' },
  { code: Cmd.InputNumber, label: '数值输入处理…' },
  { code: Cmd.ControlSwitches, label: '控制开关…' },
  { code: Cmd.ControlVars, label: '控制变量…' },
  { code: Cmd.ChangeGold, label: '更改金钱…' },
  { code: Cmd.ChangeItems, label: '更改道具…' },
  { code: Cmd.ChangePartyMembers, label: '更改队伍成员…' },
  { code: Cmd.ChangeLevel, label: '更改等级…' },
  { code: Cmd.ChangeSkills, label: '更改技能…' },
  { code: Cmd.ChangeEquipment, label: '更改装备…' },
  { code: Cmd.ChangeHP, label: '更改 HP…' },
  { code: Cmd.ChangeSP, label: '更改 MP…' },
  { code: Cmd.ChangeCondition, label: '更改状态…' },
  { code: Cmd.FullHeal, label: '全体恢复…' },
  { code: Cmd.ChangeMonsterHP, label: '更改敌人 HP…' },
  { code: Cmd.ChangeMonsterMP, label: '更改敌人 MP…' },
  { code: Cmd.ChangeMonsterCondition, label: '更改敌人状态…' },
  { code: Cmd.EnemyEncounter, label: '敌人遭遇…' },
  { code: Cmd.ChangeBattleBG, label: '更改战斗背景…' },
  { code: Cmd.TintScreen, label: '着色画面…' },
  { code: Cmd.FlashScreen, label: '闪光画面…' },
  { code: Cmd.ShakeScreen, label: '震动画面…' },
  { code: Cmd.ShowPicture, label: '显示图片…' },
  { code: Cmd.MovePicture, label: '移动图片…' },
  { code: Cmd.ErasePicture, label: '清除图片…' },
  { code: Cmd.ShowBattleAnimationB, label: '显示动画…' },
  // 2000 里属于内部指令，2003 才出现在面板；数据可读可运行，照常列出
  { code: Cmd.EnableCombo, label: '行动次数…' },
  { code: Cmd.ForceFlee, label: '强制逃脱…' },
  { code: Cmd.Wait, label: '等待…' },
  { code: Cmd.PlayBGM, label: '播放 BGM…' },
  { code: Cmd.FadeOutBGM, label: '淡出 BGM…' },
  { code: Cmd.PlaySound, label: '播放 SE…' },
  { code: Cmd.ConditionalBranchB, label: '条件分歧…' },
  { code: Cmd.EndEventProcessing, label: '中断事件处理' },
  { code: Cmd.CallCommonEvent, label: '调用公共事件…' },
  { code: Cmd.Comment, label: '注释…' },
  { code: Cmd.GameOver, label: '游戏结束' },
  { code: Cmd.TerminateBattle, label: '中断战斗' },
];

/** 官方指令集的总行数（面板一列最多 15 行；战斗面板 20 行） */
const CORE_MAX_ROWS = 15;
const BATTLE_MAX_ROWS = 20;

export interface CommandPickerEnv {
  engine: Engine;
  runtime: Runtime;
  scope?: EventCategory;
}

/** 按当前工程环境生成选择面板的页列表 */
export function buildCommandPages(env: CommandPickerEnv): CommandPage[] {
  const pages: CommandPage[] = [];
  const isBattle = env.scope === 'troop';

  if (isBattle) {
    pages.push({
      label: '1',
      maxRows: BATTLE_MAX_ROWS,
      entries: filterByEngine(BATTLE_PAGE, env.engine),
    });
  } else {
    const core = [PAGE_1, PAGE_2, PAGE_3, PAGE_4];
    core.forEach((entries, index) => {
      const filtered = filterByEngine(entries, env.engine);
      // 过滤后为空的页不生成；2k 的第 4 页只剩内部指令（读档 / 离开游戏）
      if (filtered.length === 0) return;
      pages.push({
        label: String(index + 1),
        maxRows: CORE_MAX_ROWS,
        entries: filtered,
      });
    });
  }

  // 扩展指令集各自从新页开始，不与官方指令或其他扩展混页
  if (env.runtime === 'easyrpg') {
    pages.push(...extensionPages('EasyRPG', EASYRPG_COMMANDS));
  } else if (env.runtime === 'maniac') {
    pages.push(...extensionPages('Maniac', MANIAC_COMMANDS));
  }

  return pages;
}

function filterByEngine(entries: CommandEntry[], engine: Engine): CommandEntry[] {
  return entries.filter((entry) => !entry.since || entry.since === engine);
}

function extensionPages(label: string, codes: Iterable<number>): CommandPage[] {
  const entries: CommandEntry[] = Array.from(codes, (code) => ({
    code,
    label: findCommandMeta(code)?.name ?? `指令 ${code}`,
  }));

  const pages: CommandPage[] = [];
  for (let offset = 0; offset < entries.length; offset += CORE_MAX_ROWS * 2) {
    pages.push({
      label: pages.length === 0 ? label : `${label} ${pages.length + 1}`,
      maxRows: CORE_MAX_ROWS,
      entries: entries.slice(offset, offset + CORE_MAX_ROWS * 2),
    });
  }

  return pages;
}

/**
 * 把一页的条目按「先填满左列，再填右列」的方式切成列。
 * 条目不超过 maxRows 时只用一列（对应图 4 的单列布局）。
 */
export function splitCommandColumns(page: CommandPage): CommandEntry[][] {
  const { entries, maxRows } = page;
  if (entries.length === 0) return [];

  const columnCount = Math.max(1, Math.ceil(entries.length / maxRows));
  const rows = Math.ceil(entries.length / columnCount);

  return Array.from({ length: columnCount }, (_, index) =>
    entries.slice(index * rows, (index + 1) * rows),
  );
}
