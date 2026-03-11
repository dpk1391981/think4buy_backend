import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';
import { SavedProperty } from './entities/saved-property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavedProperty])],
  controllers: [SavedController],
  providers: [SavedService],
  exports: [SavedService],
})
export class SavedModule {}
