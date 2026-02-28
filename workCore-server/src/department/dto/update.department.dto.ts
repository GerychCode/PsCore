import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString({ message: 'Назва повинна бути текстом.' })
  @IsNotEmpty({ message: 'Назва не може бути порожньою.' })
  name?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 09:00).',
  })
  weekdaysOpeningTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 18:00).',
  })
  weekdaysClosingTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 10:00).',
  })
  weekendsOpeningTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 16:00).',
  })
  weekendsClosingTime?: string;

  @IsOptional()
  @IsString({ message: 'Адреса повинна бути текстом.' })
  address?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Широта повинна бути числом.' })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Довгота повинна бути числом.' })
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}