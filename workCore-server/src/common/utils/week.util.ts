import { endOfWeek, startOfWeek } from 'date-fns';

// У проєкті тиждень завжди починається з понеділка (ISO). Одна константа
// замість повторюваного `{ weekStartsOn: 1 }` по сервісах графіка.
const WEEK_OPTS = { weekStartsOn: 1 } as const;

/** Початок тижня (понеділок) для дати. */
export const mondayWeekStart = (date: Date | number): Date =>
  startOfWeek(date, WEEK_OPTS);

/** Межі тижня (понеділок–неділя) для дати. */
export const weekBounds = (
  date: Date | number,
): { weekStart: Date; weekEnd: Date } => ({
  weekStart: startOfWeek(date, WEEK_OPTS),
  weekEnd: endOfWeek(date, WEEK_OPTS),
});
