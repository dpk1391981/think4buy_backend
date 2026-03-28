import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MediaJob } from './entities/media-job.entity';
import { PropertyImage } from '../properties/entities/property-image.entity';
import { MediaProcessingService, IMAGE_QUEUE, VIDEO_QUEUE } from './media-processing.service';
import { MediaProcessingController } from './media-processing.controller';
import { ImageProcessor } from './processors/image.processor';
import { VideoProcessor } from './processors/video.processor';
import { StorageConfigModule } from '../storage-config/storage-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaJob, PropertyImage]),
    BullModule.registerQueue(
      { name: IMAGE_QUEUE },
      { name: VIDEO_QUEUE },
    ),
    StorageConfigModule,
  ],
  providers: [
    MediaProcessingService,
    ImageProcessor,
    VideoProcessor,
  ],
  controllers: [MediaProcessingController],
  exports: [MediaProcessingService],
})
export class MediaProcessingModule {}
