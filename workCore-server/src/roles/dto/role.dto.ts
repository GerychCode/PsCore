import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Permission } from '../../common/permissions/permission.enum';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Назва ролі обовʼязкова.' })
  @MaxLength(40, { message: 'Назва не довша за 40 символів.' })
  name: string;

  @IsOptional()
  @IsHexColor({ message: 'Колір має бути HEX (наприклад #5865F2).' })
  color?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true, message: 'Невідоме право доступу.' })
  permissions?: Permission[];

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Назва ролі не може бути порожньою.' })
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsHexColor({ message: 'Колір має бути HEX.' })
  color?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true, message: 'Невідоме право доступу.' })
  permissions?: Permission[];

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AssignRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'ID ролей мають бути цілими числами.' })
  roleIds: number[];
}
