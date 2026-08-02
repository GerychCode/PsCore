import {
  applyOp,
  evaluateConditions,
  renderTemplate,
  ruleMatches,
} from './tag-rule.evaluator';
import { ShiftRuleContext, TagRule, TemplateContext } from './tag-rule.types';

const ctx: ShiftRuleContext = {
  userId: 7,
  departmentId: 3,
  totalHours: 10,
  startHour: 9,
  endHour: 19,
  weekday: 6,
  late: true,
  offSchedule: false,
  isDayOff: false,
  status: 'PENDING',
};

describe('applyOp', () => {
  it('eq/neq з приведенням типів (bool і number)', () => {
    expect(applyOp('eq', true, true)).toBe(true);
    expect(applyOp('eq', true, 'true')).toBe(true);
    expect(applyOp('eq', 9, '9')).toBe(true);
    expect(applyOp('neq', 9, 10)).toBe(true);
  });

  it('числові порівняння', () => {
    expect(applyOp('gt', 10, 8)).toBe(true);
    expect(applyOp('gte', 8, 8)).toBe(true);
    expect(applyOp('lt', 7, 8)).toBe(true);
    expect(applyOp('lte', 8, 8)).toBe(true);
    expect(applyOp('gt', 5, 8)).toBe(false);
  });

  it('in по масиву (з приведенням до рядка)', () => {
    expect(applyOp('in', 6, [6, 7])).toBe(true);
    expect(applyOp('in', '6', [6, 7])).toBe(true);
    expect(applyOp('in', 1, [6, 7])).toBe(false);
    expect(applyOp('in', 6, 6 as any)).toBe(false); // не масив
  });

  it('невідомий оператор → false', () => {
    expect(applyOp('xxx' as any, 1, 1)).toBe(false);
  });
});

describe('evaluateConditions', () => {
  it('порожні умови = завжди true', () => {
    const rule = { match: 'ALL', conditions: [] } as unknown as TagRule;
    expect(evaluateConditions(rule, ctx)).toBe(true);
  });

  it('ALL — усі мають збігтись', () => {
    const rule = {
      match: 'ALL',
      conditions: [
        { field: 'totalHours', op: 'gt', value: 8 },
        { field: 'late', op: 'eq', value: true },
      ],
    } as unknown as TagRule;
    expect(evaluateConditions(rule, ctx)).toBe(true);

    const rule2 = {
      match: 'ALL',
      conditions: [
        { field: 'totalHours', op: 'gt', value: 8 },
        { field: 'offSchedule', op: 'eq', value: true },
      ],
    } as unknown as TagRule;
    expect(evaluateConditions(rule2, ctx)).toBe(false);
  });

  it('ANY — достатньо однієї', () => {
    const rule = {
      match: 'ANY',
      conditions: [
        { field: 'offSchedule', op: 'eq', value: true },
        { field: 'weekday', op: 'in', value: [6, 7] },
      ],
    } as unknown as TagRule;
    expect(evaluateConditions(rule, ctx)).toBe(true);
  });
});

describe('ruleMatches', () => {
  const rule = {
    trigger: 'SHIFT_ENDED',
    match: 'ALL',
    conditions: [{ field: 'totalHours', op: 'gte', value: 10 }],
    actions: [],
  } as unknown as TagRule;

  it('нема правила → false', () => {
    expect(ruleMatches(null, 'SHIFT_ENDED', ctx)).toBe(false);
  });

  it('інший тригер → false', () => {
    expect(ruleMatches(rule, 'SHIFT_STARTED', ctx)).toBe(false);
  });

  it('той самий тригер + умови → true', () => {
    expect(ruleMatches(rule, 'SHIFT_ENDED', ctx)).toBe(true);
  });
});

describe('renderTemplate', () => {
  const tctx: TemplateContext = { ...ctx, userName: 'Іван П', tagName: 'Овертайм' };

  it('підставляє поля', () => {
    expect(renderTemplate('{userName}: {totalHours} год', tctx)).toBe(
      'Іван П: 10 год',
    );
  });

  it('невідоме поле → порожньо, шаблон-undefined → порожньо', () => {
    expect(renderTemplate('{nope}', tctx)).toBe('');
    expect(renderTemplate(undefined, tctx)).toBe('');
  });
});
