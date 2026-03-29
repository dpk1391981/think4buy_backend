import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartSearchController } from './smart-search.controller';
import { SmartSearchService } from './smart-search.service';
import { SearchLog } from './entities/search-log.entity';
import { UserBehavior } from './entities/user-behavior.entity';
import { Lead } from '../leads/entities/lead.entity';
import { City } from '../locations/entities/city.entity';
import { PropType } from '../property-config/entities/prop-type.entity';
import { SearchKeywordMapping } from '../property-config/entities/search-keyword-mapping.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SearchLog, UserBehavior, Lead, City, PropType, SearchKeywordMapping])],
  controllers: [SmartSearchController],
  providers: [SmartSearchService],
  exports: [SmartSearchService],
})
export class SmartSearchModule {}
