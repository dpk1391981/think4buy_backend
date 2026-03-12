import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { LocationsModule } from './modules/locations/locations.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { ServicesCatalogModule } from './modules/services-catalog/services-catalog.module';
import { MediaModule } from './modules/media/media.module';
import { AdminModule } from './modules/admin/admin.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AgentModule } from './modules/agent/agent.module';
import { SavedModule } from './modules/saved/saved.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { PropertyConfigModule } from './modules/property-config/property-config.module';
import { PropCategory } from './modules/property-config/entities/prop-category.entity';
import { PropType } from './modules/property-config/entities/prop-type.entity';
import { PropTypeAmenity } from './modules/property-config/entities/prop-type-amenity.entity';
import { PropTypeField } from './modules/property-config/entities/prop-type-field.entity';
import { User } from './modules/users/entities/user.entity';
import { Property } from './modules/properties/entities/property.entity';
import { PropertyImage } from './modules/properties/entities/property-image.entity';
import { Amenity } from './modules/properties/entities/amenity.entity';
import { Location } from './modules/locations/entities/location.entity';
import { State } from './modules/locations/entities/state.entity';
import { City } from './modules/locations/entities/city.entity';
import { Country } from './modules/locations/entities/country.entity';
import { Inquiry } from './modules/inquiries/entities/inquiry.entity';
import { ServiceCatalog } from './modules/services-catalog/entities/service-catalog.entity';
import { Wallet } from './modules/wallet/entities/wallet.entity';
import { WalletTransaction } from './modules/wallet/entities/wallet-transaction.entity';
import { SubscriptionPlan } from './modules/wallet/entities/subscription-plan.entity';
import { BoostPlan } from './modules/wallet/entities/boost-plan.entity';
import { AgentSubscription } from './modules/wallet/entities/agent-subscription.entity';
import { SavedProperty } from './modules/saved/entities/saved-property.entity';
import { PropertyAlert } from './modules/alerts/entities/property-alert.entity';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AnalyticsEvent } from './modules/analytics/entities/analytics-event.entity';
import { TopPropertiesCache } from './modules/analytics/entities/top-properties-cache.entity';
import { TopAgentsCache } from './modules/analytics/entities/top-agents-cache.entity';
import { TopProjectsCache } from './modules/analytics/entities/top-projects-cache.entity';
import { TopLocationsCache } from './modules/analytics/entities/top-locations-cache.entity';
import { CategoryAnalytics } from './modules/analytics/entities/category-analytics.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get('DB_USERNAME', 'root'),
        password: config.get('DB_PASSWORD', 'password'),
        database: config.get('DB_NAME', 'realestate_db'),
        entities: [
          User,
          Property,
          PropertyImage,
          Amenity,
          Location,
          State,
          City,
          Country,
          Inquiry,
          ServiceCatalog,
          Wallet,
          WalletTransaction,
          SubscriptionPlan,
          BoostPlan,
          AgentSubscription,
          SavedProperty,
          PropertyAlert,
          PropCategory,
          PropType,
          PropTypeAmenity,
          PropTypeField,
          AnalyticsEvent,
          TopPropertiesCache,
          TopAgentsCache,
          TopProjectsCache,
          TopLocationsCache,
          CategoryAnalytics,
        ],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
        charset: 'utf8mb4',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    PropertiesModule,
    LocationsModule,
    InquiriesModule,
    ServicesCatalogModule,
    MediaModule,
    AdminModule,
    WalletModule,
    AgentModule,
    SavedModule,
    AlertsModule,
    PropertyConfigModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
