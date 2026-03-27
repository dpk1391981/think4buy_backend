import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { AuditLog } from './entities/audit-log.entity';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';

/**
 * @Global so RbacService (for permission checking) can be injected
 * anywhere without re-importing RbacModule.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, AuditLog])],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule {}
