import { distanceMeters, isWithinRadius } from './geo';

describe('geo', () => {
  // Майдан Незалежності, Київ
  const site = { latitude: 50.45011, longitude: 30.52341 };

  describe('distanceMeters', () => {
    it('нуль для однієї й тієї ж точки', () => {
      expect(distanceMeters(site, site)).toBe(0);
    });

    it('симетрична', () => {
      const other = { latitude: 50.4501, longitude: 30.5241 };
      expect(distanceMeters(site, other)).toBeCloseTo(
        distanceMeters(other, site),
        6,
      );
    });

    it('приблизно 111 км на градус широти', () => {
      const northOneDegree = { latitude: 51.45011, longitude: 30.52341 };
      const d = distanceMeters(site, northOneDegree);
      expect(d).toBeGreaterThan(110_000);
      expect(d).toBeLessThan(112_000);
    });
  });

  describe('isWithinRadius', () => {
    const near = { latitude: 50.45031, longitude: 30.52341 }; // ~22 м
    const far = { latitude: 50.46011, longitude: 30.52341 }; // ~1.1 км

    it('null, якщо радіус не заданий — перевірка вимкнена', () => {
      expect(isWithinRadius(site, null, near)).toBeNull();
      expect(isWithinRadius(site, 0, near)).toBeNull();
    });

    it('null, якщо в відділення немає координат', () => {
      expect(
        isWithinRadius({ latitude: null, longitude: null }, 100, near),
      ).toBeNull();
    });

    it('null, якщо працівник не поділився позицією', () => {
      expect(isWithinRadius(site, 100, null)).toBeNull();
    });

    it('в межах радіуса', () => {
      const res = isWithinRadius(site, 100, near);
      expect(res?.within).toBe(true);
      expect(res?.distanceM).toBeLessThan(100);
    });

    it('поза радіусом', () => {
      const res = isWithinRadius(site, 100, far);
      expect(res?.within).toBe(false);
      expect(res?.distanceM).toBeGreaterThan(1000);
    });
  });
});
