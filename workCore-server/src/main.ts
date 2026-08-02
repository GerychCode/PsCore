import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import ms from './common/utils/ms';
import { parseBoolean } from './common/utils/boolean-parser';
import { RedisStore } from 'connect-redis';
import IORedis from 'ioredis';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const redis = new IORedis(config.getOrThrow<string>('REDIS_URL'));

  // За reverse proxy (nginx/traefik): довіряємо X-Forwarded-* — щоб Secure-cookie
  // ставилась і rate-limit/логи бачили реальний IP клієнта, а не проксі.
  const trustProxy = parseInt(config.get<string>('TRUST_PROXY') ?? '0', 10);
  if (trustProxy > 0) {
    app.set('trust proxy', trustProxy);
  }

  app.use(cookieParser(config.getOrThrow<string>('COOKIE_SECRET')));

  const logger = new Logger('Bootstrap');

  app.enableCors({
    // Кілька origin через кому (напр. 127.0.0.1 і localhost, дев-сервер)
    origin: config
      .getOrThrow<string>('CORS_ORIGIN')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ['set-cookie'],
  });
  // Узагальнює 500-ті й ховає стек-трейси/деталі БД
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // whitelist вирізає будь-які поля поза DTO — це і є захист від mass
      // assignment. forbidNonWhitelisted навмисно НЕ вмикаємо глобально: деякі
      // форми шлють надмножину полів (напр. edit зміни віддає userId/date),
      // і hard-reject 400-в би валідні запити. Вмикати точково там, де payload
      // гарантовано чистий.
      whitelist: true,
      exceptionFactory: (errors) => {
        const formatted = errors.map((err) => ({
          field: err.property,
          message: Object.values(err.constraints!)[0],
        }));
        return new BadRequestException({ errors: formatted });
      },
    }),
  );

  // Самолікування: якщо у браузері лишилась легасі-cookie з Domain
  // (раніше SESSION_DOMAIN=127.0.0.1) поруч із новою host-only —
  // видаляємо доменну, інакше сервер читає стару (недійсну) сесію
  const sessionName = config.getOrThrow<string>('SESSION_NAME');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers.cookie ?? '';
    const count = raw
      .split(';')
      .filter((c) => c.trim().startsWith(`${sessionName}=`)).length;
    if (count > 1) {
      res.clearCookie(sessionName, { domain: req.hostname });
    }
    next();
  });

  app.use(
    session({
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      name: config.getOrThrow<string>('SESSION_NAME'),
      // resave:false — не переписувати незмінені сесії (менше гонок і записів).
      // rolling:true — подовжувати TTL при активності (ідл-таймаут працює).
      resave: false,
      rolling: true,
      saveUninitialized: false,
      cookie: {
        // Без домену cookie стає host-only і працює як для 127.0.0.1,
        // так і для localhost; задавайте SESSION_DOMAIN лише для продакшн-домену
        domain: config.get<string>('SESSION_DOMAIN') || undefined,
        maxAge: ms(config.getOrThrow('SESSION_MAX_AGE')),
        httpOnly: parseBoolean(config.getOrThrow<string>('SESSION_HTTP_ONLY')),
        secure: parseBoolean(config.getOrThrow<string>('SESSION_SECURE')),
        sameSite: 'lax',
      },
      store: new RedisStore({
        client: redis,
        prefix: config.getOrThrow<string>('SESSION_FOLDER'),
      }),
    }),
  );

  app.useStaticAssets(
    join(
      __dirname,
      '..',
      config.getOrThrow<string>('FILE_STORAGE_FOLDER_NAME'),
    ),
    {
      prefix: `/${config.getOrThrow<string>('FILE_STORAGE_FOLDER_NAME')}/`,
      // Не давати браузеру визначати тип за вмістом (захист від polyglot-файлів)
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
      },
    },
  );

  const port = config.getOrThrow<number>('APPLICATION_PORT') ?? 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
