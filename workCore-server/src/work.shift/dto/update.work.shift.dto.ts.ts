import { IsArray, IsEnum, IsInt, IsOptional, Matches } from 'class-validator';
import { $Enums } from '../../../generated/prisma';

export class UpdateWorkShiftDto {
  @IsOptional()
  @IsInt({ message: 'DepartmentId має бути цілим числом' })
  departmentId?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startedAt має бути у форматі HH:MM',
  })
  startedAt?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime має бути у форматі HH:MM',
  })
  endTime?: string;

  @IsOptional()
  @IsEnum($Enums.ShiftStatus, { message: 'Невірний статус' })
  status?: $Enums.ShiftStatus;

  @IsOptional()
  @IsArray()
  tagIds?: number[];
}
