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
  IsDateString,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: "Ім'я повинно бути текстом." })
  @IsNotEmpty({ message: "Ім'я є обов'язковим." })
  @MaxLength(50, { message: "Ім'я не повинно перевищувати 50 символів." })
  firstName: string;

  @IsString({ message: 'Прізвище повинно бути текстом.' })
  @IsNotEmpty({ message: "Прізвище є обов'язковим." })
  @MaxLength(50, { message: 'Прізвище не повинно перевищувати 50 символів.' })
  lastName: string;

  @IsEmail({}, { message: 'Введіть дійсну адресу електронної пошти.' })
  email: string;

  @IsString({ message: 'Пароль повинен бути текстовим.' })
  @MinLength(8, { message: 'Пароль повинен містити щонайменше 8 символів.' })
  @MaxLength(100, { message: 'Пароль не повинен перевищувати 100 символів.' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/, {
    message:
      'Пароль повинен містити великі й малі літери та хоча б одну цифру.',
  })
  password: string;

  @IsString({ message: 'Аватар повинен бути рядком.' })
  @IsOptional()
  avatar?: string;
}
