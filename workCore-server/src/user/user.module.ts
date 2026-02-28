import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import * as path from 'path';
import IORedis from 'ioredis';

@Module({
  imports: [
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uploadPath =
            configService.get<string>('FILE_STORAGE_FOLDER_NAME') || './uploads';
        return {
          storage: diskStorage({
            destination: uploadPath,
            filename: (req, file, cb) => {
              const uniqueSuffix =
                  Date.now() + '-' + Math.round(Math.random() * 1e9);
              const ext = path.extname(file.originalname);
              const base = path.basename(file.originalname, ext);
              cb(null, `${base}-${uniqueSuffix}${ext}`);
            },
          }),
        };
      },
    }),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    PrismaService,
    FileStorageService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new IORedis(configService.getOrThrow<string>('REDIS_URL'));
      },
      inject: [ConfigService],
    },
  ],
  exports: [UserService, 'REDIS_CLIENT'], // <-- Додайте цей рядок
})
export class UserModule {}