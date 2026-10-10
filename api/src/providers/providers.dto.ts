import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LocationDto {
  /** Either a place from GET /places ... */
  @IsOptional() @IsInt() placeId?: number;
  /** ... or a GPS point. */
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsString() @MaxLength(60) district?: string;
  @IsOptional() @IsString() @MaxLength(60) area?: string;
  @IsOptional() @IsString() @MaxLength(160) landmark?: string;
}

export class BecomeProviderDto extends LocationDto {
  @IsString() @Length(2, 60) displayName: string;
  /** Category slugs or ids. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) trades: (string | number)[];
  @IsOptional() @IsString() @MaxLength(20) payoutPhone?: string;
  @IsOptional() @IsString() @MaxLength(600) bio?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) yearsExperience?: number;
  @IsOptional() @IsBoolean() homeVisits?: boolean;
  @IsOptional() @IsString() @MaxLength(80) workHours?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) serviceRadiusKm?: number;
  @IsOptional() @IsUUID() avatarFileId?: string;
  /** Set by field agents registering someone else. */
  @IsOptional() @IsString() @MaxLength(20) forPhone?: string;
}

export class UpdateProviderDto extends LocationDto {
  @IsOptional() @IsString() @Length(2, 60) displayName?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) trades?: (string | number)[];
  @IsOptional() @IsString() @MaxLength(20) payoutPhone?: string;
  @IsOptional() @IsString() @MaxLength(600) bio?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) yearsExperience?: number;
  @IsOptional() @IsBoolean() homeVisits?: boolean;
  @IsOptional() @IsBoolean() availableToday?: boolean;
  @IsOptional() @IsString() @MaxLength(80) workHours?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) serviceRadiusKm?: number;
  @IsOptional() @IsUUID() avatarFileId?: string;
  @IsOptional() @IsIn(['active', 'paused']) status?: 'active' | 'paused';
}

export class ListingDto {
  @IsOptional() @IsInt() categoryId?: number;
  @IsOptional() @IsString() categorySlug?: string;
  @IsString() @Length(3, 80) title: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsIn(['fixed', 'from', 'quote']) priceType: 'fixed' | 'from' | 'quote';
  @IsOptional() @IsInt() @Min(100) @Max(50_000_000) priceMwk?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsUUID('all', { each: true }) photoIds?: string[];
}

export class UpdateListingDto {
  @IsOptional() @IsString() @Length(3, 80) title?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsIn(['fixed', 'from', 'quote']) priceType?: 'fixed' | 'from' | 'quote';
  @IsOptional() @IsInt() @Min(100) @Max(50_000_000) priceMwk?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsUUID('all', { each: true }) photoIds?: string[];
  @IsOptional() @IsIn(['live', 'paused']) status?: 'live' | 'paused';
}

export class VerificationDto {
  @IsUUID() idFileId: string;
  @IsUUID() selfieFileId: string;
}

export class SearchDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @IsOptional() @Type(() => Number) @IsInt() placeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) radiusKm?: number;
  @IsOptional() @IsIn(['true', 'false']) verifiedOnly?: string;
  @IsOptional() @IsIn(['true', 'false']) availableToday?: string;
  @IsOptional() @IsIn(['true', 'false']) homeVisit?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}
