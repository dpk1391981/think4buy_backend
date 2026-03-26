import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageConfig } from './entities/storage-config.entity';

export interface S3Settings {
  enabled: boolean;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  cdnUrl: string;
}

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
}

@Injectable()
export class StorageConfigService {
  constructor(
    @InjectRepository(StorageConfig)
    private readonly repo: Repository<StorageConfig>,
  ) {}

  async getAll(): Promise<StorageConfig[]> {
    return this.repo.find();
  }

  async getMap(): Promise<Record<string, string>> {
    const rows = await this.repo.find();
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
  }

  async upsert(key: string, value: string): Promise<void> {
    await this.repo.upsert({ key, value }, ['key']);
  }

  async bulkUpsert(entries: { key: string; value: string }[]): Promise<void> {
    for (const e of entries) {
      await this.repo.upsert({ key: e.key, value: e.value }, ['key']);
    }
  }

  async getS3Settings(): Promise<S3Settings> {
    const map = await this.getMap();
    return {
      enabled:   map['s3_enabled']   === '1',
      region:    map['s3_region']    ?? 'ap-south-1',
      bucket:    map['s3_bucket']    ?? '',
      accessKey: map['s3_access_key'] ?? '',
      secretKey: map['s3_secret_key'] ?? '',
      cdnUrl:    map['s3_cdn_url']   ?? '',
    };
  }

  async getWatermarkSettings(): Promise<WatermarkSettings> {
    const map = await this.getMap();
    return {
      enabled: map['watermark_enabled'] === '1',
      text:    map['watermark_text']     ?? '',
    };
  }
}
