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

export class CreateDepartmentDto {
  @IsString({ message: 'Назва повинна бути текстом.' })
  @IsNotEmpty({ message: "Назва є обов'язковою." })
  name: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 09:00).',
  })
  weekdaysOpeningTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 18:00).',
  })
  weekdaysClosingTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 10:00).',
  })
  weekendsOpeningTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Час має бути у форматі HH:MM (наприклад, 16:00).',
  })
  weekendsClosingTime: string;

  @IsOptional()
  @IsString({ message: 'Адреса повинна бути текстом.' })
  address: string;

  @IsOptional()
  @IsNumber({}, { message: 'Широта повинна бути числом.' })
  latitude: number;

  @IsOptional()
  @IsNumber({}, { message: 'Довгота повинна бути числом.' })
  longitude?: number;

  @IsBoolean()
  @IsOptional()
  isActive: boolean;

  // Потрібний штат по днях тижня: { "1": 3, ... "7": 2 } (1=Пн, 7=Нд)
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
