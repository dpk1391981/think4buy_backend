import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Property } from '../properties/entities/property.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { WalletModule } from '../wallet/wallet.module';
import { AgencyModule } from '../agency/agency.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, Inquiry, User]),
    WalletModule,
    AgencyModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
