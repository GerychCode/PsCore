import {
  RuleOp,
  ShiftRuleContext,
  TagRule,
  RuleTrigger,
  TemplateContext,
} from './tag-rule.types';

/** Значення поля контексту (undefined для невідомих полів). */
export function getFieldValue(
  ctx: ShiftRuleContext,
  field: string,
): unknown {
  return (ctx as unknown as Record<string, unknown>)[field];
}

/** Порівняння одного значення. Ніякого eval — лише прості оператори. */
export function applyOp(op: RuleOp, actual: unknown, expected: unknown): boolean {
  switch (op) {
    // Порівняння як рядки — щоб true/'true' і 9/'9' збігались незалежно від типу в JSON
    case 'eq':
      return String(actual) === String(expected);
    case 'neq':
      return String(actual) !== String(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'in':
      return (
        Array.isArray(expected) &&
        expected.map(String).includes(String(actual))
      );
    default:
      return false;
  }
}

/** Чи проходять умови правила (ALL=всі, ANY=хоч одна). Порожні умови = завжди. */
export function evaluateConditions(
  rule: TagRule,
  ctx: ShiftRuleContext,
): boolean {
  const conditions = rule.conditions ?? [];
  if (conditions.length === 0) return true;

  const results = conditions.map((c) =>
    applyOp(c.op, getFieldValue(ctx, c.field), c.value),
  );
  return rule.match === 'ANY' ? results.some(Boolean) : results.every(Boolean);
}

/** Чи спрацьовує правило для цього тригера й контексту. */
export function ruleMatches(
  rule: TagRule | null | undefined,
  trigger: RuleTrigger,
  ctx: ShiftRuleContext,
): boolean {
  if (!rule || rule.trigger !== trigger) return false;
  return evaluateConditions(rule, ctx);
}

/** Підстановка {поле} у шаблон повідомлення. Тільки заміна рядків, без коду. */
export function renderTemplate(
  template: string | undefined,
  ctx: TemplateContext,
): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = (ctx as unknown as Record<string, unknown>)[key];
    return value === undefined || value === null ? '' : String(value);
  });
}
