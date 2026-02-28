import { IsInt, IsDateString, Matches, IsOptional } from 'class-validator';

export class CreateWorkShiftDto {
  @IsInt({ message: 'DepartmentId має бути цілим числом' })
  departmentId: number;

  @IsOptional()
  @IsInt({ message: 'UserId має бути цілим числом' })
  userId?: number;

  @IsDateString(
    {},
    { message: 'Date має бути у форматі ISO8601 (yyyy-mm-ddTHH:MM:SSZ)' },
  )
  date: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startedAt має бути у форматі HH:MM',
  })
  startedAt: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime має бути у форматі HH:MM',
  })
  endTime: string;
}
