import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SystemConfig, ConfigValueType } from './entities/system-config.entity';
import IORedis from 'ioredis';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = 'syscfg:';

export interface ConfigEntry {
  key: string;
  value: any;
  valueType: ConfigValueType;
  description?: string;
  group?: string;
}

/**
 * SystemConfigService — DB-backed runtime config with Redis caching.
 *
 * Read path:  Redis (TTL 5 min) → DB → env var → hardcoded default
 * Write path: DB → invalidate Redis cache
 *
 * Usage:
 *   await configService.getBoolean('ENABLE_PROPERTY_VIDEO_UPLOAD', false)
 *   await configService.getString('CDN_BASE_URL', 'https://...')
 *   await configService.set('ENABLE_PROPERTY_VIDEO_UPLOAD', true)
 */
@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private redis: IORedis | null = null;

  constructor(
    @InjectRepository(SystemConfig)
    private readonly repo: Repository<SystemConfig>,
    private readonly nestConfig: ConfigService,
  ) {}

  async onModuleInit() {
    // Initialize Redis connection for caching
    try {
      this.redis = new IORedis({
        host:     this.nestConfig.get('REDIS_HOST', 'localhost'),
        port:     this.nestConfig.get<number>('REDIS_PORT', 6379),
        password: this.nestConfig.get('REDIS_PASSWORD') || undefined,
        db:       this.nestConfig.get<number>('REDIS_DB', 0),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await this.redis.connect();
      this.logger.log('SystemConfig Redis cache initialized');
    } catch (err) {
      this.logger.warn(`Redis unavailable, falling back to DB-only: ${err.message}`);
      this.redis = null;
    }

    // Seed default configs if not present
    await this.seedDefaults();
  }

  // ── Public read API ─────────────────────────────────────────────────────────

  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const raw = await this.getRaw(key);
    if (raw === null) return defaultValue;
    return raw === 'true' || raw === '1';
  }

  async getString(key: string, defaultValue = ''): Promise<string> {
    const raw = await this.getRaw(key);
    return raw ?? defaultValue;
  }

  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const raw = await this.getRaw(key);
    if (raw === null) return defaultValue;
    const n = Number(raw);
    return isNaN(n) ? defaultValue : n;
  }

  async getJson<T = any>(key: string, defaultValue: T | null = null): Promise<T | null> {
    const raw = await this.getRaw(key);
    if (raw === null) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  // ── Public write API ────────────────────────────────────────────────────────

  async set(
    key: string,
    value: any,
    opts?: { valueType?: ConfigValueType; description?: string; group?: string },
  ): Promise<SystemConfig> {
    const strValue  = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const valueType = opts?.valueType ?? this.inferType(value);

    let config = await this.repo.findOne({ where: { key } });
    if (config) {
      config.value     = strValue;
      config.valueType = valueType;
      if (opts?.description) config.description = opts.description;
      if (opts?.group)       config.group = opts.group;
    } else {
      config = this.repo.create({
        key,
        value:     strValue,
        valueType,
        description: opts?.description,
        group:       opts?.group ?? 'general',
      });
    }

    await this.repo.save(config);
    await this.invalidateCache(key);
    return config;
  }

  async delete(key: string): Promise<void> {
    await this.repo.delete({ key });
    await this.invalidateCache(key);
  }

  async getAll(group?: string): Promise<SystemConfig[]> {
    return this.repo.find({
      where: group ? { group } : undefined,
      order: { group: 'ASC', key: 'ASC' },
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async getRaw(key: string): Promise<string | null> {
    // 1. Redis cache
    if (this.redis) {
      try {
        const cached = await this.redis.get(`${CACHE_PREFIX}${key}`);
        if (cached !== null) return cached === '__NULL__' ? null : cached;
      } catch { /* Redis miss — fall through */ }
    }

    // 2. Database
    const config = await this.repo.findOne({ where: { key } });
    const value = config?.value ?? null;

    // Write to cache
    if (this.redis) {
      try {
        await this.redis.setex(
          `${CACHE_PREFIX}${key}`,
          CACHE_TTL_SECONDS,
          value ?? '__NULL__',
        );
      } catch { /* ignore cache write failures */ }
    }

    return value;
  }

  private async invalidateCache(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(`${CACHE_PREFIX}${key}`);
    } catch { /* ignore */ }
  }

  private inferType(value: any): ConfigValueType {
    if (typeof value === 'boolean')      return ConfigValueType.BOOLEAN;
    if (typeof value === 'number')       return ConfigValueType.NUMBER;
    if (typeof value === 'object')       return ConfigValueType.JSON;
    if (value === 'true' || value === 'false') return ConfigValueType.BOOLEAN;
    return ConfigValueType.STRING;
  }

  private async seedDefaults(): Promise<void> {
    const defaults: Array<Omit<ConfigEntry, 'value'> & { value: any }> = [
      {
        key: 'ENABLE_PROPERTY_VIDEO_UPLOAD',
        value: false,
        valueType: ConfigValueType.BOOLEAN,
        description: 'Allow users to upload video files with property listings',
        group: 'media',
      },
      {
        key: 'ENABLE_IMAGE_ASYNC_PROCESSING',
        value: true,
        valueType: ConfigValueType.BOOLEAN,
        description: 'Process images asynchronously via BullMQ queue (thumbnails, WebP conversion)',
        group: 'media',
      },
      {
        key: 'MAX_IMAGES_PER_PROPERTY',
        value: 20,
        valueType: ConfigValueType.NUMBER,
        description: 'Maximum number of images allowed per property listing',
        group: 'media',
      },
      {
        key: 'MAX_VIDEO_SIZE_MB',
        value: 100,
        valueType: ConfigValueType.NUMBER,
        description: 'Maximum video file size in megabytes',
        group: 'media',
      },
      {
        key: 'ENABLE_DB_REPLICA',
        value: false,
        valueType: ConfigValueType.BOOLEAN,
        description: 'Route read queries to MySQL read replica',
        group: 'database',
      },
      {
        key: 'ENABLE_CDN',
        value: false,
        valueType: ConfigValueType.BOOLEAN,
        description: 'Serve media through CloudFront CDN with signed URLs',
        group: 'storage',
      },
      {
        key: 'MAINTENANCE_MODE',
        value: false,
        valueType: ConfigValueType.BOOLEAN,
        description: 'Put site in maintenance mode (returns 503 for all non-admin requests)',
        group: 'general',
      },
    ];

    for (const d of defaults) {
      const exists = await this.repo.findOne({ where: { key: d.key } });
      if (!exists) {
        await this.repo.save(this.repo.create({
          key:         d.key,
          value:       String(d.value),
          valueType:   d.valueType,
          description: d.description,
          group:       d.group,
        }));
      }
    }
  }
}
