import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartSearchController } from './smart-search.controller';
import { SmartSearchService } from './smart-search.service';
import { SearchLog } from './entities/search-log.entity';
import { UserBehavior } from './entities/user-behavior.entity';
import { Lead } from '../leads/entities/lead.entity';
import { City } from '../locations/entities/city.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SearchLog, UserBehavior, Lead, City])],
  controllers: [SmartSearchController],
  providers: [SmartSearchService],
  exports: [SmartSearchService],
})
export class SmartSearchModule {}
