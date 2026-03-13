import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { LeadAssignment } from './entities/lead-assignment.entity';
import { LeadActivityLog } from './entities/lead-activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, LeadAssignment, LeadActivityLog])],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
