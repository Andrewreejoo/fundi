import { IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class SellerDto {
  @IsIn(['dealer', 'private']) kind: 'dealer' | 'private';
  /** Yard / company name for dealers, the person's name for private sellers. */
  @IsString() @Length(2, 80) name: string;
  @IsOptional() @IsInt() placeId?: number;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsString() @MaxLength(160) address?: string;
  @IsOptional() @IsString() @MaxLength(20) payoutPhone?: string;
  @IsOptional() @IsString() @MaxLength(800) about?: string;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
}

export class UpdateSellerDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsInt() placeId?: number;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lng?: number;
  @IsOptional() @IsString() @MaxLength(160) address?: string;
  @IsOptional() @IsString() @MaxLength(20) payoutPhone?: string;
  @IsOptional() @IsString() @MaxLength(800) about?: string;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
}
