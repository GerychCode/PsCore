import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { NotificationPrefs } from '../../notifications/notification.prefs';

/** Канали доставки однієї категорії. */
class ChannelPrefsDto {
  @IsOptional()
  @IsBoolean()
  web?: boolean;

  @IsOptional()
  @IsBoolean()
  telegram?: boolean;
}

/** Налаштування по категоріях — лише відомі ключі й лише boolean-канали. */
class NotificationPrefsBodyDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefsDto)
  shift?: ChannelPrefsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefsDto)
  chat?: ChannelPrefsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefsDto)
  schedule?: ChannelPrefsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefsDto)
  system?: ChannelPrefsDto;
}

export class UpdateNotificationPrefsDto {
  @IsObject({ message: 'Налаштування мають бути обʼєктом.' })
  @ValidateNested()
  @Type(() => NotificationPrefsBodyDto)
  preferences: NotificationPrefs;
}
