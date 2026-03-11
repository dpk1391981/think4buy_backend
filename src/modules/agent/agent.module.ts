import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { Property } from '../properties/entities/property.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, Inquiry]),
    WalletModule,
  ],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
