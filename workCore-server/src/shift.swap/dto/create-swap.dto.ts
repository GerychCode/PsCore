import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSwapDto {
  // Планова зміна (WorkSchedule), яку віддають
  @IsInt({ message: 'scheduleId має бути цілим числом.' })
  scheduleId: number;

  // Направити пропозицію конкретній людині (необов'язково; інакше — відкрито)
  @IsOptional()
  @IsInt({ message: 'targetUserId має бути цілим числом.' })
  targetUserId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Причина не довша за 300 символів.' })
  reason?: string;
}
