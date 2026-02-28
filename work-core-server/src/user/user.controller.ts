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
} from '@nestjs/common';
import { UserService } from './user.service';
import { Authorized } from '../common/decorator/authorized.decorator';
import { Authorization } from '../common/decorator/auth.decorator';
import { $Enums, User } from '../../generated/prisma';
import Role = $Enums.Role;
import { UpdateUserDto, UpdateUserDtoAdmin } from './dto/update.user.dto';
import { PasswordDto } from './dto/password.dto';
import { IsNumber } from 'class-validator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get()
  @Authorization()
  public async getUser(@Authorized('id') userId: number) {
    return this.userService.findById(userId);
  }

  @Get('list/:id')
  @Authorization()
  public async getUserById(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.findById(userId);
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
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      }),
  )
  uploadFile(
      @Authorized() user: User,
      @UploadedFile(
          new ParseFilePipe({
            validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
          }),
      )
      file: Express.Multer.File,
  ) {
    return this.userService.saveAvatarToDB(user, file);
  }

  @Get('list')
  @Authorization()
  public async getAllUsers() {
    return this.userService.findAllUsers();
  }

  @Put('update/:id')
  @Authorization(Role.Admin)
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
  @Authorization(Role.Admin)
  deleteUser(
      @Authorized('id') userId: number,
      @Param('id') targetUserId: number,
  ) {
    return this.userService.destroyUser(userId, targetUserId);
  }

  @Delete('')
  @Authorization()
  delete(@Authorized('id') id: number, @Body() passwordDto: PasswordDto) {
    return this.userService.destroySelf(id, passwordDto);
  }
}