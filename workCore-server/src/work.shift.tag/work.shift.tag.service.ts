import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { RULE_CATALOG } from './tag-rule.types';

@Injectable()
export class WorkShiftTagService {
  constructor(private readonly prisma: PrismaService) {}

  /** Довідник полів/операторів/дій для UI-конструктора правил. */
  getRuleCatalog() {
    return RULE_CATALOG;
  }

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

  /** autoApply=true вимагає правило (інакше тег ніколи не спрацює). */
  private assertRuleConsistent(autoApply?: boolean, rule?: unknown) {
    if (autoApply && !rule) {
      throw new BadRequestException(
        'Для автозастосування вкажіть правило (умови та дії).',
      );
    }
  }

  async createTag(createDto: CreateTagDto) {
    const existTag = await this.prisma.tag.findUnique({
      where: { name: createDto.name },
    });

    if (existTag) {
      throw new BadRequestException('Тег з такою назвою вже існує!');
    }

    this.assertRuleConsistent(createDto.autoApply, createDto.rule);

    return this.prisma.tag.create({
      data: {
        name: createDto.name,
        severity: createDto.severity,
        description: createDto.description,
        color: createDto.color,
        autoApply: createDto.autoApply ?? false,
        ...(createDto.rule !== undefined && { rule: createDto.rule as any }),
      },
    });
  }

  async updateTag(id: number, updateDto: UpdateTagDto) {
    const tag = await this.getTagById(id);

    // Системні теги: назву/важливість/автоматизацію чіпати не можна (їх веде
    // система); колір/опис для UI редагувати дозволено.
    if (
      tag.isSystem &&
      (updateDto.name !== undefined ||
        updateDto.severity !== undefined ||
        updateDto.autoApply !== undefined ||
        updateDto.rule !== undefined)
    ) {
      throw new BadRequestException(
        'Системний тег не можна перейменувати, змінити важливість чи правило.',
      );
    }

    if (updateDto.name && updateDto.name !== tag.name) {
      const existTag = await this.prisma.tag.findUnique({
        where: { name: updateDto.name },
      });
      if (existTag) {
        throw new BadRequestException('Тег з такою назвою вже існує!');
      }
    }

    // Підсумкова узгодженість autoApply/rule (з урахуванням поточного стану)
    const nextAutoApply = updateDto.autoApply ?? tag.autoApply;
    const nextRule =
      updateDto.rule !== undefined ? updateDto.rule : (tag.rule as unknown);
    this.assertRuleConsistent(nextAutoApply, nextRule);

    return this.prisma.tag.update({
      where: { id },
      data: {
        ...(updateDto.name !== undefined && { name: updateDto.name }),
        ...(updateDto.severity !== undefined && {
          severity: updateDto.severity,
        }),
        ...(updateDto.description !== undefined && {
          description: updateDto.description,
        }),
        ...(updateDto.color !== undefined && { color: updateDto.color }),
        ...(updateDto.autoApply !== undefined && {
          autoApply: updateDto.autoApply,
        }),
        ...(updateDto.rule !== undefined && { rule: updateDto.rule as any }),
      },
    });
  }

  async deleteTag(id: number) {
    // Доступ контролює PermissionsGuard (MANAGE_TAGS)
    const tag = await this.getTagById(id);
    if (tag.isSystem) {
      throw new BadRequestException('Системний тег видалити не можна.');
    }

    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
