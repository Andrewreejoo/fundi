import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth';
import { SellerDto, UpdateSellerDto } from './sellers.dto';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Post()
  become(@CurrentUser() user: AuthUser, @Body() dto: SellerDto) {
    return this.sellers.become(user, dto);
  }

  @Roles('seller') @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.sellers.mine(user.id);
  }

  @Roles('seller') @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSellerDto) {
    return this.sellers.update(user.id, dto);
  }

  @Public() @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sellers.publicProfile(id);
  }
}
