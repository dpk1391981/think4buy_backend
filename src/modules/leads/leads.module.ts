import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadAssignmentEngineService } from './lead-assignment-engine.service';
import { Lead } from './entities/lead.entity';
import { LeadAssignment } from './entities/lead-assignment.entity';
import { LeadActivityLog } from './entities/lead-activity-log.entity';
import { PropertyAgentMap } from '../agency/entities/property-agent-map.entity';
import { AgentLocationMap } from '../agency/entities/agent-location-map.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lead,
      LeadAssignment,
      LeadActivityLog,
      PropertyAgentMap,
      AgentLocationMap,
      User,
    ]),
    NotificationsModule,
    MessagingModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadAssignmentEngineService],
  exports: [LeadsService],
})
export class LeadsModule {}
