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
import { UpdateDepartmentDto } from './dto/update.department.dto';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

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
  @Authorization('Admin')
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
  @Authorization('Admin')
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
  @Authorization('Admin')
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