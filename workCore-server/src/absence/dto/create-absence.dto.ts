import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { $Enums } from '../../../generated/prisma';

export class CreateAbsenceDto {
  @IsEnum($Enums.AbsenceType, {
    message: 'type має бути VACATION, SICK, UNPAID або OTHER.',
  })
  type: $Enums.AbsenceType;

  @IsDateString({}, { message: 'startDate має бути датою у форматі ISO8601.' })
  startDate: string;

  @IsDateString({}, { message: 'endDate має бути датою у форматі ISO8601.' })
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Причина задовга (максимум 500 символів).' })
  reason?: string;

  /** Лише для менеджера: оформити відсутність іншому працівнику. */
  @IsOptional()
  @IsInt({ message: 'userId має бути цілим числом.' })
  userId?: number;
}
