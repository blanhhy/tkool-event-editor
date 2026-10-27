import { useMemo, useState } from 'react';
import type { Engine } from '../lib/environment';
import {
  buildCommandForm,
  fieldLabel,
  initialValues,
  resolveField,
  type CommandFormModel,
} from '../lib/commandForm';
import type { CommandDraft } from '../lib/eventCommands';
import {
  COMMAND_DIALOGS,
  type DialogField,
  type DialogRow,
  type DialogSpec,
  type GroupControl,
  type GroupPart,
  type GroupRow,
  type GroupSection,
} from '../lib/commandDialogs';

interface Props {
  code: number;
  label: string;
  engine: Engine;
  onCancel: () => void;
  onConfirm: (draft: CommandDraft) => void;
}

/**
 * 单条指令的编辑对话框。
 * 有官方布局（sections）的指令按手册还原成分组框 + 单选行；
 * 其余指令退回平铺字段或 schema 自动排列。
 */
export default function CommandParamsForm({ code, label, engine, onCancel, onConfirm }: Props) {
  const model = useMemo(() => buildCommandForm(code, engine), [code, engine]);
  const spec = COMMAND_DIALOGS[code];
  const [values, setValues] = useState<number[]>(() => buildInitialValues(model, spec));
  const [text, setText] = useState('');
  const [raw, setRaw] = useState('');

  const setParam = (p: number, rawValue: number, min?: number, max?: number) => {
    setValues((prev) => {
      const next = [...prev];
      while (next.length <= p) next.push(0);
      let value = Number.isFinite(rawValue) ? Math.trunc(rawValue) : 0;
      if (min !== undefined) value = Math.max(min, value);
      if (max !== undefined) value = Math.min(max, value);
      next[p] = value;
      return next;
    });
  };

  const confirm = () => {
    const parameters = model.unknownLayout && !spec
      ? raw
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item))
      : values;
    onConfirm({ code, parameters, text: textEnabled ? text : undefined });
  };

  const textEnabled = !!spec?.text || model.usesText;
  const textLabel = spec?.text?.label ?? '文本';

  return (
    <div className="commandDialog">
      <div className="commandDialogTitle">
        <span className="commandDialogName">{label}</span>
        <span className="commandDialogCode">#{code}</span>
      </div>

      <div className="commandDialogBody">
        {textEnabled && (
          <div className="dialogTextBlock">
            <span className="dialogRowLabel">{textLabel}</span>
            {spec?.text?.lines ? (
              <ChoiceLines count={spec.text.lines} value={text} onChange={setText} />
            ) : (
              <textarea
                className="commandTextField"
                rows={spec?.text?.rows ?? 3}
                value={text}
                spellCheck={false}
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </div>
        )}

        {model.unknownLayout && !spec && (
          <div className="dialogRow">
            <span className="dialogRowLabel">原始参数</span>
            <div className="dialogRowFields">
              <input
                className="commandFieldInput"
                value={raw}
                spellCheck={false}
                placeholder="逗号或空格分隔的整数"
                onChange={(event) => setRaw(event.target.value)}
              />
            </div>
          </div>
        )}

        {spec?.sections ? (
          <Sections sections={spec.sections} values={values} onParam={setParam} />
        ) : spec ? (
          <>
            {(spec.rows ?? [])
              .filter((item) => isVisible(item, values))
              .map((item, index) => (
                <DialogRowView
                  key={index}
                  row={item}
                  values={values}
                  onParam={setParam}
                />
              ))}
            {spec.note && <div className="dialogNote">{spec.note}</div>}
          </>
        ) : (
          <FallbackRows model={model} values={values} onParam={setParam} />
        )}
      </div>

      <div className="commandDialogFooter">
        <button type="button" className="commandParamsButton" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="commandParamsButton commandParamsConfirm"
          onClick={confirm}
        >
          确定
        </button>
      </div>
    </div>
  );
}

function buildInitialValues(model: CommandFormModel, spec?: DialogSpec): number[] {
  const values = initialValues(model);
  const schemaPositions = new Set(model.fields.map((field) => field.position));
  const ensure = (position: number) => {
    while (values.length <= position) values.push(0);
  };

  const applyDefault = (position: number, control?: GroupControl) => {
    ensure(position);
    if (schemaPositions.has(position)) return;
    if (!control) {
      values[position] = 0;
      return;
    }
    values[position] =
      control.kind === 'ref'
        ? 1
        : control.kind === 'select'
          ? Number(Object.keys(control.options)[0])
          : 0;
  };

  // 旧格式（平铺行）
  for (const item of spec?.rows ?? []) {
    for (const field of item.fields) applyDefault(field.p);
  }

  // 官方布局（分组 + 单选）
  for (const section of spec?.sections ?? []) {
    for (const item of section.rows) {
      if (item.p !== undefined) applyDefault(item.p);
      for (const part of item.parts ?? []) {
        if (typeof part !== 'string') applyDefault(part.p, part);
      }
      for (const option of item.options ?? []) {
        for (const part of option.parts ?? []) {
          if (typeof part !== 'string') applyDefault(part.p, part);
        }
      }
    }
  }

  for (const [position, value] of Object.entries(spec?.defaults ?? {})) {
    ensure(Number(position));
    values[Number(position)] = value;
  }

  if (spec?.paramCount) ensure(spec.paramCount - 1);

  return values;
}

function isVisible(row: { when?: [number, number[]] }, values: number[]): boolean {
  if (!row.when) return true;
  return row.when[1].includes(values[row.when[0]] ?? 0);
}

/* ── 官方布局 ─────────────────────────────────────── */

function Sections({
  sections,
  values,
  onParam,
}: {
  sections: GroupSection[];
  values: number[];
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  return (
    <>
      {sections
        .filter((section) => isVisible(section, values))
        .map((section, index) => (
          <fieldset className="dialogSection" key={index}>
            {section.title && <legend>{section.title}</legend>}
            {section.rows
              .filter((item) => isVisible(item, values))
              .map((item, rowIndex) => (
                <GroupRowView
                  key={rowIndex}
                  row={item}
                  values={values}
                  onParam={onParam}
                />
              ))}
          </fieldset>
        ))}
    </>
  );
}

function GroupRowView({
  row: item,
  values,
  onParam,
}: {
  row: GroupRow;
  values: number[];
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  if (item.type === 'check' && item.p !== undefined) {
    const p = item.p;
    return (
      <label className="dialogCheck">
        <input
          type="checkbox"
          checked={(values[p] ?? 0) !== 0}
          onChange={(event) => onParam(p, event.target.checked ? 1 : 0)}
        />
        <span>{item.label}</span>
      </label>
    );
  }

  if (item.type === 'radio' && item.p !== undefined) {
    const p = item.p;
    return (
      <div className="dialogOptions">
        {(item.options ?? []).map((option) => {
          const selected = (values[p] ?? 0) === option.value;
          return (
            <div className="dialogOption" key={option.value}>
              <label className="dialogRadio">
                <input
                  type="radio"
                  name={`param-${p}`}
                  checked={selected}
                  onChange={() => onParam(p, option.value)}
                />
                <span>{option.label}</span>
              </label>
              {option.parts && (
                <GroupParts
                  parts={option.parts}
                  values={values}
                  disabled={!selected}
                  onParam={onParam}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="dialogRow">
      {item.label && <span className="dialogRowLabel">{item.label}</span>}
      <div className="dialogRowFields">
        <GroupParts parts={item.parts ?? []} values={values} onParam={onParam} />
      </div>
    </div>
  );
}

function GroupParts({
  parts,
  values,
  disabled,
  onParam,
}: {
  parts: GroupPart[];
  values: number[];
  disabled?: boolean;
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  return (
    <>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          <span className="dialogLiteral" key={index}>
            {part}
          </span>
        ) : (
          <GroupControlView
            key={index}
            control={part}
            values={values}
            disabled={disabled}
            onParam={onParam}
          />
        ),
      )}
    </>
  );
}

function GroupControlView({
  control,
  values,
  disabled,
  onParam,
}: {
  control: GroupControl;
  values: number[];
  disabled?: boolean;
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  const value = values[control.p] ?? 0;

  if (control.kind === 'check') {
    return (
      <label className="dialogCheck">
        <input
          type="checkbox"
          checked={value !== 0}
          disabled={disabled}
          onChange={(event) => onParam(control.p, event.target.checked ? 1 : 0)}
        />
      </label>
    );
  }

  if (control.kind === 'select') {
    return (
      <select
        className="commandFieldInput dialogSelect"
        value={String(value)}
        disabled={disabled}
        onChange={(event) => onParam(control.p, Number(event.target.value))}
      >
        {Object.entries(control.options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    );
  }

  const numeric = (
    <>
      <input
        type="number"
        className="commandFieldInput dialogNumber"
        step={1}
        min={control.kind === 'num' ? control.min : undefined}
        max={control.kind === 'num' ? control.max : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onParam(
            control.p,
            event.target.value === '' ? 0 : Number(event.target.value),
            control.kind === 'num' ? control.min : undefined,
            control.kind === 'num' ? control.max : undefined,
          )
        }
      />
      {control.kind === 'num' && control.suffix && (
        <span className="dialogSuffix">{control.suffix}</span>
      )}
    </>
  );

  return numeric;
}

/* ── 旧格式兜底 ───────────────────────────────────── */

function DialogRowView({
  row: item,
  values,
  onParam,
}: {
  row: DialogRow;
  values: number[];
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  return (
    <div className="dialogRow">
      {item.label && <span className="dialogRowLabel">{item.label}</span>}
      <div className="dialogRowFields">
        {item.fields.map((field) => (
          <LegacyControl key={field.p} field={field} values={values} onParam={onParam} />
        ))}
      </div>
    </div>
  );
}

function LegacyControl({
  field,
  values,
  onParam,
}: {
  field: DialogField;
  values: number[];
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  const value = values[field.p] ?? 0;

  if (field.kind === 'check') {
    return (
      <label className="dialogCheck">
        <input
          type="checkbox"
          checked={value !== 0}
          onChange={(event) => onParam(field.p, event.target.checked ? 1 : 0)}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.kind === 'select') {
    return (
      <>
        {field.label && <span className="dialogInlineLabel">{field.label}</span>}
        <select
          className="commandFieldInput dialogSelect"
          value={String(value)}
          onChange={(event) => onParam(field.p, Number(event.target.value))}
        >
          {Object.entries(field.options ?? {}).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      </>
    );
  }

  return (
    <>
      {field.label && <span className="dialogInlineLabel">{field.label}</span>}
      <input
        type="number"
        className="commandFieldInput dialogNumber"
        step={1}
        min={field.min}
        max={field.max}
        value={value}
        onChange={(event) =>
          onParam(
            field.p,
            event.target.value === '' ? 0 : Number(event.target.value),
            field.min,
            field.max,
          )
        }
      />
      {field.suffix && <span className="dialogSuffix">{field.suffix}</span>}
    </>
  );
}

/** 没有专属布局的指令：按 schema 自动排列，隐藏占位参数 */
function FallbackRows({
  model,
  values,
  onParam,
}: {
  model: CommandFormModel;
  values: number[];
  onParam: (p: number, value: number, min?: number, max?: number) => void;
}) {
  const rows = model.fields
    .map((field) => ({ field, variant: resolveField(field, values) }))
    .filter(({ variant }) => {
      const name = variant.name;
      return name && name !== '_' && !name.startsWith('unk') && !name.endsWith('?');
    });

  if (rows.length === 0) {
    return (
      <div className="dialogNote">
        {model.unknownLayout ? '该指令集的布局尚未建模' : '该指令没有可配置的参数'}
      </div>
    );
  }

  return (
    <>
      {rows.map(({ field, variant }) => {
        const common = {
          p: field.position,
          label: fieldLabel(variant, field.position),
        };
        if (variant.spec.kind === 'bool') {
          return (
            <div className="dialogRow" key={field.position}>
              <div className="dialogRowFields">
                <LegacyControl
                  field={{ ...common, kind: 'check' }}
                  values={values}
                  onParam={onParam}
                />
              </div>
            </div>
          );
        }
        if (variant.spec.kind === 'enum') {
          return (
            <div className="dialogRow" key={field.position}>
              <div className="dialogRowFields">
                <LegacyControl
                  field={{ ...common, kind: 'select', options: variant.spec.options }}
                  values={values}
                  onParam={onParam}
                />
              </div>
            </div>
          );
        }
        return (
          <div className="dialogRow" key={field.position}>
            <div className="dialogRowFields">
              <LegacyControl
                field={{ ...common, kind: variant.spec.kind === 'ref' ? 'ref' : 'num' }}
                values={values}
                onParam={onParam}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

/** 显示选项：官方是 4 个独立的选项输入框 */
function ChoiceLines({
  count,
  value,
  onChange,
}: {
  count: number;
  value: string;
  onChange: (next: string) => void;
}) {
  const parts = value.split('\n');
  const lines = Array.from({ length: count }, (_, index) => parts[index] ?? '');

  return (
    <div className="dialogChoiceLines">
      {lines.map((line, index) => (
        <label className="dialogChoiceLine" key={index}>
          <span className="dialogChoiceLabel">选项 {index + 1}</span>
          <input
            className="commandFieldInput"
            value={line}
            onChange={(event) => {
              const next = [...lines];
              next[index] = event.target.value;
              onChange(next.join('\n'));
            }}
          />
        </label>
      ))}
    </div>
  );
}
