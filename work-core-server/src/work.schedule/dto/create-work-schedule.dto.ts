import {
  IsInt,
  IsDateString,
  Matches,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateWorkScheduleDto {
  @IsInt({ message: 'UserId має бути цілим числом' })
  userId: number;

  @IsInt({ message: 'DepartmentId має бути цілим числом' })
  departmentId: number;

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

  @IsOptional()
  @IsBoolean()
  isDayOff?: boolean;
}
