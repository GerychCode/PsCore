import { IsDateString } from 'class-validator';

export class CreateWishDto {
  @IsDateString(
    {},
    { message: 'Дата має бути у форматі ISO8601 (yyyy-mm-dd).' },
  )
  date: string;
}
