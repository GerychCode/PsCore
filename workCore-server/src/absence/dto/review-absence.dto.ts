import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAbsenceDto {
  /** Коментар менеджера — найчастіше причина відмови. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Коментар задовгий (максимум 500 символів).' })
  comment?: string;
}
