/**
 * 事件指令码。
 *
 * 名称取自 EasyRPG 的 lcf::rpg::EventCommand::Code（少数补充的按语义命名），
 * 值就是 LCF 事件指令里存储的 code，改动会直接破坏读写，务必与 .reference 对齐。
 */
export const Cmd = {
  End: 10,

  // ── 2k 内部 / 2k3 公开 ────────────────────────────────
  CallCommonEvent: 1005,
  ForceFlee: 1006,
  EnableCombo: 1007,
  ChangeClass: 1008,
  ChangeBattleCommands: 1009,

  // ── EasyRPG 扩展 ──────────────────────────────────────
  EasyRpgTriggerEventAt: 2002,
  EasyRpgPathfinder: 2003,
  EasyRpgCallMovementAction: 2050,
  EasyRpgWaitForSingleMovement: 2051,
  EasyRpgAnimateVariable: 2052,
  EasyRpgSetInterpreterFlag: 2053,
  EasyRpgProcessJson: 2055,
  EasyRpgCloneMapEvent: 2056,
  EasyRpgDestroyMapEvent: 2057,
  EasyRpgStringPictureMenu: 2058,

  // ── Maniac Patch 扩展 ─────────────────────────────────
  ManiacGetSaveInfo: 3001,
  ManiacSave: 3002,
  ManiacLoad: 3003,
  ManiacEndLoadProcess: 3004,
  ManiacGetMousePosition: 3005,
  ManiacSetMousePosition: 3006,
  ManiacShowStringPicture: 3007,
  ManiacGetPictureInfo: 3008,
  ManiacControlBattle: 3009,
  ManiacControlAtbGauge: 3010,
  ManiacChangeBattleCommandEx: 3011,
  ManiacGetBattleInfo: 3012,
  ManiacControlVarArray: 3013,
  ManiacKeyInputProcEx: 3014,
  ManiacRewriteMap: 3015,
  ManiacControlGlobalSave: 3016,
  ManiacChangePictureId: 3017,
  ManiacSetGameOption: 3018,
  ManiacCallCommand: 3019,
  ManiacControlStrings: 3020,
  ManiacGetGameInfo: 3021,
  ManiacEditPicture: 3025,
  ManiacWritePicture: 3026,
  ManiacAddMoveRoute: 3027,
  ManiacEditTile: 3028,
  ManiacControlTextProcessing: 3029,
  ManiacZoom: 3032,

  // ── 2k3 系统菜单 ──────────────────────────────────────
  OpenLoadMenu: 5001,
  ExitGame: 5002,
  ToggleAtbMode: 5003,
  ToggleFullscreen: 5004,
  OpenVideoOptions: 5005,

  // ── 消息 ──────────────────────────────────────────────
  ShowMessage: 10110,
  MessageOptions: 10120,
  ChangeFaceGraphic: 10130,
  ShowChoice: 10140,
  InputNumber: 10150,

  // ── 开关 / 变量 / 计时器 ──────────────────────────────
  ControlSwitches: 10210,
  ControlVars: 10220,
  TimerOperation: 10230,

  // ── 队伍 / 物品 / 金钱 ────────────────────────────────
  ChangeGold: 10310,
  ChangeItems: 10320,
  ChangePartyMembers: 10330,

  // ── 角色 ──────────────────────────────────────────────
  ChangeExp: 10410,
  ChangeLevel: 10420,
  ChangeParameters: 10430,
  ChangeSkills: 10440,
  ChangeEquipment: 10450,
  ChangeHP: 10460,
  ChangeSP: 10470,
  ChangeCondition: 10480,
  FullHeal: 10490,
  SimulatedAttack: 10500,

  // ── 角色外观 / 系统资源 ───────────────────────────────
  ChangeHeroName: 10610,
  ChangeHeroTitle: 10620,
  ChangeSpriteAssociation: 10630,
  ChangeActorFace: 10640,
  ChangeVehicleGraphic: 10650,
  ChangeSystemBGM: 10660,
  ChangeSystemSFX: 10670,
  ChangeSystemGraphics: 10680,
  ChangeScreenTransitions: 10690,

  // ── 场景 ──────────────────────────────────────────────
  EnemyEncounter: 10710,
  OpenShop: 10720,
  ShowInn: 10730,
  EnterHeroName: 10740,

  // ── 位置 / 载具 ───────────────────────────────────────
  Teleport: 10810,
  MemorizeLocation: 10820,
  RecallToLocation: 10830,
  EnterExitVehicle: 10840,
  SetVehicleLocation: 10850,
  ChangeEventLocation: 10860,
  TradeEventLocations: 10870,
  StoreTerrainID: 10910,
  StoreEventID: 10920,

  // ── 画面 ──────────────────────────────────────────────
  EraseScreen: 11010,
  ShowScreen: 11020,
  TintScreen: 11030,
  FlashScreen: 11040,
  ShakeScreen: 11050,
  PanScreen: 11060,
  WeatherEffects: 11070,

  // ── 图片 / 动画 ───────────────────────────────────────
  ShowPicture: 11110,
  MovePicture: 11120,
  ErasePicture: 11130,
  ShowBattleAnimation: 11210,

  // ── 角色 / 事件移动 ───────────────────────────────────
  PlayerVisibility: 11310,
  FlashSprite: 11320,
  MoveEvent: 11330,
  ProceedWithMovement: 11340,
  HaltAllMovement: 11350,
  Wait: 11410,

  // ── 音频 / 视频 ───────────────────────────────────────
  PlayBGM: 11510,
  FadeOutBGM: 11520,
  MemorizeBGM: 11530,
  PlayMemorizedBGM: 11540,
  PlaySound: 11550,
  PlayMovie: 11560,
  KeyInputProc: 11610,

  // ── 地图 ──────────────────────────────────────────────
  ChangeMapTileset: 11710,
  ChangePBG: 11720,
  ChangeEncounterSteps: 11740,
  TileSubstitution: 11750,
  TeleportTargets: 11810,
  ChangeTeleportAccess: 11820,
  EscapeTarget: 11830,
  ChangeEscapeAccess: 11840,

  // ── 菜单 / 存档 ───────────────────────────────────────
  OpenSaveMenu: 11910,
  ChangeSaveAccess: 11930,
  OpenMainMenu: 11950,
  ChangeMainMenuAccess: 11960,

  // ── 流程控制 ──────────────────────────────────────────
  ConditionalBranch: 12010,
  Label: 12110,
  JumpToLabel: 12120,
  Loop: 12210,
  BreakLoop: 12220,
  EndEventProcessing: 12310,
  EraseEvent: 12320,
  CallEvent: 12330,
  Comment: 12410,
  GameOver: 12420,
  ReturntoTitleScreen: 12510,

  // ── 战斗事件 ──────────────────────────────────────────
  ChangeMonsterHP: 13110,
  ChangeMonsterMP: 13120,
  ChangeMonsterCondition: 13130,
  ShowHiddenMonster: 13150,
  ChangeBattleBG: 13210,
  ShowBattleAnimationB: 13260,
  ConditionalBranchB: 13310,
  TerminateBattle: 13410,

  // ── 语法 / 结构标记 ───────────────────────────────────
  ShowMessage2: 20110,
  ShowChoiceOption: 20140,
  ShowChoiceEnd: 20141,
  VictoryHandler: 20710,
  EscapeHandler: 20711,
  DefeatHandler: 20712,
  EndBattle: 20713,
  Transaction: 20720,
  NoTransaction: 20721,
  EndShop: 20722,
  Stay: 20730,
  NoStay: 20731,
  EndInn: 20732,
  ElseBranch: 22010,
  EndBranch: 22011,
  EndLoop: 22210,
  Comment2: 22410,
  ElseBranchB: 23310,
  EndBranchB: 23311,
} as const;

export type CmdCode = (typeof Cmd)[keyof typeof Cmd];
