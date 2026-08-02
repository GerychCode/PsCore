// Декларативні правила кастомних тегів (без коду — лише умови й дії-події)
export type RuleTrigger = 'SHIFT_STARTED' | 'SHIFT_ENDED'
export type RuleMatch = 'ALL' | 'ANY'
export type RuleField =
  | 'totalHours'
  | 'startHour'
  | 'endHour'
  | 'weekday'
  | 'late'
  | 'offSchedule'
  | 'isDayOff'
  | 'status'
  | 'departmentId'
export type RuleOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in'
export type RuleActionType = 'NOTIFY_USER' | 'NOTIFY_MANAGERS'

export interface ITagRuleCondition {
  field: RuleField
  op: RuleOp
  value: string | number | boolean | (string | number)[]
}

export interface ITagRuleAction {
  type: RuleActionType
  title?: string
  message?: string
}

export interface ITagRule {
  trigger: RuleTrigger
  match: RuleMatch
  conditions: ITagRuleCondition[]
  actions: ITagRuleAction[]
}

export interface ITag {
  id: number
  name: string
  severity: number
  description: string | null
  isSystem?: boolean
  color?: string | null
  autoApply?: boolean
  rule?: ITagRule | null
}

export interface ITagCreate {
  name: string
  severity?: number
  description?: string
  color?: string
  autoApply?: boolean
  rule?: ITagRule
}

export interface ITagUpdate {
  name?: string
  severity?: number
  description?: string
  color?: string
  autoApply?: boolean
  rule?: ITagRule
}

// Довідник для конструктора правил (з бекенду GET /shift-tag/rule-catalog)
export interface ITagRuleCatalog {
  triggers: RuleTrigger[]
  match: RuleMatch[]
  fields: RuleField[]
  ops: RuleOp[]
  actions: RuleActionType[]
}
