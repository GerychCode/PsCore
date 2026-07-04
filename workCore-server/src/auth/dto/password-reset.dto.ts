import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Введіть дійсну адресу електронної пошти.' })
  email: string;
}

export class ResendVerificationDto {
  @IsEmail({}, { message: 'Введіть дійсну адресу електронної пошти.' })
  email: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty({ message: 'Токен відсутній.' })
  token: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Токен відсутній.' })
  token: string;

  @IsString({ message: 'Пароль повинен бути текстовим.' })
  @MinLength(8, { message: 'Пароль повинен містити щонайменше 8 символів.' })
  @MaxLength(100, { message: 'Пароль не повинен перевищувати 100 символів.' })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/, {
    message:
      'Пароль повинен містити великі й малі літери та хоча б одну цифру.',
  })
  password: string;
}
