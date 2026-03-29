import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { CityPage } from './entities/city-page.entity';
import { SeoConfig } from './entities/seo-config.entity';
import { FooterSeoLink, FooterSeoLinkGroup } from './entities/footer-seo-link.entity';
import { LocalitySeo } from './entities/locality-seo.entity';
import { CategoryCitySeo } from './entities/category-city-seo.entity';
import { CategoryLocalitySeo } from './entities/category-locality-seo.entity';
import { AgentCitySeo } from './entities/agent-city-seo.entity';
import { PropCategory } from '../property-config/entities/prop-category.entity';
import { City } from '../locations/entities/city.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CityPage,
      SeoConfig,
      FooterSeoLink,
      FooterSeoLinkGroup,
      LocalitySeo,
      CategoryCitySeo,
      CategoryLocalitySeo,
      AgentCitySeo,
      PropCategory,
      City,
    ]),
  ],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
