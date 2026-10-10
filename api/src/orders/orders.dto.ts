import { IsBoolean, IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class ReserveDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RentDto {
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsBoolean() withDriver?: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class PayDto {
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class DisputeDto {
  @IsString() @Length(5, 1000) reason: string;
}
