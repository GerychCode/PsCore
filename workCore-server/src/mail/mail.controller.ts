import { Controller, Get, Post } from '@nestjs/common';
import { MailService } from './mail.service';
import { Authorized } from '../common/decorator/authorized.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { User } from '../../generated/prisma';

/**
 * Діагностика пошти для адміністратора. Без цього єдиний спосіб дізнатися,
 * що SMTP налаштовано неправильно, — чекати, поки комусь не дійде запрошення.
 */
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  @RequirePermissions(Permission.ADMINISTRATOR)
  status() {
    return { configured: this.mailService.isConfigured() };
  }

  /**
   * Надсилає тестовий лист НА ВЛАСНУ пошту адміністратора. Довільний
   * отримувач тут свідомо не приймається: інакше ендпоінт став би
   * зручним інструментом для розсилання листів з вашого домену.
   */
  @Post('test')
  @RequirePermissions(Permission.ADMINISTRATOR)
  sendTest(@Authorized() user: User) {
    return this.mailService.sendTestEmail(user.email);
  }
}
