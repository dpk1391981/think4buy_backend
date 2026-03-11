import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { Inquiry } from './entities/inquiry.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inquiry, Property, User])],
  controllers: [InquiriesController],
  providers: [InquiriesService],
})
export class InquiriesModule {}
