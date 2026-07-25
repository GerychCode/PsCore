import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  RULE_ACTIONS,
  RULE_FIELDS,
  RULE_MATCH,
  RULE_OPS,
  RULE_TRIGGERS,
} from '../tag-rule.types';

export class RuleConditionDto {
  @IsIn(RULE_FIELDS as unknown as string[], { message: 'Невідоме поле умови.' })
  field: string;

  @IsIn(RULE_OPS as unknown as string[], { message: 'Невідомий оператор.' })
  op: string;

  // Полиморфне (рядок/число/бул/масив) — @IsDefined зберігає його від whitelist,
  // а evaluator обробляє тип безпечно.
  @IsDefined({ message: 'Значення умови обовʼязкове.' })
  value: unknown;
}

export class RuleActionDto {
  @IsIn(RULE_ACTIONS as unknown as string[], { message: 'Невідома дія.' })
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Заголовок не довший за 120 символів.' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Текст не довший за 500 символів.' })
  message?: string;
}

export class TagRuleDto {
  @IsIn(RULE_TRIGGERS as unknown as string[], { message: 'Невідомий тригер.' })
  trigger: string;

  @IsIn(RULE_MATCH as unknown as string[], {
    message: 'match має бути ALL або ANY.',
  })
  match: string;

  @IsArray()
  @ArrayMaxSize(10, { message: 'Не більше 10 умов.' })
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @IsArray()
  @ArrayMaxSize(5, { message: 'Не більше 5 дій.' })
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  actions: RuleActionDto[];
}
