import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
    MinLength,
    IsDateString, IsDate,
} from 'class-validator';
import {$Enums} from "../../../generated/prisma";
import Role = $Enums.Role;
import {Transform, Type} from "class-transformer";

export class UpdateUserDto {
    @IsOptional()
    @IsString({ message: 'Ім\'я повинно бути текстом.' })
    @IsNotEmpty({ message: 'Ім\'я є обов\'язковим.' })
    @MaxLength(50, { message: 'Ім\'я не повинно перевищувати 50 символів.' })
    firstName: string;

    @IsOptional()
    @IsString({ message: 'Прізвище повинно бути текстом.' })
    @IsNotEmpty({ message: 'Прізвище є обов\'язковим.' })
    @MaxLength(50, { message: 'Прізвище не повинно перевищувати 50 символів.' })
    lastName: string;

    @IsOptional()
    @IsEmail({}, { message: 'Введіть дійсну адресу електронної пошти.' })
    email: string;

    @IsOptional()
    @Transform(({ value }) => value ? new Date(value) : value)
    @IsDate({ message: 'Дата народження повинна бути у форматі ISO (наприклад, 1990-01-01).' })
    dateOfBirth?: Date;

    @IsOptional()
    @IsString({ message: 'Телефон повинен бути рядком.' })
    phone?: string;

    @IsOptional()
    @IsString({ message: 'Адреса повинна бути рядком.' })
    address?: string;

    @IsString({ message: 'Аватар повинен бути рядком.' })
    @IsOptional()
    avatar?: string;
}

export class UpdateUserDtoAdmin extends UpdateUserDto {
    @IsEnum(Role, {
        message: 'Роль повинна бути однією з таких: employee, manager або admin.',
    })
    @IsOptional()
    role?: Role;
}