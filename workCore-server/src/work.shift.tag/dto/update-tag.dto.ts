import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  IsHexColor,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TagRuleDto } from './tag-rule.dto';

export class UpdateTagDto {
  @IsOptional()
  @IsString({ message: 'Назва тегу має бути рядком' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'Рівень важливості (severity) має бути цілим числом' })
  @Min(1, { message: 'Мінімальне значення severity - 1' })
  severity?: number;

  @IsOptional()
  @IsString({ message: 'Опис має бути рядком' })
  description?: string;

  @IsOptional()
  @IsHexColor({ message: 'Колір має бути HEX (наприклад #F59E0B).' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => TagRuleDto)
  rule?: TagRuleDto;
}
