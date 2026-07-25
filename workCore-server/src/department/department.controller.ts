import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Param,
  Put,
  Delete,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create.department.dto';
import { Authorization } from '../common/decorator/auth.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { UpdateDepartmentDto } from './dto/update.department.dto';
import { SetMembersDto } from './dto/staffing.dto';
import { DepartmentLinkService } from '../telegram/department-link.service';

@Controller('department')
export class DepartmentController {
  constructor(
    private readonly departmentService: DepartmentService,
    private readonly departmentLinkService: DepartmentLinkService,
  ) {}

  // ---------- Telegram-акаунт відділення (куди йдуть коди підтвердження) ----------

  @Get(':departmentId/telegram')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async getTelegramStatus(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    const status = await this.departmentLinkService.status(departmentId);
    if (!status) {
      throw new HttpException('Відділення не знайдено', HttpStatus.NOT_FOUND);
    }
    return status;
  }

  /**
   * Видає одноразовий код, який треба надіслати боту З АКАУНТА ВІДДІЛЕННЯ.
   * Сам chat id адмін не вводить: код доводить доступ до чату й унеможливлює
   * помилку, за якої коди присутності летіли б стороннім.
   */
  @Post(':departmentId/telegram/code')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async createTelegramCode(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    const status = await this.departmentLinkService.status(departmentId);
    if (!status) {
      throw new HttpException('Відділення не знайдено', HttpStatus.NOT_FOUND);
    }
    return this.departmentLinkService.createCode(departmentId);
  }

  @Delete(':departmentId/telegram')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async unlinkTelegram(
    @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    const status = await this.departmentLinkService.status(departmentId);
    if (!status) {
      throw new HttpException('Відділення не знайдено', HttpStatus.NOT_FOUND);
    }
    return this.departmentLinkService.unlink(departmentId);
  }

  @Get()
  @Authorization()
  async getAllDepartment() {
    try {
      return await this.departmentService.getAllDepartments();
    } catch (error) {
      throw new HttpException(
          error.message,
          error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':departmentId/members')
  @Authorization()
  async getMembers(
      @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    return this.departmentService.getMembers(departmentId);
  }

  @Put(':departmentId/members')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async setMembers(
      @Param('departmentId', ParseIntPipe) departmentId: number,
      @Body() dto: SetMembersDto,
  ) {
    return this.departmentService.setMembers(departmentId, dto.userIds);
  }

  @Get(':departmentId')
  @Authorization()
  async getDepartmentById(
      @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    try {
      return await this.departmentService.getDepartmentById(departmentId);
    } catch (error) {
      throw new HttpException(
          error.message,
          error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async createDepartment(@Body() departmentDto: CreateDepartmentDto) {
    try {
      return await this.departmentService.createDepartment(departmentDto);
    } catch (error) {
      throw new HttpException(
          error.message,
          error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':departmentId')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async updateDepartment(
      @Param('departmentId', ParseIntPipe) departmentId: number,
      @Body() departmentDto: UpdateDepartmentDto,
  ) {
    try {
      return await this.departmentService.updateDepartment(
          departmentId,
          departmentDto,
      );
    } catch (error) {
      throw new HttpException(
          error.message,
          error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':departmentId')
  @RequirePermissions(Permission.MANAGE_DEPARTMENTS)
  async deleteDepartment(
      @Param('departmentId', ParseIntPipe) departmentId: number,
  ) {
    try {
      return await this.departmentService.deleteDepartment(departmentId);
    } catch (error) {
      throw new HttpException(
          error.message,
          error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}