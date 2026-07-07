/** Категорії сповіщень і канали доставки. Спільне для сервера й клієнта. */

export const NOTIFICATION_CATEGORIES = [
  'shift', // підтвердження/відхилення/оновлення/видалення змін
  'chat', // повідомлення чату
  'schedule', // зміни у графіку
  'system', // системні
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationChannel = 'web' | 'telegram';

export type NotificationPrefs = Partial<
  Record<NotificationCategory, Partial<Record<NotificationChannel, boolean>>>
>;

// Дефолти: усе увімкнено, окрім дублювання чату в Telegram
// (чат і так realtime у вебі — telegram-копію вмикають за бажанням).
const DEFAULTS: Record<
  NotificationCategory,
  Record<NotificationChannel, boolean>
> = {
  shift: { web: true, telegram: true },
  chat: { web: true, telegram: false },
  schedule: { web: true, telegram: true },
  system: { web: true, telegram: true },
};

/** Стан каналу з урахуванням дефолтів (явне значення має пріоритет). */
export function isChannelEnabled(
  prefs: NotificationPrefs | null | undefined,
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  const explicit = prefs?.[category]?.[channel];
  if (typeof explicit === 'boolean') return explicit;
  return DEFAULTS[category][channel];
}

/** Повний набір із дефолтами (усе true) — для віддачі клієнту. */
export function withDefaults(
  prefs: NotificationPrefs | null | undefined,
): Record<NotificationCategory, Record<NotificationChannel, boolean>> {
  const result = {} as Record<
    NotificationCategory,
    Record<NotificationChannel, boolean>
  >;
  for (const category of NOTIFICATION_CATEGORIES) {
    result[category] = {
      web: isChannelEnabled(prefs, category, 'web'),
      telegram: isChannelEnabled(prefs, category, 'telegram'),
    };
  }
  return result;
}
