import { detectImageType, isAllowedImage } from './image-signature';

const buf = (bytes: number[]) => {
  const b = Buffer.alloc(16);
  bytes.forEach((v, i) => (b[i] = v));
  return b;
};

describe('image-signature', () => {
  it('JPEG', () => {
    expect(detectImageType(buf([0xff, 0xd8, 0xff]))).toBe('jpeg');
  });

  it('PNG', () => {
    expect(
      detectImageType(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('png');
  });

  it('GIF', () => {
    expect(detectImageType(buf([0x47, 0x49, 0x46, 0x38]))).toBe('gif');
  });

  it('WEBP (RIFF....WEBP)', () => {
    expect(
      detectImageType(
        buf([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe('webp');
  });

  it('невідомий тип → null', () => {
    expect(detectImageType(buf([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it('замалий буфер → null', () => {
    expect(detectImageType(Buffer.alloc(4))).toBeNull();
  });

  it('isAllowedImage', () => {
    expect(isAllowedImage(buf([0xff, 0xd8, 0xff]))).toBe(true);
    expect(isAllowedImage(buf([0x00]))).toBe(false);
  });
});
