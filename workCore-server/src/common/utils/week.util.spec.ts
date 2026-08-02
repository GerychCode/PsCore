import { getISODay } from 'date-fns';
import { mondayWeekStart, weekBounds } from './week.util';

describe('week.util', () => {
  const wednesday = new Date('2026-06-03T12:00:00'); // середа

  it('mondayWeekStart повертає понеділок тижня', () => {
    expect(getISODay(mondayWeekStart(wednesday))).toBe(1);
  });

  it('weekBounds повертає межі Пн–Нд', () => {
    const { weekStart, weekEnd } = weekBounds(wednesday);
    expect(getISODay(weekStart)).toBe(1);
    expect(getISODay(weekEnd)).toBe(7);
    expect(weekStart.getTime()).toBeLessThan(weekEnd.getTime());
  });
});
