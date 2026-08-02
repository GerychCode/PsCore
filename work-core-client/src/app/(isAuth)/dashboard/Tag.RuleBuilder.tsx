'use client'

import React from 'react'
import { FaPlus, FaTrash } from 'react-icons/fa'
import {
  ITagRule,
  ITagRuleAction,
  ITagRuleCondition,
  RuleActionType,
  RuleField,
  RuleMatch,
  RuleOp,
  RuleTrigger,
} from '@/interface/ITag'
import {
  RULE_ACTION_LABELS,
  RULE_FIELD_LABELS,
  RULE_OP_LABELS,
  RULE_TRIGGER_LABELS,
} from '@/service/shift.tag.service'

const FIELDS: RuleField[] = [
  'totalHours',
  'startHour',
  'endHour',
  'weekday',
  'late',
  'offSchedule',
  'isDayOff',
  'status',
  'departmentId',
]
const OPS: RuleOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in']
const TRIGGERS: RuleTrigger[] = ['SHIFT_STARTED', 'SHIFT_ENDED']
const ACTIONS: RuleActionType[] = ['NOTIFY_USER', 'NOTIFY_MANAGERS']
const BOOL_FIELDS = new Set<RuleField>(['late', 'offSchedule', 'isDayOff'])
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

export const emptyRule = (): ITagRule => ({
  trigger: 'SHIFT_ENDED',
  match: 'ALL',
  conditions: [],
  actions: [],
})

function defaultValueForField(field: RuleField): ITagRuleCondition['value'] {
  if (BOOL_FIELDS.has(field)) return true
  if (field === 'status') return 'PENDING'
  return 0
}

const selectCls =
  'h-10 rounded-xl border-2 border-gray-200 px-2 bg-white text-sm outline-none focus:border-primary'
const inputCls =
  'h-10 rounded-xl border-2 border-gray-200 px-3 bg-white text-sm outline-none focus:border-primary'

function ConditionValueInput({
  cond,
  onChange,
}: {
  cond: ITagRuleCondition
  onChange: (v: ITagRuleCondition['value']) => void
}) {
  if (BOOL_FIELDS.has(cond.field)) {
    return (
      <select
        className={`${selectCls} flex-1`}
        value={String(cond.value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value='true'>Так</option>
        <option value='false'>Ні</option>
      </select>
    )
  }

  if (cond.field === 'status') {
    return (
      <select
        className={`${selectCls} flex-1`}
        value={String(cond.value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    )
  }

  if (cond.op === 'in') {
    const text = Array.isArray(cond.value)
      ? cond.value.join(', ')
      : String(cond.value ?? '')
    return (
      <input
        className={`${inputCls} flex-1`}
        value={text}
        placeholder='напр. 6, 7'
        onChange={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((v) => (isNaN(Number(v)) ? v : Number(v)))
          )
        }
      />
    )
  }

  return (
    <input
      type='number'
      className={`${inputCls} flex-1`}
      value={Number(cond.value ?? 0)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

interface Props {
  value: ITagRule
  onChange: (rule: ITagRule) => void
}

export const TagRuleBuilder: React.FC<Props> = ({ value, onChange }) => {
  const update = (patch: Partial<ITagRule>) => onChange({ ...value, ...patch })

  const addCondition = () =>
    update({
      conditions: [
        ...value.conditions,
        { field: 'totalHours', op: 'gt', value: 8 },
      ],
    })
  const setCondition = (i: number, patch: Partial<ITagRuleCondition>) =>
    update({
      conditions: value.conditions.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c
      ),
    })
  const removeCondition = (i: number) =>
    update({ conditions: value.conditions.filter((_, idx) => idx !== i) })

  const addAction = () =>
    update({
      actions: [...value.actions, { type: 'NOTIFY_USER', title: '', message: '' }],
    })
  const setAction = (i: number, patch: Partial<ITagRuleAction>) =>
    update({
      actions: value.actions.map((a, idx) =>
        idx === i ? { ...a, ...patch } : a
      ),
    })
  const removeAction = (i: number) =>
    update({ actions: value.actions.filter((_, idx) => idx !== i) })

  return (
    <div className='flex flex-col gap-4 p-4 border-2 border-primary/20 rounded-2xl bg-white'>
      {/* Тригер + логіка збігу */}
      <div className='flex flex-wrap gap-3'>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-gray-600'>Коли</label>
          <select
            className={selectCls}
            value={value.trigger}
            onChange={(e) =>
              update({ trigger: e.target.value as RuleTrigger })
            }
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {RULE_TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className='flex flex-col gap-1'>
          <label className='text-xs font-medium text-gray-600'>
            Збіг умов
          </label>
          <select
            className={selectCls}
            value={value.match}
            onChange={(e) => update({ match: e.target.value as RuleMatch })}
          >
            <option value='ALL'>Усі умови (І)</option>
            <option value='ANY'>Будь-яка умова (АБО)</option>
          </select>
        </div>
      </div>

      {/* Умови */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>
            Умови {value.conditions.length === 0 && '(порожньо = завжди)'}
          </span>
          <button
            type='button'
            onClick={addCondition}
            className='flex items-center gap-1 text-xs text-primary hover:opacity-75'
          >
            <FaPlus size={10} /> Умова
          </button>
        </div>
        {value.conditions.map((cond, i) => (
          <div key={i} className='flex flex-wrap items-center gap-2'>
            <select
              className={`${selectCls} min-w-[140px]`}
              value={cond.field}
              onChange={(e) => {
                const field = e.target.value as RuleField
                setCondition(i, {
                  field,
                  value: defaultValueForField(field),
                })
              }}
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {RULE_FIELD_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              className={`${selectCls} w-24`}
              value={cond.op}
              onChange={(e) => setCondition(i, { op: e.target.value as RuleOp })}
            >
              {OPS.map((o) => (
                <option key={o} value={o}>
                  {RULE_OP_LABELS[o]}
                </option>
              ))}
            </select>
            <ConditionValueInput
              cond={cond}
              onChange={(v) => setCondition(i, { value: v })}
            />
            <button
              type='button'
              onClick={() => removeCondition(i)}
              className='text-red-400 hover:text-red-600 p-2'
              title='Видалити умову'
            >
              <FaTrash size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Дії */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>
            Дії (події)
          </span>
          <button
            type='button'
            onClick={addAction}
            className='flex items-center gap-1 text-xs text-primary hover:opacity-75'
          >
            <FaPlus size={10} /> Дія
          </button>
        </div>
        {value.actions.map((action, i) => (
          <div
            key={i}
            className='flex flex-col gap-2 p-3 border-2 border-gray-100 rounded-xl'
          >
            <div className='flex items-center gap-2'>
              <select
                className={`${selectCls} flex-1`}
                value={action.type}
                onChange={(e) =>
                  setAction(i, { type: e.target.value as RuleActionType })
                }
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {RULE_ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
              <button
                type='button'
                onClick={() => removeAction(i)}
                className='text-red-400 hover:text-red-600 p-2'
                title='Видалити дію'
              >
                <FaTrash size={12} />
              </button>
            </div>
            <input
              className={inputCls}
              value={action.title ?? ''}
              placeholder='Заголовок сповіщення'
              onChange={(e) => setAction(i, { title: e.target.value })}
            />
            <input
              className={inputCls}
              value={action.message ?? ''}
              placeholder='Текст. Змінні: {totalHours}, {userName}, {tagName}…'
              onChange={(e) => setAction(i, { message: e.target.value })}
            />
          </div>
        ))}
      </div>

      <p className='text-[11px] text-gray-400 leading-relaxed'>
        Правила декларативні — жодного коду. У тексті сповіщення доступні змінні:{' '}
        <code>{'{totalHours}'}</code>, <code>{'{startHour}'}</code>,{' '}
        <code>{'{weekday}'}</code>, <code>{'{userName}'}</code>,{' '}
        <code>{'{tagName}'}</code>.
      </p>
    </div>
  )
}

export default TagRuleBuilder
