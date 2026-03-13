import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyController } from './agency.controller';
import { AgencyService } from './agency.service';
import { Agency } from './entities/agency.entity';
import { AgentProfile } from './entities/agent-profile.entity';
import { PropertyAgentMap } from './entities/property-agent-map.entity';
import { AgentLocationMap } from './entities/agent-location-map.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agency,
      AgentProfile,
      PropertyAgentMap,
      AgentLocationMap,
    ]),
  ],
  controllers: [AgencyController],
  providers: [AgencyService],
  exports: [AgencyService],
})
export class AgencyModule {}
