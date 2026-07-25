import { isChannelEnabled, withDefaults } from './notification.prefs';

describe('notification.prefs', () => {
  describe('isChannelEnabled', () => {
    it('явне значення має пріоритет', () => {
      expect(isChannelEnabled({ chat: { telegram: true } }, 'chat', 'telegram')).toBe(true);
      expect(isChannelEnabled({ shift: { web: false } }, 'shift', 'web')).toBe(false);
    });

    it('без явного — дефолт категорії', () => {
      expect(isChannelEnabled(null, 'shift', 'web')).toBe(true);
      // chat.telegram дефолтно вимкнено
      expect(isChannelEnabled(undefined, 'chat', 'telegram')).toBe(false);
    });
  });

  describe('withDefaults', () => {
    it('повертає всі категорії з web/telegram', () => {
      const res = withDefaults(null);
      expect(Object.keys(res)).toEqual(
        expect.arrayContaining(['shift', 'chat', 'schedule', 'system']),
      );
      expect(res.chat).toEqual({ web: true, telegram: false });
    });

    it('враховує явні значення поверх дефолтів', () => {
      const res = withDefaults({ shift: { telegram: false } });
      expect(res.shift.telegram).toBe(false);
      expect(res.shift.web).toBe(true);
    });
  });
});
