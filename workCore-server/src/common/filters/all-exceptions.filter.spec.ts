import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let res: any;
  const req = { method: 'GET', originalUrl: '/x?token=secret' };

  const host = (type: string): any => ({
    getType: () => type,
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  });

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  it('не-HTTP контекст — перекидає помилку далі', () => {
    const err = new Error('ws');
    expect(() => filter.catch(err, host('ws'))).toThrow(err);
  });

  it('HttpException — віддає його статус і тіло', () => {
    filter.catch(new BadRequestException('погано'), host('http'));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
  });

  it('невідома помилка — 500 з узагальненим повідомленням', () => {
    filter.catch(new Error('boom'), host('http'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
    );
  });

  it('не-Error значення теж дає 500', () => {
    filter.catch('щось', host('http'));
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
