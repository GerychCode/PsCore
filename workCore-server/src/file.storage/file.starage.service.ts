import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import * as fs from 'node:fs';

@Injectable()
export class FileStorageService {
  constructor(private configService: ConfigService) {}

  private folderName: string = this.configService.getOrThrow<string>(
    'FILE_STORAGE_FOLDER_NAME',
  );

  public deleteFile(filename: string) {
    const filePath = path.join(process.cwd(), this.folderName, filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn(`Помилка видалення файлу: ${filePath}`, err);
      }
    });
  }
}
