import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { parseBoolean } from '../utils/boolean-parser';

/**
 * Базові заголовки безпеки (заміна helmet без зайвої залежності).
 * API віддає JSON і статичні файли, тож ключове: заборона фреймів,
 * заборона MIME-sniffing, приховування Referer і (за HTTPS) HSTS.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly hstsEnabled = parseBoolean(
    process.env.SESSION_SECURE ?? 'false',
  );

  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // Мінімальний CSP: API не рендерить HTML, тож усе, окрім self, забороняємо.
    // Захищає сторінки помилок і будь-який випадковий HTML-вивід та статичні файли.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    // HSTS має сенс лише під HTTPS (SESSION_SECURE=true)
    if (this.hstsEnabled) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  }
}
