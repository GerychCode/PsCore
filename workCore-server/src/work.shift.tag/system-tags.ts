/**
 * Каталог системних тегів змін. Створюються/оновлюються самою системою
 * (isSystem=true), їх не можна видаляти чи перейменовувати вручну.
 * severity: 1 — інформативний, 2 — попередження, 3 — важливе відхилення.
 */
export interface SystemTagSpec {
  name: string;
  severity: number;
  color: string;
  description: string;
}

export const SYSTEM_TAGS = {
  OFF_SCHEDULE: {
    name: 'Поза графіком',
    severity: 2,
    color: '#F59E0B',
    description: 'Зміну розпочато без запланованого графіка на цей день.',
  },
  DAY_OFF: {
    name: 'У вихідний',
    severity: 2,
    color: '#8B5CF6',
    description: 'Зміну розпочато у день, позначений у графіку як вихідний.',
  },
  LATE: {
    name: 'Запізнення',
    severity: 2,
    color: '#EF4444',
    description: 'Початок зміни пізніше за запланований у графіку час.',
  },
  AUTO_CLOSED: {
    name: 'Автозавершено',
    severity: 2,
    color: '#6B7280',
    description: 'Зміну завершено автоматично опівночі (працівник не вийшов).',
  },
  NO_CHECKOUT: {
    name: 'Без підтвердження виходу',
    severity: 3,
    color: '#DC2626',
    description: 'Працівник не завершив зміну вручну — час взято з графіка.',
  },
  EARLY_LEAVE: {
    name: 'Ранній вихід',
    severity: 1,
    color: '#0EA5E9',
    description: 'Зміну завершено раніше за запланований у графіку час.',
  },
  FAR_FROM_SITE: {
    name: 'Далеко від відділення',
    severity: 2,
    color: '#D97706',
    description:
      'Зміну відкрито за межами дозволеного радіуса відділення (за геопозицією).',
  },
  OVERTIME: {
    name: 'Понаднормово',
    severity: 1,
    color: '#10B981',
    description: 'Відпрацьовано більше запланованих годин зміни.',
  },
} as const satisfies Record<string, SystemTagSpec>;

export type SystemTagKey = keyof typeof SYSTEM_TAGS;

export const SYSTEM_TAG_NAMES: string[] = Object.values(SYSTEM_TAGS).map(
  (t) => t.name,
);
