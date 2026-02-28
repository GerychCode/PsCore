import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { FileStorageService } from '../file.storage/file.starage.service';
import {UserModule} from "../user/user.module";

@Module({
  imports: [UserModule],
  controllers: [DepartmentController],
  providers: [
    DepartmentService,
    PrismaService,
    UserService,
    FileStorageService,
  ],
})
export class DepartmentModule {}
