import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class RejectDto {
  @IsString() @Length(3, 300) reason: string;
}

export class ResolveDisputeDto {
  @IsIn(['release', 'refund', 'split']) resolution: 'release' | 'refund' | 'split';
  @ValidateIf((o) => o.resolution === 'split') @IsInt() @Min(1) @Max(99) providerSharePercent?: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class RolesDto {
  @IsIn(['agent', 'admin']) role: 'agent' | 'admin';
  @IsIn(['add', 'remove']) op: 'add' | 'remove';
}
