import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { MarketSnapshot } from '../analytics/entities/market-snapshot.entity';
import { Property } from '../properties/entities/property.entity';
import { SearchLog } from '../smart-search/entities/search-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketSnapshot, Property, SearchLog])],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
