import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth';
import { SearchDto, UpdateVehicleDto, VehicleDto, VehicleStatusDto } from './vehicles.dto';
import { VehiclesService } from './vehicles.service';

@Controller()
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  /** Stock list with filters, sort, pagination and facet counts. ?purpose=sale|rent */
  @Public() @Get('vehicles')
  search(@Query() q: SearchDto) {
    return this.vehicles.search(q);
  }

  /** By id or stock number, e.g. /vehicles/GM10023 */
  @Public() @Get('vehicles/:idOrStock')
  detail(@Param('idOrStock') id: string, @CurrentUser() user?: AuthUser) {
    return this.vehicles.detail(id, user);
  }

  @Roles('seller') @Post('vehicles')
  create(@CurrentUser() user: AuthUser, @Body() dto: VehicleDto) {
    return this.vehicles.create(user.id, dto);
  }

  @Roles('seller') @Patch('vehicles/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(user.id, id, dto);
  }

  @Roles('seller') @Post('vehicles/:id/status') @HttpCode(200)
  status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VehicleStatusDto) {
    return this.vehicles.setStatus(user.id, id, dto.action);
  }

  @Roles('seller') @Get('sellers/me/vehicles')
  mine(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.vehicles.mine(user.id, status);
  }

  @Get('me/favorites')
  favorites(@CurrentUser() user: AuthUser) {
    return this.vehicles.favorites(user.id);
  }

  @Put('me/favorites/:vehicleId')
  addFavorite(@CurrentUser() user: AuthUser, @Param('vehicleId', ParseUUIDPipe) id: string) {
    return this.vehicles.favorite(user.id, id, true);
  }

  @Delete('me/favorites/:vehicleId')
  removeFavorite(@CurrentUser() user: AuthUser, @Param('vehicleId', ParseUUIDPipe) id: string) {
    return this.vehicles.favorite(user.id, id, false);
  }
}
