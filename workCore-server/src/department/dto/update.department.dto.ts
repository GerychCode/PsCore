import {
  IsBoolean,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
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

  @IsOptional()
  @IsObject({ message: 'Штат має бути обʼєктом днів тижня.' })
  staffingByWeekday?: Record<string, number>;

  // Обмеження навантаження для генератора графіка.
  // 0 = обмеження вимкнено; не задано = дефолт із DEFAULT_LOAD_LIMITS.
  @IsOptional()
  @IsInt({ message: 'maxHoursPerWeek має бути цілим числом.' })
  @Min(0)
  maxHoursPerWeek?: number;

  @IsOptional()
  @IsInt({ message: 'maxConsecutiveDays має бути цілим числом.' })
  @Min(0)
  maxConsecutiveDays?: number;

  @IsOptional()
  @IsInt({ message: 'minRestHours має бути цілим числом.' })
  @Min(0)
  minRestHours?: number;

  // Радіус (м), у якому зміна вважається відкритою на місці. 0 = вимкнено.
  @IsOptional()
  @IsInt({ message: 'geofenceRadiusM має бути цілим числом.' })
  @Min(0)
  geofenceRadiusM?: number;
}
