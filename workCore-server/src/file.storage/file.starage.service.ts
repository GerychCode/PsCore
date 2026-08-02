import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import * as fs from 'node:fs';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger('FileStorage');

  constructor(private configService: ConfigService) {}

  private folderName: string = this.configService.getOrThrow<string>(
    'FILE_STORAGE_FOLDER_NAME',
  );

  /**
   * Видаляє файл ВИКЛЮЧНО з каталогу uploads.
   * SECURITY: приймаємо лише базове ім'я (basename) і перевіряємо, що
   * підсумковий шлях лишається всередині каталогу — інакше `../`-послідовність
   * у збереженому в БД імені дозволила б видалити довільний файл.
   */
  public deleteFile(filename: string) {
    if (!filename) return;

    const baseDir = path.resolve(process.cwd(), this.folderName);
    // basename відкидає будь-які теки/`..` з переданого імені
    const safeName = path.basename(filename);
    const filePath = path.resolve(baseDir, safeName);

    // Подвійний захист: файл має лежати саме в baseDir. basename вже прибирає
    // теки, тож ця гілка недосяжна за звичайних вхідних даних — лишається
    // як явний захисний інваріант.
    /* istanbul ignore next */
    if (path.dirname(filePath) !== baseDir) {
      this.logger.warn(`Відхилено видалення поза uploads: ${filename}`);
      return;
    }

    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        this.logger.warn(`Помилка видалення файлу: ${filePath} — ${err.message}`);
      }
    });
  }
}
