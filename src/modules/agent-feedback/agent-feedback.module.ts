import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentFeedback } from './entities/agent-feedback.entity';
import { AgentFeedbackService } from './agent-feedback.service';
import { AgentFeedbackController } from './agent-feedback.controller';
import { User } from '../users/entities/user.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgentFeedback, User, AnalyticsEvent])],
  controllers: [AgentFeedbackController],
  providers: [AgentFeedbackService],
  exports: [AgentFeedbackService],
})
export class AgentFeedbackModule {}
