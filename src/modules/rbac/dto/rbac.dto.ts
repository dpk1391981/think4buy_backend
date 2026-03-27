import {
  IsString, IsOptional, IsBoolean, IsInt,
  IsArray, IsUUID, IsIn, Min, Max, MinLength, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Role DTOs ────────────────────────────────────────────────────────────────

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(60)
  name: string;

  @IsString() @MinLength(2) @MaxLength(100)
  displayName: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsInt() @Min(0) @Max(99)
  level?: number;
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  displayName?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(99)
  level?: number;
}

export class SetRolePermissionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}

// ── Permission DTOs ──────────────────────────────────────────────────────────

export class CreatePermissionDto {
  @IsString() @MinLength(3) @MaxLength(120)
  key: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name: string;

  @IsString() @MinLength(2) @MaxLength(60)
  module: string;

  @IsOptional() @IsString()
  description?: string;
}

export class UpdatePermissionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── User-Role DTOs ───────────────────────────────────────────────────────────

export class AssignUserRoleDto {
  @IsUUID('4')
  roleId: string;
}

// ── Audit Log Query ──────────────────────────────────────────────────────────

export class AuditLogQueryDto {
  @IsOptional() @IsString()
  actorId?: string;

  @IsOptional() @IsString()
  action?: string;

  @IsOptional() @IsString()
  resource?: string;

  @IsOptional() @IsString()
  resourceId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;
}
