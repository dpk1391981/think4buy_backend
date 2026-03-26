import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageConfig } from './entities/storage-config.entity';
import { StorageConfigService } from './storage-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([StorageConfig])],
  providers: [StorageConfigService],
  exports: [StorageConfigService],
})
export class StorageConfigModule {}
