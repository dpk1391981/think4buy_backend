import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyConfigController } from './property-config.controller';
import { PropertyConfigService } from './property-config.service';
import { PropCategory } from './entities/prop-category.entity';
import { PropType } from './entities/prop-type.entity';
import { PropTypeAmenity } from './entities/prop-type-amenity.entity';
import { PropTypeField } from './entities/prop-type-field.entity';
import { Amenity } from '../properties/entities/amenity.entity';
import { ListingFilterConfig } from './entities/listing-filter-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PropCategory,
      PropType,
      PropTypeAmenity,
      PropTypeField,
      Amenity,
      ListingFilterConfig,
    ]),
  ],
  controllers: [PropertyConfigController],
  providers: [PropertyConfigService],
  exports: [PropertyConfigService],
})
export class PropertyConfigModule {}
