import { IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class WeekViewQueryDto {
    @Type(() => String)
    @IsDateString({}, { message: 'Date має бути у форматі ISO8601 (yyyy-mm-dd)' })
    date: string;
}