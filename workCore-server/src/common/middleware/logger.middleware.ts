import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service'; // Перевірте правильність шляху до вашого PrismaService

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  // Інжектимо PrismaService для роботи з БД
  constructor(private readonly prisma: PrismaService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl, session } = request;
    const userAgent = request.get('user-agent') || '';

    // Слухаємо подію 'finish', яка спрацьовує, коли відповідь вже відправлена клієнту
    response.on('finish', async () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || 0;

      let userIdentifier = 'Guest';

      // Перевіряємо, чи авторизований користувач (чи є userId в сесії)
      if (session && session.userId) {
        try {
          // Отримуємо дані користувача з БД (вибираємо тільки потрібні поля для оптимізації)
          const user = await this.prisma.user.findUnique({
            where: { id: session.userId },
            select: { firstName: true, lastName: true },
          });

          if (user) {
            userIdentifier = `${user.firstName} ${user.lastName}`;
          } else {
            userIdentifier = `ID: ${session.userId}`;
          }
        } catch (error) {
          userIdentifier = `ID: ${session.userId}`;
          this.logger.error('Failed to fetch user for logging', error);
        }
      }

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength} - ${ip} | User: [${userIdentifier}]`,
      );
    });

    next();
  }
}
