import { IsDateString, IsInt } from 'class-validator';

export class GenerateWeekDto {
  @IsInt({ message: 'departmentId має бути цілим числом.' })
  departmentId: number;

  @IsDateString(
    {},
    { message: 'date має бути у форматі ISO8601 (yyyy-mm-dd).' },
  )
  date: string;
}
