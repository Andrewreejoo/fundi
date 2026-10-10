import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { DisputeDto, PayDto, ReasonDto, RentDto, ReserveDto } from './orders.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Reserve a car for sale with a refundable deposit (then POST /orders/:id/pay). */
  @Post('vehicles/:id/reserve')
  reserve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReserveDto) {
    return this.orders.reserve(user, id, dto.note);
  }

  /** Book a rental car for dates; endDate is the return date. */
  @Post('vehicles/:id/rent')
  rent(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RentDto) {
    return this.orders.rent(user, id, dto.startDate.slice(0, 10), dto.endDate.slice(0, 10), dto.withDriver ?? false, dto.note);
  }

  /** ?as=buyer|seller  &scope=active|past|all */
  @Get('orders')
  list(@CurrentUser() user: AuthUser, @Query('as') as?: string, @Query('scope') scope?: string) {
    return this.orders.list(user, as === 'seller' ? 'seller' : 'buyer', scope === 'past' || scope === 'all' ? scope : 'active');
  }

  @Get('orders/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id, user);
  }

  @Post('orders/:id/pay') @HttpCode(200)
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayDto) {
    return this.orders.pay(id, user, dto.phone);
  }

  @Post('orders/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.orders.cancel(id, user, dto.reason);
  }

  @Roles('seller') @Post('orders/:id/handover') @HttpCode(200)
  handover(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.handover(id, user);
  }

  @Post('orders/:id/complete') @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.complete(id, user);
  }

  @Post('orders/:id/dispute') @HttpCode(200)
  dispute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DisputeDto) {
    return this.orders.dispute(id, user, dto.reason);
  }
}
