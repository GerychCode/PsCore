import { IsInt, IsDateString, IsBoolean } from 'class-validator';

export class LockWeekDto {
  @IsInt()
  departmentId: number;

  @IsDateString()
  date: string;

  @IsBoolean()
  isLocked: boolean;
}
