import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import { LocationImportJob } from './entities/location-import-job.entity';

export const LOCATION_IMPORT_QUEUE = 'location-import';

@Injectable()
export class LocationImportService {
  private readonly logger = new Logger(LocationImportService.name);

  constructor(
    @InjectRepository(LocationImportJob)
    private readonly jobRepo: Repository<LocationImportJob>,
    @InjectQueue(LOCATION_IMPORT_QUEUE)
    private readonly queue: Queue,
  ) {}

  async createJob(
    fileName: string,
    fileType: string,
    filePath: string,
    options: NonNullable<LocationImportJob['options']>,
  ): Promise<LocationImportJob> {
    const job = this.jobRepo.create({
      fileName,
      fileType,
      filePath,
      options,
      status: 'pending',
      logOutput: `[${new Date().toISOString()}] Job created. File: ${fileName}\nOptions: geocode=${options.geocode}, forceGeocode=${options.forceGeocode}, dryRun=${options.dryRun}, fileFilter="${options.fileFilter}"\n`,
    });
    await this.jobRepo.save(job);

    await this.queue.add(
      'processSpreadsheet',
      { jobId: job.id },
      {
        attempts: 1,          // single attempt — processor handles errors
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    this.logger.log(`Location import job enqueued: ${job.id} — ${fileName}`);
    return job;
  }

  async getJob(id: string): Promise<LocationImportJob> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Import job ${id} not found`);
    return job;
  }

  async listJobs(
    page = 1,
    limit = 20,
  ): Promise<{ data: Partial<LocationImportJob>[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.jobRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: [
        'id', 'status', 'fileName', 'fileType', 'options',
        'progress', 'totalRows', 'processedRows',
        'citiesInserted', 'citiesUpdated',
        'localitiesInserted', 'localitiesUpdated', 'localitiesUnchanged',
        'createdAt', 'startedAt', 'completedAt', 'errorMessage',
      ],
    });
    return { data, total, page, limit };
  }

  async cancelJob(id: string): Promise<{ message: string }> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Import job ${id} not found`);

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return { message: `Job is already ${job.status}` };
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    await this.jobRepo.save(job);
    return { message: 'Job cancelled' };
  }

  async deleteJob(id: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id } });
    if (!job) throw new NotFoundException(`Import job ${id} not found`);

    if (job.filePath) {
      try { fs.unlinkSync(job.filePath); } catch { /* file may already be deleted */ }
    }
    await this.jobRepo.delete(id);
  }
}
