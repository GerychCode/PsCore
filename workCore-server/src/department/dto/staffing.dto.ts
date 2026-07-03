import { IsArray, IsInt, Max, Min } from 'class-validator';

export class SetMembersDto {
  @IsArray()
  @IsInt({ each: true, message: 'ID користувачів мають бути цілими числами.' })
  userIds: number[];
}

export class StaffingDayDto {
  @IsInt()
  @Min(1, { message: 'День тижня — від 1 (Пн) до 7 (Нд).' })
  @Max(7, { message: 'День тижня — від 1 (Пн) до 7 (Нд).' })
  weekday: number;

  @IsInt()
  @Min(0, { message: 'Штат не може бути відʼємним.' })
  @Max(50, { message: 'Штат не може перевищувати 50.' })
  count: number;
}
