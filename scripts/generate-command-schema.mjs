/**
 * 从 R48 的事件指令 schema（.scm）生成参数模型。
 *
 * 只做「离线代码生成」：R48 的 schema 不在运行时使用，产物是
 * src/lib/commandSchema.generated.ts（需要提交）。
 *
 * 覆盖两类指令定义：
 *   1. `(p …)` / `(P …)` / `(v …)` 列表式声明；
 *   2. `(X name)` / `(x name)` 指向的数组 schema（`(] n …)`、`(+ ]?n …)`、`(+ 其它 schema)`、DA{ … } 分派）。
 *
 * 版本信息来自 schema 本身：
 *   - 参数名带 `2k3`（如 `mode2k3`）→ 只在 2003 存在；
 *   - `]?n` → 可选参数（不参与「参数不足」判断）。
 *
 * 用法：node scripts/generate-command-schema.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const R48 = 'e:/tkool-event-editor/.reference/R48/app/src/main/resources/assets';
const OUT = 'e:/tkool-event-editor/src/lib/commandSchema.generated.ts';

// ── 极简 s-expression 解析 ──────────────────────────────────────────────
function parse(src) {
  const root = [];
  const stack = [root];
  let i = 0;

  const readString = () => {
    let text = '';
    i += 1;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\\') {
        text += src[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === '"') {
        i += 1;
        return text;
      }
      text += ch;
      i += 1;
    }
    return text;
  };

  const readAtom = () => {
    let text = '';
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch) || ch === '(' || ch === ')' || ch === ';') break;
      if (ch === '\\') {
        text += src[i + 1] ?? '';
        i += 2;
        continue;
      }
      text += ch;
      i += 1;
    }
    return text;
  };

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (ch === ';') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (ch === '(') {
      const list = [];
      stack[stack.length - 1].push(list);
      stack.push(list);
      i += 1;
    } else if (ch === ')') {
      stack.pop();
      i += 1;
    } else if (ch === '"') {
      stack[stack.length - 1].push(readString());
    } else {
      stack[stack.length - 1].push(readAtom());
    }
  }

  return root;
}

const readScm = (relative) => parse(fs.readFileSync(path.join(R48, relative), 'utf8'));

const toInt = (text) => {
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

const SCHEMA_FILES = [
  'R2K/SchemaGeneral.scm',
  'R2K/SchemaScripting.scm',
  'R2K/SchemaScriptingKII.scm',
  'R2K/SchemaScriptingSBGM.scm',
  'R2K/SchemaScriptingMonolith.scm',
  'R2K/SchemaScriptingMonolith2.scm',
  'R2K/SchemaScriptingMonolith3.scm',
  'R2K/SchemaScriptingFooter.scm',
];

// ── 收集枚举、别名、数组 schema ──────────────────────────────────────────
const enums = new Map();
const aliases = new Map();
/** schema 名 → { paramsExpr, includes, extraExprs, arrayParams } */
const schemaDefs = new Map();

/** `(+ name …)` 里不是「引用另一个 schema」的那些操作 */
const specialOps = new Set(['initButton', 'r2kTonePicker', 'array', 'hide', 'optP']);

for (const file of SCHEMA_FILES) {
  let current = null;

  for (const node of readScm(file)) {
    if (!Array.isArray(node) || typeof node[0] !== 'string') continue;
    const head = node[0];

    if (head === 'e') {
      const options = {};
      for (let i = 2; i + 1 < node.length; i += 2) {
        const value = toInt(node[i]);
        if (value !== null) options[value] = String(node[i + 1]);
      }
      enums.set(node[1], options);
      current = null;
      continue;
    }

    if (head === 'E') {
      const options = {};
      for (let i = 3; i + 1 < node.length; i += 2) {
        const value = toInt(node[i]);
        if (value !== null) options[value] = String(node[i + 1]);
      }
      enums.set(node[1], options);
      current = null;
      continue;
    }

    if (head === '>') {
      aliases.set(node[1], node.slice(2));
      current = null;
      continue;
    }

    if (head === 'M') {
      // (M dictionary enum name) → 合并「id 字典」与「特殊值枚举」
      aliases.set(node[3], { dict: node[1], enum: node[2] });
      current = null;
      continue;
    }

    if (head === '.') {
      current = { paramsExpr: null, includes: [], extraExprs: [], arrayParams: [] };
      schemaDefs.set(node[1], current);
      continue;
    }

    if (!current) continue;

    if (head === '@') {
      // (@ parameters <expr>)；DA{ … } / { … } 不是括号包起来的，直接取剩余 token
      if (node[1] === 'parameters') {
        const first = node[2];
        current.paramsExpr =
          first === 'DA{' || first === '{' ? node.slice(2) : first;
      }
      continue;
    }

    if (head === ']') {
      // (] n name type …)
      current.arrayParams.push({
        raw: node[1],
        name: String(node[2] ?? ''),
        type: String(node[3] ?? ''),
      });
      continue;
    }

    if (head === '+') {
      const first = node[1];
      if (typeof first === 'string' && first.startsWith(']')) {
        // (+ ]?n name extra type) —— 取最后一个 token 作为类型
        const type = String(node[node.length - 1] ?? '');
        current.arrayParams.push({ raw: first, name: String(node[2] ?? ''), type });
      } else if (first === 'DA{' || first === '{') {
        // (+ DA{ … })：按某个参数分派出的另一套参数布局
        current.extraExprs.push(node.slice(1));
      } else if (typeof first === 'string' && !specialOps.has(first)) {
        current.includes.push(first);
      }
      // initButton / r2kTonePicker 等特殊标记忽略
      continue;
    }
  }
}

const DICTIONARIES = {
  internal_variableDictionary: 'variable',
  internal_switchDictionary: 'switch',
  internal_itemDictionary: 'item',
  internal_actorDictionary: 'actor',
  internal_skillDictionary: 'skill',
  internal_stateDictionary: 'state',
  internal_troopDictionary: 'troop',
  internal_enemyDictionary: 'enemy',
  internal_classDictionary: 'class',
  internal_cevDictionary: 'commonEvent',
  internal_mapDictionary: 'map',
  internal_eventDictionary: 'event',
  internal_battlecommandDictionary: 'battleCommand',
  internal_tilesetDictionary: 'tileset',
  internal_terrainDictionary: 'terrain',
  internal_animDictionary: 'animation',
  internal_battleanimationDictionary: 'animation',
  internal_attributeDictionary: 'attribute',
};

const BUILTINS = new Map([
  ['int', { kind: 'int' }],
  ['roint', { kind: 'int' }],
  ['index', { kind: 'int' }],
  ['hue', { kind: 'int' }],
  // percent 在 R48 里只约束输入框，实际数据常见 -255..255（如色调），不做范围限制
  ['percent', { kind: 'int' }],
  ['float', { kind: 'any' }],
  ['jnum', { kind: 'any' }],
  ['string', { kind: 'text' }],
  ['boolean', { kind: 'bool' }],
  ['booleanDefTrue', { kind: 'bool' }],
  ['int_boolean', { kind: 'bool' }],
  ['int_booleanDefTrue', { kind: 'bool' }],
  ['nil', { kind: 'any' }],
  ['OPAQUE', { kind: 'any' }],
]);

/**
 * 只把「从 0 开始的连续取值」当作封闭枚举来校验。
 * R48 里有些枚举是显示用的魔法值：或是有洞（选项下标只列了 0 和 4），
 * 或是「特殊值 + 自由范围」（如 -1 = 全队，其余是队员序号）。
 * 这些都不能当作非法输入，降级为 int。
 */
function enumSpec(options) {
  const values = Object.keys(options).map(Number).sort((a, b) => a - b);
  const closed =
    values.length >= 2 &&
    values[0] === 0 &&
    values.every((value, index) => value === index);
  return closed ? { kind: 'enum', options } : { kind: 'int' };
}

/** 把 R48 的 schema 名映射到我们的参数模型；无法识别时返回 null */
function resolveType(name, depth = 0) {
  if (!name) return null;
  if (depth > 8) return null;

  if (!enums.has(name) && !aliases.has(name) && BUILTINS.has(name)) return BUILTINS.get(name);

  if (enums.has(name)) return enumSpec(enums.get(name));

  const alias = aliases.get(name);
  if (Array.isArray(alias)) {
    // (alias type) / (alias modifier … baseType)：取第一个能解析的候选
    for (const candidate of alias) {
      const target = Array.isArray(candidate) ? candidate[0] : candidate;
      if (target === name) continue;
      const spec = resolveType(target, depth + 1);
      if (spec) return spec;
    }
  }
  if (alias && !Array.isArray(alias) && typeof alias === 'object') {
    const target = DICTIONARIES[alias.dict];
    const options = enums.get(alias.enum);
    if (target) {
      const magic = options
        ? Object.fromEntries(Object.entries(options).filter(([value]) => Number(value) >= 10000))
        : undefined;
      const spec = { kind: 'ref', target };
      if (magic && Object.keys(magic).length > 0) spec.magic = magic;
      // 字典配套的枚举里若含 0（如 Var.ID 0 = None），说明 0 是合法的「未使用」；
      // 变量 id 也一并放宽：真实工程里常见 0 表示该槽位未使用
      if ((options && '0' in options) || target === 'variable') spec.allowZero = true;
      return spec;
    }
    if (options) return enumSpec(options);
  }

  if (DICTIONARIES[name]) {
    return DICTIONARIES[name] === 'variable'
      ? { kind: 'ref', target: 'variable', allowZero: true }
      : { kind: 'ref', target: DICTIONARIES[name] };
  }

  // 命名规律兜底
  if (/^int_default_/.test(name) || /^int=/.test(name)) return { kind: 'int' };
  if (/^int\+(\d+)/.test(name)) return { kind: 'int', min: Number(name.slice(4)) };
  if (/^string/.test(name)) return { kind: 'text' };
  // 素材文件名（图片 / 音乐 / 音效等）
  if (/^f_\w+_name$/.test(name)) return { kind: 'text' };
  // 敌群内的敌人序号，不是数据库 id
  if (name === 'troop_enemy_id') return { kind: 'int' };
  if (name === 'map_id') return { kind: 'ref', target: 'map' };
  if (/^var_id/.test(name)) {
    if (/encased|indirect/.test(name)) return { kind: 'valueOrVariable' };
    return { kind: 'ref', target: 'variable', allowZero: true };
  }

  return null;
}

// ── 数组 schema 展开 ────────────────────────────────────────────────────
const unresolved = new Map();

/** 参数名里带 2k3 的，说明是 2003 新增的参数 */
function sinceOf(name) {
  return /2k3/i.test(name) ? '2k3' : undefined;
}

const paramFromDecl = (decl) => {
  const optional = decl.raw.startsWith(']?');
  const index = toInt(decl.raw.replace(/^\]\??/, ''));
  if (index === null) return null;
  const spec = resolveType(decl.type);
  if (!spec) unresolved.set(decl.type, (unresolved.get(decl.type) ?? 0) + 1);
  return {
    // R48 的数组下标含开头的 string 占位，减一是 LCF 的参数下标
    position: index - 1,
    name: decl.name,
    spec: spec ?? { kind: 'any' },
    optional,
    since: sinceOf(decl.name),
  };
};

/**
 * 展开一个 schema 的参数布局，返回若干「分支」：
 *   { when: [{index, equals}], params: Map<position, decl> }
 * 分派（DA{ … }）会按取值拆成多个分支。
 */
function expandSchema(name, when, depth = 0) {
  if (depth > 10) return [{ when, params: new Map() }];
  const def = schemaDefs.get(name);
  if (!def) return [{ when, params: new Map() }];

  let branches = expandExpr(def.paramsExpr, when, depth + 1);

  // (+ DA{ … }) 与 (@ parameters DA{ … }) 等价，只是写法不同
  for (const expr of def.extraExprs) {
    branches = crossBranches(branches, expandExpr(expr, when, depth + 1));
  }

  for (const include of def.includes) {
    branches = crossBranches(branches, expandSchema(include, when, depth + 1));
  }

  // schema 自身直接声明的数组参数（没有 parameters 表达式时也会用到）
  if (def.arrayParams.length > 0) {
    for (const branch of branches) {
      for (const decl of def.arrayParams) {
        const param = paramFromDecl(decl);
        if (param && !branch.params.has(param.position)) branch.params.set(param.position, param);
      }
    }
  }

  return branches;
}

/** 合并两组分支（条件取并集，参数取并集） */
function crossBranches(left, right) {
  const merged = [];
  for (const base of left) {
    for (const extra of right) {
      merged.push({
        when: dedupeWhen([...base.when, ...extra.when]),
        params: new Map([...base.params, ...extra.params]),
      });
    }
  }
  return merged;
}

function dedupeWhen(when) {
  const seen = new Set();
  return when.filter((item) => {
    const key = `${item.index}:${item.equals.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function expandExpr(expr, when, depth) {
  if (expr === null || expr === undefined) return [{ when, params: new Map() }];

  // (@ parameters SchemaName)
  if (typeof expr === 'string') return expandSchema(expr, when, depth + 1);

  if (Array.isArray(expr)) {
    const head = expr[0];
    // DA{ ]N <默认布局> <值> <布局> … }
    if (head === 'DA{') {
      const index = toInt(String(expr[1]).replace(/^\]/, ''));
      if (index === null) return [{ when, params: new Map() }];

      // 第 2 项是「其它取值」的默认布局（`}` 表示没有）
      const fallback = expr[2];
      const branches =
        fallback === '}' || fallback === undefined
          ? []
          : Array.isArray(fallback)
            ? expandExpr(fallback, when, depth + 1)
            : expandSchema(String(fallback), when, depth + 1);

      for (let i = 3; i + 1 < expr.length; i += 2) {
        const value = Number(expr[i]);
        if (!Number.isFinite(value)) continue;
        branches.push(
          ...expandSchema(
            String(expr[i + 1]),
            dedupeWhen([...when, { index: index - 1, equals: [value] }]),
            depth + 1,
          ),
        );
      }
      return branches.length > 0 ? branches : [{ when, params: new Map() }];
    }

    // { ]0 … ]1 … } 内联聚合（`{` 与 `}` 只是普通 token）
    const params = new Map();
    for (const item of expr) {
      if (!Array.isArray(item)) continue;
      if (item[0] === ']') {
        const param = paramFromDecl({ raw: item[1], name: String(item[2] ?? ''), type: String(item[3] ?? '') });
        if (param) params.set(param.position, param);
      } else if (item[0] === '+' && typeof item[1] === 'string' && item[1].startsWith(']')) {
        const param = paramFromDecl({
          raw: item[1],
          name: String(item[2] ?? ''),
          type: String(item[item.length - 1] ?? ''),
        });
        if (param) params.set(param.position, param);
      }
    }
    return [{ when, params }];
  }

  return [{ when, params: new Map() }];
}

// ── 解析事件指令 ────────────────────────────────────────────────────────
const COMMAND_FILES = ['R2K/CommandsGI_0.scm', 'R2K/CommandsGI_M.scm', 'R2K/CommandsGI_B.scm'];

/** code → { params, usesText, customSchema } */
const commands = new Map();
let totalParams = 0;

for (const file of COMMAND_FILES) {
  const statements = readScm(file).filter((node) => Array.isArray(node) && typeof node[0] === 'string');

  let current = null;
  let sawStringSlot = false;
  let parameterIndex = 0;
  let dynamicSlot = null;

  for (const statement of statements) {
    const head = statement[0];

    if (head === 'cmd') {
      current = { params: [], usesText: false, customSchema: null };
      commands.set(Number(statement[1]), current);
      sawStringSlot = false;
      parameterIndex = 0;
      dynamicSlot = null;
      continue;
    }
    if (!current) continue;

    if (head === 'X' || head === 'x') {
      current.customSchema = String(statement[1] ?? '');
      continue;
    }

    if (head === 'p' || head === 'P') {
      // R48 把指令的 string 字段放在 parameters[0]，所以第一条 p 永远不是语义参数
      const name = String(statement[head === 'p' ? 1 : 2] ?? '');
      const typeName = String(statement[head === 'p' ? 2 : 3] ?? '');

      if (!sawStringSlot) {
        sawStringSlot = true;
        current.usesText = name !== '_';
        continue;
      }

      const position = parameterIndex;
      parameterIndex += 1;
      const spec = resolveType(typeName);
      if (!spec) unresolved.set(typeName, (unresolved.get(typeName) ?? 0) + 1);
      current.params.push({
        position,
        name,
        spec: spec ?? { kind: 'any' },
        optional: false,
        since: sinceOf(name),
      });
      totalParams += 1;

      // P 槽位依赖另一个参数的取值；arrayDI 是 R48 parameters 的下标，
      // 减去 string 占位后才是 LCF 的参数下标
      dynamicSlot = head === 'P' ? { index: Number(statement[1]) - 1 } : null;
      continue;
    }

    if (head === 'v' && dynamicSlot) {
      const value = Number(statement[1]);
      const name = String(statement[2]);
      const typeName = String(statement[3] ?? '');
      const spec = resolveType(typeName);
      if (!spec) unresolved.set(typeName, (unresolved.get(typeName) ?? 0) + 1);
      const last = current.params[current.params.length - 1];
      last.variants = last.variants ?? [];
      last.variants.push({
        index: dynamicSlot.index,
        equals: [value],
        name,
        spec: spec ?? { kind: 'any' },
        since: sinceOf(name),
      });
    }
  }
}

/** 用 X-code 的数组 schema 补全参数布局 */
for (const command of commands.values()) {
  if (!command.customSchema || command.params.length > 0) continue;

  const all = expandSchema(command.customSchema, [], 0);
  // 第一项 `]0 _ string` 是 LCF 的 string 字段，不是语义参数
  const branches = all.map((branch) => ({
    when: branch.when,
    params: new Map([...branch.params].filter(([position]) => position >= 0)),
  }));
  command.branches = branches.filter((branch) => branch.params.size > 0);

  const positions = new Set();
  for (const branch of command.branches) for (const position of branch.params.keys()) positions.add(position);

  for (const position of [...positions].sort((a, b) => a - b)) {
    // 同一位置在不同分支里可能是不同类型（如 int / var_id），此时不做取值校验
    const decls = command.branches
      .map((branch) => ({ when: branch.when, decl: branch.params.get(position) }))
      .filter((item) => item.decl);

    const specs = new Set(decls.map((item) => JSON.stringify(item.decl.spec)));
    if (specs.size === 1 && decls.every((item) => item.when.length === 0)) {
      const decl = decls[0].decl;
      command.params.push({
        position,
        name: decl.name,
        spec: decl.spec,
        optional: decl.optional,
        since: decl.since,
      });
      totalParams += 1;
      continue;
    }

    for (const item of decls) {
      command.params.push({
        position,
        name: item.decl.name,
        spec: specs.size === 1 ? item.decl.spec : { kind: 'any' },
        optional: item.decl.optional,
        since: item.decl.since,
        when: item.when.length === 1 ? item.when[0] : undefined,
      });
    }
    totalParams += 1;
  }
}

/** 某个分支在指定引擎下的必需参数个数 */
function requiredInBranch(params, engine) {
  let max = 0;
  for (const param of params.values()) {
    if (param.optional) continue;
    if (param.since && param.since !== engine) continue;
    max = Math.max(max, param.position + 1);
  }
  return max;
}

/** 一条指令在指定引擎下的最少参数个数：各布局分支取最小值，避免误报 */
function minParamsFor(command, engine) {
  if (command.branches && command.branches.length > 0) {
    return Math.min(...command.branches.map((branch) => requiredInBranch(branch.params, engine)));
  }
  return command.params.reduce((max, param) => {
    if (param.optional) return max;
    if (param.since && param.since !== engine) return max;
    return Math.max(max, param.position + 1);
  }, 0);
}

// ── 输出 ────────────────────────────────────────────────────────────────
const lines = [];
lines.push('/**');
lines.push(' * 由 scripts/generate-command-schema.mjs 从 R48 的 schema 生成，请勿手工修改。');
lines.push(' * 数据来源：.reference/R48/app/src/main/resources/assets/R2K/');
lines.push(' *   - CommandsGI_{0,M,B}.scm（指令与参数声明）');
lines.push(' *   - SchemaScripting*.scm（参数数组 schema、枚举、id 字典）');
lines.push(' */');
lines.push("import type { ParamSpec } from './commandSpec';");
lines.push('');
lines.push("export type SchemaEngine = '2k' | '2k3';");
lines.push('');
lines.push('export interface SchemaParamSlot {');
lines.push('  /** 参数在数组中的位置，从 0 开始 */');
lines.push('  position: number;');
lines.push('  /** R48 schema 里的参数名，仅用于阅读与后续 UI */');
lines.push('  name: string;');
lines.push('  spec: ParamSpec;');
lines.push('  /** 该参数只在指定引擎里存在（2003 新增的参数名通常带 2k3 后缀） */');
lines.push('  since?: SchemaEngine;');
lines.push('  /** 仅当某参数取指定值时，该位置的语义才生效 */');
lines.push('  when?: { index: number; equals: number[] };');
lines.push('}');
lines.push('');
lines.push('export interface SchemaCommand {');
lines.push('  /** 各引擎下的最少参数个数（可选参数不计入）；null 表示布局未知 */');
lines.push('  minParams: Record<SchemaEngine, number> | null;');
lines.push('  /** 指令文本（string 字段）是否有意义 */');
lines.push('  usesText: boolean;');
lines.push('  params: SchemaParamSlot[];');
lines.push('}');
lines.push('');
lines.push('export const COMMAND_SCHEMA: Record<number, SchemaCommand> = {');

const sortedCodes = [...commands.keys()].sort((a, b) => a - b);
for (const code of sortedCodes) {
  const command = commands.get(code);
  // 有 X-code 却一条参数都没解析出来 → 布局未知（不能当成「无参数」）
  const unknown = Boolean(command.customSchema) && command.params.length === 0;

  lines.push(`  ${code}: {`);
  lines.push(
    unknown
      ? '    minParams: null,'
      : `    minParams: { '2k': ${minParamsFor(command, '2k')}, '2k3': ${minParamsFor(command, '2k3')} },`,
  );
  lines.push(`    usesText: ${command.usesText},`);
  lines.push('    params: [');
  for (const param of command.params) {
    const fields = [
      `position: ${param.position}`,
      `name: ${JSON.stringify(param.name)}`,
      `spec: ${JSON.stringify(param.spec)}`,
    ];
    if (param.since) fields.push(`since: '${param.since}'`);
    if (param.when) fields.push(`when: { index: ${param.when.index}, equals: [${param.when.equals.join(', ')}] }`);
    lines.push(`      { ${fields.join(', ')} },`);

    for (const variant of param.variants ?? []) {
      const variantFields = [
        `position: ${param.position}`,
        `name: ${JSON.stringify(variant.name)}`,
        `spec: ${JSON.stringify(variant.spec)}`,
      ];
      if (variant.since) variantFields.push(`since: '${variant.since}'`);
      variantFields.push(`when: { index: ${variant.index}, equals: [${variant.equals.join(', ')}] }`);
      lines.push(`      { ${variantFields.join(', ')} },`);
    }
  }
  lines.push('    ],');
  lines.push('  },');
}
lines.push('};');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

// ── 统计 ────────────────────────────────────────────────────────────────
const withSchema = [...commands.values()].filter((command) => command.params.length > 0).length;
const unknownLayout = [...commands.entries()]
  .filter(([, command]) => command.customSchema && command.params.length === 0)
  .map(([code]) => code);
const sinceCount = [...commands.values()].reduce(
  (sum, command) => sum + command.params.filter((param) => param.since).length,
  0,
);
console.log(
  `commands: ${commands.size}（有参数布局 ${withSchema}）, params: ${totalParams}, since-2k3: ${sinceCount}`,
);
console.log('布局未知（由 X-code 描述、无法静态推导）:', unknownLayout.join(', ') || '无');
console.log('enums:', enums.size, 'aliases:', aliases.size, 'array schemas:', schemaDefs.size);
console.log('unresolved types:', JSON.stringify([...unresolved.entries()].sort((a, b) => b[1] - a[1])));
console.log('written:', OUT);
