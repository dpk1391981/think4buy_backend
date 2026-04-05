import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildersController } from './builders.controller';
import { BuildersService } from './builders.service';
import { Property } from '../properties/entities/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property])],
  controllers: [BuildersController],
  providers: [BuildersService],
  exports: [BuildersService],
})
export class BuildersModule {}
