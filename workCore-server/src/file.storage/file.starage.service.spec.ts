import * as fs from 'node:fs';
import { FileStorageService } from './file.starage.service';

jest.mock('node:fs');

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(() => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('uploads'),
    } as any;
    service = new FileStorageService(configService);
  });

  afterEach(() => jest.clearAllMocks());

  it('видаляє файл без помилок', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_p, cb) => cb(null));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    service.deleteFile('avatar.png');

    expect(fs.unlink).toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('логує попередження при помилці видалення', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_p, cb) =>
      cb(new Error('boom')),
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    service.deleteFile('avatar.png');

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
