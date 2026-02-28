import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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
}