import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { LocationImportJob } from './entities/location-import-job.entity';
import { LocationImportService, LOCATION_IMPORT_QUEUE } from './location-import.service';
import { LocationImportProcessor } from './location-import.processor';
import { LocationImportController } from './location-import.controller';
import { Location } from '../locations/entities/location.entity';
import { City } from '../locations/entities/city.entity';
import { State } from '../locations/entities/state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationImportJob, Location, City, State]),
    BullModule.registerQueue({ name: LOCATION_IMPORT_QUEUE }),
  ],
  controllers: [LocationImportController],
  providers: [LocationImportService, LocationImportProcessor],
  exports: [LocationImportService],
})
export class LocationImportModule {}
