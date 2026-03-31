import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { BotDetectionMiddleware } from './common/middleware/bot-detection.middleware';
import { RolesGuard } from './common/guards/roles.guard';
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
import { ListingFilterConfig } from './modules/property-config/entities/listing-filter-config.entity';
import { SearchKeywordMapping } from './modules/property-config/entities/search-keyword-mapping.entity';
import { User } from './modules/users/entities/user.entity';
import { OtpVerification } from './modules/auth/entities/otp-verification.entity';
import { Property } from './modules/properties/entities/property.entity';
import { PropertyImage } from './modules/properties/entities/property-image.entity';
import { PropertyView } from './modules/properties/entities/property-view.entity';
import { PropertyStatusHistory } from './modules/properties/entities/property-status-history.entity';
import { Amenity } from './modules/properties/entities/amenity.entity';
import { Location } from './modules/locations/entities/location.entity';
import { State } from './modules/locations/entities/state.entity';
import { City } from './modules/locations/entities/city.entity';
import { Country } from './modules/locations/entities/country.entity';
import { Inquiry } from './modules/inquiries/entities/inquiry.entity';
import { ServiceCatalog } from './modules/services-catalog/entities/service-catalog.entity';
import { ServiceLead } from './modules/services-catalog/entities/service-lead.entity';
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
import { MarketSnapshot } from './modules/analytics/entities/market-snapshot.entity';
import { LocalityCircleRate } from './modules/analytics/entities/locality-circle-rate.entity';
import { ScoringConfig } from './modules/analytics/entities/scoring-config.entity';
import { SeoModule } from './modules/seo/seo.module';
import { CityPage } from './modules/seo/entities/city-page.entity';
import { SeoConfig } from './modules/seo/entities/seo-config.entity';
import { FooterSeoLink, FooterSeoLinkGroup } from './modules/seo/entities/footer-seo-link.entity';
import { LocalitySeo } from './modules/seo/entities/locality-seo.entity';
import { CategoryCitySeo } from './modules/seo/entities/category-city-seo.entity';
import { CategoryLocalitySeo } from './modules/seo/entities/category-locality-seo.entity';
import { AgentCitySeo } from './modules/seo/entities/agent-city-seo.entity';
import { PropertyCitySeo } from './modules/seo/entities/property-city-seo.entity';
import { AgencyModule } from './modules/agency/agency.module';
import { Agency } from './modules/agency/entities/agency.entity';
import { AgentProfile } from './modules/agency/entities/agent-profile.entity';
import { PropertyAgentMap } from './modules/agency/entities/property-agent-map.entity';
import { AgentLocationMap } from './modules/agency/entities/agent-location-map.entity';
import { PremiumSlot } from './modules/agency/entities/premium-slot.entity';
import { LeadsModule } from './modules/leads/leads.module';
import { Lead } from './modules/leads/entities/lead.entity';
import { LeadAssignment } from './modules/leads/entities/lead-assignment.entity';
import { LeadActivityLog } from './modules/leads/entities/lead-activity-log.entity';
import { SiteVisitsModule } from './modules/site-visits/site-visits.module';
import { SiteVisit } from './modules/site-visits/entities/site-visit.entity';
import { DealsModule } from './modules/deals/deals.module';
import { Deal } from './modules/deals/entities/deal.entity';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { Commission } from './modules/commissions/entities/commission.entity';
import { ArticlesModule } from './modules/articles/articles.module';
import { Article } from './modules/articles/entities/article.entity';
import { MenusModule } from './modules/menus/menus.module';
import { Menu } from './modules/menus/entities/menu.entity';
import { RoleMenuPermission } from './modules/menus/entities/role-menu-permission.entity';
import { AgentFeedbackModule } from './modules/agent-feedback/agent-feedback.module';
import { AgentFeedback } from './modules/agent-feedback/entities/agent-feedback.entity';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { Notification } from './modules/notifications/entities/notification.entity';
import { MessagingModule } from './modules/messaging/messaging.module';
import { MessageService as MsgService } from './modules/messaging/entities/message-service.entity';
import { MessageTemplate } from './modules/messaging/entities/message-template.entity';
import { EventTemplateMapping } from './modules/messaging/entities/event-template-mapping.entity';
import { MessageLog } from './modules/messaging/entities/message-log.entity';
import { SmartSearchModule } from './modules/smart-search/smart-search.module';
import { SearchLog } from './modules/smart-search/entities/search-log.entity';
import { UserBehavior } from './modules/smart-search/entities/user-behavior.entity';
import { ToolsModule } from './modules/tools/tools.module';
import { StorageConfig } from './modules/storage-config/entities/storage-config.entity';
import { ConsentModule } from './modules/consent/consent.module';
import { CookieConsent } from './modules/consent/entities/cookie-consent.entity';
import { RbacModule } from './modules/rbac/rbac.module';
import { Role } from './modules/rbac/entities/role.entity';
import { Permission } from './modules/rbac/entities/permission.entity';
import { AuditLog } from './modules/rbac/entities/audit-log.entity';
import { PaymentModule } from './modules/payment/payment.module';
import { PaymentGateway } from './modules/payment/entities/payment-gateway.entity';
import { PaymentTransaction } from './modules/payment/entities/payment-transaction.entity';
import { PaymentLog } from './modules/payment/entities/payment-log.entity';
import { Refund } from './modules/payment/entities/refund.entity';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { SystemConfig } from './modules/system-config/entities/system-config.entity';
import { MediaProcessingModule } from './modules/media-processing/media-processing.module';
import { MediaJob } from './modules/media-processing/entities/media-job.entity';
import { SupportModule } from './modules/support/support.module';
import { SupportTicket } from './modules/support/entities/support-ticket.entity';
import { LocationImportModule } from './modules/location-import/location-import.module';
import { LocationImportJob } from './modules/location-import/entities/location-import-job.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global rate limiting: 100 req / 60s per IP by default
    // Individual endpoints can override with @Throttle({ default: { limit: X, ttl: Y } })
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    // Redis queue for async messaging (BullMQ)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host:     config.get('REDIS_HOST', 'localhost'),
          port:     config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
          db:       config.get<number>('REDIS_DB', 0),
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const replicaEnabled = config.get<string>('ENABLE_DB_REPLICA') === 'true';
        const replicaHost    = config.get('DB_REPLICA_HOST', '');

        const entities = [
          User, Property, PropertyImage, PropertyView, PropertyStatusHistory, Amenity,
          Location, State, City, Country, Inquiry,
          ServiceCatalog, ServiceLead, Wallet, WalletTransaction,
          SubscriptionPlan, BoostPlan, AgentSubscription, SavedProperty,
          PropertyAlert, PropCategory, PropType, PropTypeAmenity,
          PropTypeField, ListingFilterConfig, SearchKeywordMapping, AnalyticsEvent,
          TopPropertiesCache, TopAgentsCache, TopProjectsCache,
          TopLocationsCache, CategoryAnalytics, MarketSnapshot,
          LocalityCircleRate, ScoringConfig, CityPage, SeoConfig,
          FooterSeoLink, FooterSeoLinkGroup, LocalitySeo, CategoryCitySeo,
          CategoryLocalitySeo, AgentCitySeo, PropertyCitySeo, Agency, AgentProfile, PropertyAgentMap,
          AgentLocationMap, PremiumSlot, Lead, LeadAssignment,
          LeadActivityLog, SiteVisit, Deal, Commission, Article, Menu,
          RoleMenuPermission, AgentFeedback, Notification, OtpVerification,
          MsgService, MessageTemplate, EventTemplateMapping, MessageLog,
          SearchLog, UserBehavior, StorageConfig, CookieConsent,
          Role, Permission, AuditLog, PaymentGateway, PaymentTransaction,
          PaymentLog, Refund, SystemConfig, MediaJob, SupportTicket,
          LocationImportJob,
        ];

        const base: any = {
          type:        'mysql',
          database:    config.get('DB_NAME', 'realestate_db'),
          entities,
          synchronize: config.get('NODE_ENV') !== 'production',
          logging:     config.get('NODE_ENV') === 'development',
          charset:     'utf8mb4',
          // Connection pool sized for 1M DAU
          extra: {
            connectionLimit: replicaEnabled ? 10 : 25,
            waitForConnections: true,
            queueLimit: 0,
          },
        };

        if (replicaEnabled && replicaHost) {
          // Read/Write splitting: writes → master, reads → replica
          return {
            ...base,
            replication: {
              master: {
                host:     config.get('DB_HOST', 'localhost'),
                port:     config.get<number>('DB_PORT', 3306),
                username: config.get('DB_USERNAME', 'root'),
                password: config.get('DB_PASSWORD', 'password'),
                database: config.get('DB_NAME', 'realestate_db'),
              },
              slaves: [
                {
                  host:     replicaHost,
                  port:     config.get<number>('DB_REPLICA_PORT', 3306),
                  username: config.get('DB_REPLICA_USERNAME') || config.get('DB_USERNAME', 'root'),
                  password: config.get('DB_REPLICA_PASSWORD') || config.get('DB_PASSWORD', ''),
                  database: config.get('DB_NAME', 'realestate_db'),
                },
              ],
            },
          };
        }

        // Single-node mode (no replica)
        return {
          ...base,
          host:     config.get('DB_HOST', 'localhost'),
          port:     config.get<number>('DB_PORT', 3306),
          username: config.get('DB_USERNAME', 'root'),
          password: config.get('DB_PASSWORD', 'password'),
        };
      },
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
    SeoModule,
    AgencyModule,
    LeadsModule,
    SiteVisitsModule,
    DealsModule,
    CommissionsModule,
    ArticlesModule,
    MenusModule,
    AgentFeedbackModule,
    NotificationsModule,
    MessagingModule,
    SmartSearchModule,
    ToolsModule,
    ConsentModule,
    RbacModule,
    PaymentModule,
    SystemConfigModule,
    MediaProcessingModule,
    SupportModule,
    LocationImportModule,
  ],
  providers: [
    // Global rate limiting guard (full DI, required for @nestjs/throttler)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global role-based access control guard
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*');

    consumer
      .apply(BotDetectionMiddleware)
      .forRoutes('*');
  }
}
