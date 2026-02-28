import { Module } from '@nestjs/common';
import { FileStorageService } from './file.starage.service';

@Module({
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class PrismaModule {}
