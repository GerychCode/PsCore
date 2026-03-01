import { IsString, IsInt, IsOptional, Min } from 'class-validator';

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
}
