import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { $Enums } from '../../../generated/prisma';

export class AbsenceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsEnum($Enums.AbsenceStatus)
  status?: $Enums.AbsenceStatus;

  @IsOptional()
  @IsEnum($Enums.AbsenceType)
  type?: $Enums.AbsenceType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
