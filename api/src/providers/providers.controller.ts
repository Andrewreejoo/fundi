import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth';
import { BecomeProviderDto, ListingDto, SearchDto, UpdateListingDto, UpdateProviderDto, VerificationDto } from './providers.dto';
import { ProvidersService } from './providers.service';

class PointQuery {
  @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
}

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Public() @Get('search')
  search(@Query() q: SearchDto) {
    return this.providers.search(q);
  }

  @Post()
  become(@CurrentUser() user: AuthUser, @Body() dto: BecomeProviderDto) {
    return this.providers.become(user, dto);
  }

  @Roles('provider') @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.providers.mine(user.id);
  }

  @Roles('provider') @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProviderDto) {
    return this.providers.update(user.id, dto);
  }

  @Roles('provider') @Post('me/listings')
  createListing(@CurrentUser() user: AuthUser, @Body() dto: ListingDto) {
    return this.providers.createListing(user.id, dto);
  }

  @Roles('provider') @Patch('me/listings/:id')
  updateListing(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    return this.providers.updateListing(user.id, id, dto);
  }

  @Roles('provider') @Post('me/verification')
  verification(@CurrentUser() user: AuthUser, @Body() dto: VerificationDto) {
    return this.providers.requestVerification(user.id, dto);
  }

  @Public() @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Query() q: PointQuery) {
    return this.providers.publicProfile(id, q.lat, q.lng);
  }
}
