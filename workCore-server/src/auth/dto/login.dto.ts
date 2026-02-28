import {
    IsEmail,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class UserLoginDto {
    @IsEmail({}, { message: 'Введіть дійсну адресу електронної пошти.' })
    email: string;

    @IsString({ message: 'Пароль повинен бути текстовим.' })
    password: string;
}
