import { IsObject } from 'class-validator';
import { NotificationPrefs } from '../../notifications/notification.prefs';

export class UpdateNotificationPrefsDto {
  @IsObject({ message: 'Налаштування мають бути обʼєктом.' })
  preferences: NotificationPrefs;
}
