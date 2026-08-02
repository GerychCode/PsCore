import * as fs from 'node:fs';
import { Logger } from '@nestjs/common';
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

  it('порожнє імʼя — нічого не робить', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_p, cb) => cb(null));
    service.deleteFile('');
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('видаляє файл без помилок', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_p, cb) => cb(null));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    service.deleteFile('avatar.png');

    expect(fs.unlink).toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('логує попередження при помилці видалення', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_p, cb) =>
      cb(Object.assign(new Error('boom'), { code: 'EACCES' })),
    );
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    service.deleteFile('avatar.png');

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('відхиляє шлях із виходом за межі каталогу (path traversal)', () => {
    (fs.unlink as unknown as jest.Mock).mockImplementation((_p, cb) => cb(null));

    service.deleteFile('../../etc/passwd');

    // basename зводить шлях до "passwd" у uploads — поза каталог не виходимо
    const calledPath = (fs.unlink as unknown as jest.Mock).mock.calls[0]?.[0];
    expect(String(calledPath)).toContain('uploads');
    expect(String(calledPath)).not.toContain('etc');
  });
});
