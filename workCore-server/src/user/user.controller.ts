import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Put,
  Delete,
  ParseIntPipe,
  Post,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Authorized } from '../common/decorator/authorized.decorator';
import { Authorization } from '../common/decorator/auth.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import {
  hasPermission,
  resolvePermissions,
} from '../common/permissions/permissions.util';
import { $Enums, User } from '../../generated/prisma';
import Role = $Enums.Role;
import { UpdateUserDto, UpdateUserDtoAdmin } from './dto/update.user.dto';
import { UpdateNotificationPrefsDto } from './dto/notification-prefs.dto';
import { PasswordDto } from './dto/password.dto';
import { IsNumber } from 'class-validator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get()
  @Authorization()
  public async getUser(@Authorized() user: User) {
    // Повертаємо профіль разом із обчисленими правами — клієнт гейтить UI
    const profile = await this.userService.findById((user as any).id);
    return {
      ...profile,
      appRoles: (user as any).appRoles ?? [],
      permissions: [...resolvePermissions(user as any)],
    };
  }

  @Get('list/:id')
  @Authorization()
  public async getUserById(
    @Authorized() requester: User,
    @Param('id', ParseIntPipe) userId: number,
  ) {
    const user = await this.userService.findById(userId);
    // Чутливі поля бачить власник профілю або той, хто має VIEW_ALL_PROFILES
    const canViewAll =
      requester.id === userId ||
      hasPermission(requester as any, Permission.VIEW_ALL_PROFILES);
    if (!canViewAll) {
      const { phone, address, dateOfBirth, ...publicUser } = user;
      return publicUser;
    }
    return user;
  }

  @Get('notification-preferences')
  @Authorization()
  public async getNotificationPrefs(@Authorized('id') userId: number) {
    return this.userService.getNotificationPrefs(userId);
  }

  @Put('notification-preferences')
  @Authorization()
  public async updateNotificationPrefs(
    @Authorized('id') userId: number,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.userService.updateNotificationPrefs(userId, dto.preferences);
  }

  @Post('telegram-code')
  @Authorization()
  public async generateTelegramCode(@Authorized('id') userId: number) {
    const code = await this.userService.generateTelegramCode(userId);
    return { code };
  }

  @Put('avatar')
  @Authorization()
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  uploadFile(
    @Authorized() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.userService.saveAvatarToDB(user, file);
  }

  @Get('list')
  @Authorization()
  public async getAllUsers(@Authorized() requester: User) {
    const canViewAll = hasPermission(
      requester as any,
      Permission.VIEW_ALL_PROFILES,
    );
    return this.userService.findAllUsers(canViewAll);
  }

  @Put('update/:id')
  @RequirePermissions(Permission.MANAGE_USERS)
  updateUserForAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDtoAdmin,
  ) {
    return this.userService.updateUser(updateUserDto, id);
  }

  @Put('')
  @Authorization()
  updateUser(@Authorized() user: User, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(updateUserDto, undefined, user);
  }

  @Delete('delete/:id')
  @RequirePermissions(Permission.MANAGE_USERS)
  deleteUser(
    @Authorized('id') userId: number,
    @Param('id', ParseIntPipe) targetUserId: number,
  ) {
    return this.userService.destroyUser(userId, targetUserId);
  }

  @Delete('')
  @Authorization()
  delete(@Authorized('id') id: number, @Body() passwordDto: PasswordDto) {
    return this.userService.destroySelf(id, passwordDto);
  }

  @Get(':id/statistics')
  @Authorization()
  public async getStatistics(
    @Param('id', ParseIntPipe) id: number,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const parsedMonth = parseInt(month ?? '', 10);
    const parsedYear = parseInt(year ?? '', 10);
    const currentMonth =
      !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : new Date().getMonth() + 1;
    const currentYear = !isNaN(parsedYear)
      ? parsedYear
      : new Date().getFullYear();

    return this.userService.getUserStatistics(id, currentMonth, currentYear);
  }
}
