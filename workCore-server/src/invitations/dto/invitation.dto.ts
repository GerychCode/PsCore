import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInvitationDto {
  @IsString({ message: "Ім'я повинно бути текстом." })
  @IsNotEmpty({ message: "Ім'я є обов'язковим." })
  @MaxLength(50)
  firstName: string;

  @IsString({ message: 'Прізвище повинно бути текстом.' })
  @IsNotEmpty({ message: "Прізвище є обов'язковим." })
  @MaxLength(50)
  lastName: string;

  @IsEmail({}, { message: 'Введіть дійсну адресу електронної пошти.' })
  email: string;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty({ message: 'Токен відсутній.' })
  token: string;

  @IsString({ message: 'Пароль повинен бути текстовим.' })
  @MinLength(8, { message: 'Пароль повинен містити щонайменше 8 символів.' })
  @MaxLength(100)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/, {
    message:
      'Пароль повинен містити великі й малі літери та хоча б одну цифру.',
  })
  password: string;
}
