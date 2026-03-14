import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { CityPage } from './entities/city-page.entity';
import { SeoConfig } from './entities/seo-config.entity';
import { FooterSeoLink, FooterSeoLinkGroup } from './entities/footer-seo-link.entity';
import { PropCategory } from '../property-config/entities/prop-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CityPage, SeoConfig, FooterSeoLink, FooterSeoLinkGroup, PropCategory])],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
