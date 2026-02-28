import { IsInt, IsOptional, IsDateString } from 'class-validator';

export class FilterWorkScheduleDto {
    @IsOptional()
    @IsInt()
    userId?: number;

    @IsOptional()
    @IsInt()
    departmentId?: number;

    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @IsOptional()
    @IsDateString()
    dateTo?: string;
}