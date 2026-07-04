import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class WorkShiftTagService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllTags() {
    return this.prisma.tag.findMany({
      orderBy: { severity: 'desc' },
    });
  }

  async getTagById(id: number) {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });
    if (!tag) throw new NotFoundException('Тег не знайдено!');
    return tag;
  }

  async createTag(createDto: CreateTagDto) {
    const existTag = await this.prisma.tag.findUnique({
      where: { name: createDto.name },
    });

    if (existTag) {
      throw new BadRequestException('Тег з такою назвою вже існує!');
    }

    return this.prisma.tag.create({
      data: createDto,
    });
  }

  async updateTag(id: number, updateDto: UpdateTagDto) {
    const tag = await this.getTagById(id);

    if (updateDto.name && updateDto.name !== tag.name) {
      const existTag = await this.prisma.tag.findUnique({
        where: { name: updateDto.name },
      });
      if (existTag) {
        throw new BadRequestException('Тег з такою назвою вже існує!');
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: updateDto,
    });
  }

  async deleteTag(id: number) {
    // Доступ контролює PermissionsGuard (MANAGE_TAGS)
    await this.getTagById(id);

    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
