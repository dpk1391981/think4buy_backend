import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { Country } from '../locations/entities/country.entity';
import { WalletModule } from '../wallet/wallet.module';
import { LocationsModule } from '../locations/locations.module';
import { AgencyModule } from '../agency/agency.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadModule } from '../upload/upload.module';
import { AlertsModule } from '../alerts/alerts.module';
import { StorageConfigModule } from '../storage-config/storage-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Property, Inquiry, Country]),
    WalletModule,
    LocationsModule,
    AgencyModule,
    NotificationsModule,
    UploadModule,
    AlertsModule,
    StorageConfigModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
