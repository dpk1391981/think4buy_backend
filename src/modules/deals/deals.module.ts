import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { Deal } from './entities/deal.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { User } from '../users/entities/user.entity';
import { AgencyModule } from '../agency/agency.module';

@Module({
  imports: [TypeOrmModule.forFeature([Deal, Commission, User]), AgencyModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
