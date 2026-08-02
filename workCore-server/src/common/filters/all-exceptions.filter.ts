import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Єдиний фільтр помилок. HttpException віддаємо як є (валідація, 401/403/404
 * тощо), а будь-яку іншу помилку (напр. збій Prisma) логуємо внутрішньо й
 * повертаємо узагальнене повідомлення — щоб не витікали стек-трейси й деталі БД.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    // Не-HTTP контексти (WebSocket/Telegraf) не мають res — не чіпаємо
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return res.status(status).json(exception.getResponse());
    }

    // Невідома/внутрішня помилка: деталі — лише в лог
    this.logger.error(
      `Необроблена помилка на ${req.method} ${req.originalUrl.split('?')[0]}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Внутрішня помилка сервера.',
    });
  }
}
