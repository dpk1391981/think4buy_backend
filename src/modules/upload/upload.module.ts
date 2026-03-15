import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageUploadService } from './image-upload.service';

/**
 * Provides `ImageUploadService` to any module that imports `UploadModule`.
 * ConfigModule is imported so ImageUploadService can read PUBLIC_API_URL.
 */
@Module({
  imports: [ConfigModule],
  providers: [ImageUploadService],
  exports: [ImageUploadService],
})
export class UploadModule {}
