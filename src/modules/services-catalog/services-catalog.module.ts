import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesCatalogController } from './services-catalog.controller';
import { ServicesCatalogService } from './services-catalog.service';
import { ServiceCatalog } from './entities/service-catalog.entity';
import { ServiceLead } from './entities/service-lead.entity';
import { ServiceLeadsService } from './service-leads.service';
import {
  ServiceLeadsController,
  AdminServiceLeadsController,
} from './service-leads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCatalog, ServiceLead])],
  controllers: [
    ServicesCatalogController,
    ServiceLeadsController,
    AdminServiceLeadsController,
  ],
  providers: [ServicesCatalogService, ServiceLeadsService],
  exports: [ServicesCatalogService, ServiceLeadsService],
})
export class ServicesCatalogModule {}
