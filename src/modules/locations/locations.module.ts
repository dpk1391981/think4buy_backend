import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { Location } from './entities/location.entity';
import { State } from './entities/state.entity';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Location, State, City, Country])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
