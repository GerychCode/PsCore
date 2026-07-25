import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TagRuleEngine } from './tag-rule.engine';

// NotificationsService — глобальний; тож достатньо Prisma.
@Module({
  imports: [PrismaModule],
  providers: [TagRuleEngine],
  exports: [TagRuleEngine],
})
export class TagRuleModule {}
