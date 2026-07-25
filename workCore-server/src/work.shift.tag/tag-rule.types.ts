/**
 * Декларативні правила кастомних тегів. Жодного виконання коду — лише
 * набір умов (коли навісити тег) і дій-подій (що зробити). Безпечно для
 * адмінів: неможливо отримати RCE, як було б із «скриптами».
 */

export const RULE_TRIGGERS = ['SHIFT_STARTED', 'SHIFT_ENDED'] as const;
export type RuleTrigger = (typeof RULE_TRIGGERS)[number];

export const RULE_MATCH = ['ALL', 'ANY'] as const;
export type RuleMatch = (typeof RULE_MATCH)[number];

// Поля контексту зміни, доступні для умов
export const RULE_FIELDS = [
  'totalHours',
  'startHour',
  'endHour',
  'weekday',
  'late',
  'offSchedule',
  'isDayOff',
  'status',
  'departmentId',
] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'] as const;
export type RuleOp = (typeof RULE_OPS)[number];

export const RULE_ACTIONS = ['NOTIFY_USER', 'NOTIFY_MANAGERS'] as const;
export type RuleActionType = (typeof RULE_ACTIONS)[number];

export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  value: unknown;
}

export interface RuleAction {
  type: RuleActionType;
  title?: string;
  message?: string;
}

export interface TagRule {
  trigger: RuleTrigger;
  match: RuleMatch;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

/** Контекст зміни, проти якого перевіряються умови. */
export interface ShiftRuleContext {
  userId: number;
  departmentId: number;
  totalHours: number;
  startHour: number;
  endHour: number | null;
  weekday: number; // 1..7 (ISO)
  late: boolean;
  offSchedule: boolean;
  isDayOff: boolean;
  status: string;
}

/** Контекст для підстановки у шаблони повідомлень. */
export type TemplateContext = ShiftRuleContext & {
  userName: string;
  tagName: string;
};

/** Каталог для UI-конструктора правил. */
export const RULE_CATALOG = {
  triggers: RULE_TRIGGERS,
  match: RULE_MATCH,
  fields: RULE_FIELDS,
  ops: RULE_OPS,
  actions: RULE_ACTIONS,
};
