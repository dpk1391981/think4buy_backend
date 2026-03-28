import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property } from './entities/property.entity';
import { PropertyImage } from './entities/property-image.entity';
import { PropertyStatusHistory } from './entities/property-status-history.entity';
import { Amenity } from './entities/amenity.entity';
import { PropertyView } from './entities/property-view.entity';
import { WalletModule } from '../wallet/wallet.module';
import { UploadModule } from '../upload/upload.module';
import { PropType } from '../property-config/entities/prop-type.entity';
import { MediaProcessingModule } from '../media-processing/media-processing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, PropertyImage, PropertyStatusHistory, Amenity, PropertyView, PropType]),
    WalletModule,
    ScheduleModule.forRoot(),
    UploadModule,
    MediaProcessingModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
