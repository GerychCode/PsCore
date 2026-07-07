import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  constructor(private readonly prisma: PrismaService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl, session } = request;
    const userAgent = request.get('user-agent') || '';

    response.on('finish', async () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length') || 0;

      let userIdentifier = 'Guest';

      if (session && session.userId) {
        try {
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
