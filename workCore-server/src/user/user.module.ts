import { BadRequestException, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import { AdminBootstrapService } from './admin.bootstrap.service';
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
        const allowedExtensions = new Set([
          '.jpg',
          '.jpeg',
          '.png',
          '.webp',
          '.gif',
        ]);
        return {
          storage: diskStorage({
            destination: uploadPath,
            filename: (req, file, cb) => {
              const uniqueSuffix =
                  Date.now() + '-' + Math.round(Math.random() * 1e9);
              const ext = path.extname(file.originalname).toLowerCase();
              cb(null, `avatar-${uniqueSuffix}${ext}`);
            },
          }),
          fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const isImageMime = /^image\/(jpeg|png|webp|gif)$/.test(
                file.mimetype,
            );
            if (allowedExtensions.has(ext) && isImageMime) {
              cb(null, true);
            } else {
              cb(
                  new BadRequestException(
                      'Дозволені лише зображення (jpg, png, webp, gif).',
                  ),
                  false,
              );
            }
          },
        };
      },
    }),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    PrismaService,
    FileStorageService,
    AdminBootstrapService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new IORedis(configService.getOrThrow<string>('REDIS_URL'));
      },
      inject: [ConfigService],
    },
  ],
  exports: [UserService, 'REDIS_CLIENT'],
})
export class UserModule {}