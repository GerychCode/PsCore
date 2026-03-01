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
import { Role, User } from '../../generated/prisma';

@Controller('shift-tag')
export class WorkShiftTagController {
  constructor(private readonly tagService: WorkShiftTagService) {}

  @Get()
  @Authorization()
  getAllTags() {
    return this.tagService.getAllTags();
  }

  @Get(':id')
  @Authorization()
  getTagById(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.getTagById(id);
  }

  @Post()
  @Authorization(Role.Admin)
  createTag(@Authorized() user: User, @Body() createDto: CreateTagDto) {
    return this.tagService.createTag(createDto);
  }

  @Put(':id')
  @Authorization(Role.Admin)
  updateTag(
    @Authorized() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTagDto,
  ) {
    return this.tagService.updateTag(id, updateDto);
  }

  @Delete(':id')
  @Authorization()
  deleteTag(@Authorized() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.tagService.deleteTag(user, id);
  }
}
