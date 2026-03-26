import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyController } from './agency.controller';
import { AgencyService } from './agency.service';
import { BrokerTransparencyService } from './broker-transparency.service';
import { Agency } from './entities/agency.entity';
import { AgentProfile } from './entities/agent-profile.entity';
import { PropertyAgentMap } from './entities/property-agent-map.entity';
import { AgentLocationMap } from './entities/agent-location-map.entity';
import { PremiumSlot } from './entities/premium-slot.entity';
import { AgentFeedback } from '../agent-feedback/entities/agent-feedback.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agency,
      AgentProfile,
      PropertyAgentMap,
      AgentLocationMap,
      PremiumSlot,
      AgentFeedback,
    ]),
  ],
  controllers: [AgencyController],
  providers: [AgencyService, BrokerTransparencyService],
  exports: [AgencyService, BrokerTransparencyService],
})
export class AgencyModule {}
