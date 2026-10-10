import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @IsString() @MaxLength(20) phone: string;
}

export class VerifyOtpDto {
  @IsString() @MaxLength(20) phone: string;
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' }) code: string;
}

export class PinLoginDto {
  @IsString() @MaxLength(20) phone: string;
  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' }) pin: string;
}

export class SetPinDto {
  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' }) pin: string;
}

export class RefreshDto {
  @IsString() @Length(20, 200) refreshToken: string;
}

export class UpdateMeDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
}
