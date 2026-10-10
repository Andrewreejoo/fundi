import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
import { BODY_SLUGS, FEATURE_SLUGS } from '../common/vehicle-constants';

const thisYear = new Date().getFullYear();

export class VehicleDto {
  @IsIn(['sale', 'rent']) purpose: 'sale' | 'rent';
  @IsInt() modelId: number;
  @IsOptional() @IsString() @MaxLength(60) variant?: string;
  @IsInt() @Min(1970) @Max(thisYear + 1) year: number;
  @IsOptional() @IsIn(BODY_SLUGS) bodyType?: string;
  @IsIn(['automatic', 'manual']) transmission: 'automatic' | 'manual';
  @IsIn(['petrol', 'diesel', 'hybrid', 'electric']) fuel: string;
  @IsOptional() @IsIn(['2wd', '4wd']) drive?: string;
  @IsOptional() @IsIn(['right', 'left']) steering?: string;
  @IsOptional() @IsInt() @Min(300) @Max(10000) engineCc?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000) mileageKm?: number;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsInt() @Min(1) @Max(70) seats?: number;
  @IsOptional() @IsInt() @Min(1) @Max(6) doors?: number;
  @IsOptional() @IsIn(['excellent', 'good', 'fair', 'needs_work']) condition?: string;
  @IsOptional() @IsString() @MaxLength(12) plate?: string;
  @IsOptional() @IsBoolean() registered?: boolean;
  @IsOptional() @IsBoolean() dutyPaid?: boolean;
  @IsOptional() @IsDateString() cofExpiry?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsIn(FEATURE_SLUGS, { each: true }) features?: string[];
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) photoIds?: string[];
  // sale
  @IsOptional() @IsInt() @Min(10_000) @Max(5_000_000_000) priceMwk?: number;
  @IsOptional() @IsBoolean() negotiable?: boolean;
  // rent
  @IsOptional() @IsInt() @Min(1_000) @Max(50_000_000) dailyRateMwk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) driverRateMwk?: number;
  @IsOptional() @IsBoolean() selfDrive?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(60) minDays?: number;
  // where the car is (defaults to the seller's location)
  @IsOptional() @IsInt() placeId?: number;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
}

export class UpdateVehicleDto {
  @IsOptional() @IsInt() modelId?: number;
  @IsOptional() @IsString() @MaxLength(60) variant?: string;
  @IsOptional() @IsInt() @Min(1970) @Max(thisYear + 1) year?: number;
  @IsOptional() @IsIn(BODY_SLUGS) bodyType?: string;
  @IsOptional() @IsIn(['automatic', 'manual']) transmission?: string;
  @IsOptional() @IsIn(['petrol', 'diesel', 'hybrid', 'electric']) fuel?: string;
  @IsOptional() @IsIn(['2wd', '4wd']) drive?: string;
  @IsOptional() @IsIn(['right', 'left']) steering?: string;
  @IsOptional() @IsInt() @Min(300) @Max(10000) engineCc?: number;
  @IsOptional() @IsInt() @Min(0) @Max(2_000_000) mileageKm?: number;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsInt() @Min(1) @Max(70) seats?: number;
  @IsOptional() @IsInt() @Min(1) @Max(6) doors?: number;
  @IsOptional() @IsIn(['excellent', 'good', 'fair', 'needs_work']) condition?: string;
  @IsOptional() @IsString() @MaxLength(12) plate?: string;
  @IsOptional() @IsBoolean() registered?: boolean;
  @IsOptional() @IsBoolean() dutyPaid?: boolean;
  @IsOptional() @IsDateString() cofExpiry?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsIn(FEATURE_SLUGS, { each: true }) features?: string[];
  @IsOptional() @IsString() @MaxLength(3000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) photoIds?: string[];
  @IsOptional() @IsInt() @Min(10_000) @Max(5_000_000_000) priceMwk?: number;
  @IsOptional() @IsBoolean() negotiable?: boolean;
  @IsOptional() @IsInt() @Min(1_000) @Max(50_000_000) dailyRateMwk?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) driverRateMwk?: number;
  @IsOptional() @IsBoolean() selfDrive?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(60) minDays?: number;
  @IsOptional() @IsInt() placeId?: number;
}

export class VehicleStatusDto {
  @IsIn(['pause', 'resume', 'sold']) action: 'pause' | 'resume' | 'sold';
}

const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value;

export class SearchDto {
  @IsOptional() @IsIn(['sale', 'rent']) purpose?: 'sale' | 'rent';
  @IsOptional() @IsString() @MaxLength(40) make?: string;
  @IsOptional() @IsString() @MaxLength(40) model?: string;
  @IsOptional() @Transform(csv) @IsArray() @IsIn(BODY_SLUGS, { each: true }) body?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1970) minYear?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Max(2100) maxYear?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxMileage?: number;
  @IsOptional() @IsIn(['automatic', 'manual']) transmission?: string;
  @IsOptional() @IsIn(['petrol', 'diesel', 'hybrid', 'electric']) fuel?: string;
  @IsOptional() @IsIn(['2wd', '4wd']) drive?: string;
  @IsOptional() @IsString() @MaxLength(40) district?: string;
  @IsOptional() @IsIn(['dealer', 'private']) sellerKind?: string;
  @IsOptional() @IsUUID() seller?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(70) minSeats?: number;
  @IsOptional() @IsIn(['true', 'false']) withDriver?: string;
  @IsOptional() @IsIn(['true', 'false']) priceDown?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @Transform(csv) @IsArray() @ArrayMaxSize(4) @IsUUID('all', { each: true }) ids?: string[];
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc', 'year_desc', 'mileage_asc', 'popular']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) perPage?: number;
}

export class AvailabilityDto {
  @IsOptional() @IsDateString() from?: string;
}

export class InquiryDto {
  @IsString() @Length(2, 2000) body: string;
}
