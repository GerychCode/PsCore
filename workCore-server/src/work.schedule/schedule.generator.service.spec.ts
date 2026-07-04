import { ScheduleGeneratorService, GenMember, GenDay } from './schedule.generator.service';

describe('ScheduleGeneratorService.computeAssignments', () => {
  let service: ScheduleGeneratorService;

  beforeEach(() => {
    // Чисте ядро не торкається залежностей
    service = new ScheduleGeneratorService(null as any, null as any, null as any);
  });

  const member = (userId: number, level = 1, reliability = 0): GenMember => ({
    userId,
    level,
    reliability,
  });

  const day = (
    weekday: number,
    required: number,
    opts: Partial<GenDay> = {},
  ): GenDay => ({
    weekday,
    required,
    busyUserIds: opts.busyUserIds ?? [],
    coveredCount: opts.coveredCount ?? 0,
    wishUserIds: opts.wishUserIds ?? [],
    shiftHours: opts.shiftHours ?? 8,
  });

  it('заповнює потрібну к-сть слотів на день', () => {
    const days = [day(1, 2)];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(2);
    expect(assignments.every((a) => a.weekday === 1)).toBe(true);
  });

  it('не перевищує наявних людей і сигналізує недокомплект', () => {
    const days = [day(1, 3)];
    const members = [member(1), member(2)];
    const { assignments, warnings } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(2);
    expect(warnings.some((w) => w.type === 'UNDERSTAFFED')).toBe(true);
  });

  it('враховує published-зміну цього відділу: 1 покрито → потрібен ще 1, і не user 1', () => {
    // user1 вже працює цього дня в цьому відділі (published) → covered=1, busy=[1]
    const days = [day(1, 2, { busyUserIds: [1], coveredCount: 1 })];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].userId).not.toBe(1);
  });

  it('виключає зайнятого в ІНШОМУ відділі, не зменшуючи потребу цього', () => {
    // user1 зайнятий деінде (busy) але covered=0 → потрібно всі 2 з інших
    const days = [day(1, 2, { busyUserIds: [1], coveredCount: 0 })];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(2);
    expect(assignments.map((a) => a.userId)).not.toContain(1);
  });

  it('уникає побажань вихідного, якщо є ким замінити', () => {
    const days = [day(1, 1, { wishUserIds: [1] })];
    const members = [member(1), member(2)];
    const { assignments, warnings } = service.computeAssignments(days, members);
    expect(assignments[0].userId).toBe(2);
    expect(warnings).toHaveLength(0);
  });

  it('порушує побажання лише за відсутності альтернатив і попереджає', () => {
    const days = [day(1, 1, { wishUserIds: [1] })];
    const members = [member(1)];
    const { assignments, warnings } = service.computeAssignments(days, members);
    expect(assignments[0].userId).toBe(1);
    expect(warnings.some((w) => w.type === 'WISH_VIOLATED')).toBe(true);
  });

  it('на пікові дні ставить сильніших', () => {
    // Пн потребує 1 (спокійний), Сб потребує 3 (піковий, > середнього)
    const days = [day(1, 1), day(6, 3)];
    const members = [
      member(1, 10),
      member(2, 1),
      member(3, 1),
      member(4, 1),
    ];
    const { assignments } = service.computeAssignments(days, members);
    const saturday = assignments
      .filter((a) => a.weekday === 6)
      .map((a) => a.userId);
    // Сильний (userId 1, LVL 10) має потрапити в піковий день
    expect(saturday).toContain(1);
  });

  it('рівномірно розподіляє зміни між людьми', () => {
    // 3 дні по 1 людині, 3 людини — кожен має отримати рівно 1
    const days = [day(1, 1), day(2, 1), day(3, 1)];
    const members = [member(1), member(2), member(3)];
    const { assignments } = service.computeAssignments(days, members);
    const counts = new Map<number, number>();
    assignments.forEach((a) =>
      counts.set(a.userId, (counts.get(a.userId) ?? 0) + 1),
    );
    expect([...counts.values()]).toEqual([1, 1, 1]);
  });

  it('ігнорує дні з нульовим штатом', () => {
    const days = [day(1, 0), day(2, 1)];
    const members = [member(1)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].weekday).toBe(2);
  });

  it('детермінований за рівного скору (менший userId першим)', () => {
    const days = [day(1, 1)];
    const members = [member(3), member(1), member(2)];
    const { assignments } = service.computeAssignments(days, members);
    expect(assignments[0].userId).toBe(1);
  });
});
