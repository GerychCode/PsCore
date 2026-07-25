import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { WorkShiftTagService } from './work.shift.tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Authorization } from '../common/decorator/auth.decorator';
import { Authorized } from '../common/decorator/authorized.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { Permission } from '../common/permissions/permission.enum';
import { User } from '../../generated/prisma';

@Controller('shift-tag')
export class WorkShiftTagController {
  constructor(private readonly tagService: WorkShiftTagService) {}

  @Get()
  @Authorization()
  getAllTags() {
    return this.tagService.getAllTags();
  }

  // Довідник для конструктора правил (поля/оператори/дії)
  @Get('rule-catalog')
  @RequirePermissions(Permission.MANAGE_TAGS)
  getRuleCatalog() {
    return this.tagService.getRuleCatalog();
  }

  @Get(':id')
  @Authorization()
  getTagById(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.getTagById(id);
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_TAGS)
  createTag(@Body() createDto: CreateTagDto) {
    return this.tagService.createTag(createDto);
  }

  @Put(':id')
  @RequirePermissions(Permission.MANAGE_TAGS)
  updateTag(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTagDto,
  ) {
    return this.tagService.updateTag(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_TAGS)
  deleteTag(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.deleteTag(id);
  }
}
