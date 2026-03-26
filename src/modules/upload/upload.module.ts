import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageUploadService } from './image-upload.service';
import { StorageConfigModule } from '../storage-config/storage-config.module';

@Module({
  imports: [ConfigModule, StorageConfigModule],
  providers: [ImageUploadService],
  exports: [ImageUploadService],
})
export class UploadModule {}
