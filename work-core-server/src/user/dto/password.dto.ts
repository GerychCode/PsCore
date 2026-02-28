import {IsString, Matches, MaxLength, MinLength} from "class-validator";

export class PasswordDto {
    @IsString({ message: 'Пароль повинен бути текстовим.' })
    @MinLength(8, { message: 'Пароль повинен містити щонайменше 8 символів.' })
    @MaxLength(100, { message: 'Пароль не повинен перевищувати 100 символів.' })
    @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/, {
        message: 'Пароль повинен містити великі й малі літери та хоча б одну цифру.',
    })
    password: string;
}
