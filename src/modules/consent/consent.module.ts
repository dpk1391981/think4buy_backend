import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CookieConsent } from './entities/cookie-consent.entity';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CookieConsent])],
  providers: [ConsentService],
  controllers: [ConsentController],
  exports: [ConsentService],
})
export class ConsentModule {}
