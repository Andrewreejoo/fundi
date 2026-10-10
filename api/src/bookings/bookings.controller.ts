import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { CreateBookingDto, DisputeDto, PayDto, QuoteDto, ReasonDto, ReplyDto, ReviewDto } from './bookings.dto';
import { BookingsService } from './bookings.service';

@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('bookings')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  /** ?as=customer|provider  &scope=active|past|all */
  @Get('bookings')
  list(@CurrentUser() user: AuthUser, @Query('as') as?: string, @Query('scope') scope?: string) {
    return this.bookings.list(
      user,
      as === 'provider' ? 'provider' : 'customer',
      scope === 'past' || scope === 'all' ? scope : 'active',
    );
  }

  @Get('bookings/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.detail(id, user);
  }

  @Roles('provider') @Post('bookings/:id/accept') @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.accept(id, user);
  }

  @Roles('provider') @Post('bookings/:id/quote') @HttpCode(200)
  quote(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QuoteDto) {
    return this.bookings.quote(id, user, dto);
  }

  @Roles('provider') @Post('bookings/:id/decline') @HttpCode(200)
  decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.bookings.decline(id, user, dto.reason);
  }

  @Roles('provider') @Post('bookings/:id/start') @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.start(id, user);
  }

  @Roles('provider') @Post('bookings/:id/complete') @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.complete(id, user);
  }

  @Post('bookings/:id/accept-quote') @HttpCode(200)
  acceptQuote(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.acceptQuote(id, user);
  }

  /** Starts a mobile money charge; poll GET /payments/:id for the result. */
  @Post('bookings/:id/pay') @HttpCode(200)
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayDto) {
    return this.bookings.pay(id, user, dto.phone);
  }

  @Post('bookings/:id/cancel') @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.bookings.cancel(id, user, dto.reason);
  }

  @Post('bookings/:id/confirm') @HttpCode(200)
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.confirm(id, user);
  }

  @Post('bookings/:id/dispute') @HttpCode(200)
  dispute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DisputeDto) {
    return this.bookings.dispute(id, user, dto.reason);
  }

  @Post('bookings/:id/review') @HttpCode(200)
  review(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto) {
    return this.bookings.review(id, user, dto.rating, dto.text);
  }

  @Roles('provider') @Post('reviews/:id/reply') @HttpCode(200)
  reply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) {
    return this.bookings.reply(id, user, dto.reply);
  }
}
