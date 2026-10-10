import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LocationDto } from '../providers/providers.dto';

export class CreateBookingDto extends LocationDto {
  @IsUUID() providerId: string;
  /** A listing to book. Fixed-price listings book instantly; others become quote requests. */
  @IsOptional() @IsUUID() listingId?: string;
  /** Required for a quote request without a listing. */
  @IsOptional() @IsInt() categoryId?: number;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsUUID('all', { each: true }) photoIds?: string[];
  @IsOptional() @IsDateString() scheduledFor?: string;
  @IsOptional() @IsIn(['morning', 'afternoon', 'evening']) timeSlot?: 'morning' | 'afternoon' | 'evening';
  /** Hold the money in escrow. Defaults on at or above ESCROW_DEFAULT_MIN_MWK. */
  @IsOptional() @IsBoolean() escrow?: boolean;
  @IsOptional() @IsIn(['app', 'web']) channel?: 'app' | 'web';
}

export class QuoteDto {
  @IsInt() @Min(100) @Max(50_000_000) priceMwk: number;
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}

export class PayDto {
  /** Wallet number to charge; defaults to the customer's own number. */
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(400) reason?: string;
}

export class DisputeDto {
  @IsString() @Length(5, 1000) reason: string;
}

export class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

export class ReplyDto {
  @IsString() @Length(2, 600) reply: string;
}
