/**
 * Повертає лише ті поля `incoming`, що відрізняються від `current`.
 * Прибирає дубльований по сервісах патерн «diff змінених полів»
 * (user/department/work.shift робили це власними reduce).
 */
export function pickChangedFields<T extends Record<string, any>>(
  current: Record<string, any>,
  incoming: T,
): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(incoming) as (keyof T & string)[]) {
    if (current[key] !== incoming[key]) {
      changed[key] = incoming[key];
    }
  }
  return changed;
}
