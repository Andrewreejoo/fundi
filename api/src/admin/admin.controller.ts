import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { PaymentsService } from '../payments/payments.service';
import { RejectDto, ResolveDisputeDto, RolesDto } from './admin.dto';
import { AdminService } from './admin.service';

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly payments: PaymentsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.admin.overview(Math.min(Math.max(Number(days) || 7, 1), 365));
  }

  @Get('verifications')
  verifications(@Query('status') status?: string) {
    return this.admin.verifications(status ?? 'pending');
  }
  @Post('verifications/:id/approve') @HttpCode(200)
  approveVerification(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.reviewVerification(id, u.id, true);
  }
  @Post('verifications/:id/reject') @HttpCode(200)
  rejectVerification(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.admin.reviewVerification(id, u.id, false, dto.reason);
  }

  @Get('listings')
  listings(@Query('status') status?: string) {
    return this.admin.listings(status ?? 'pending');
  }
  @Post('listings/:id/approve') @HttpCode(200)
  approveListing(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.reviewListing(id, u.id, true);
  }
  @Post('listings/:id/reject') @HttpCode(200)
  rejectListing(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.admin.reviewListing(id, u.id, false, dto.reason);
  }

  @Get('disputes')
  disputes(@Query('status') status?: string) {
    return this.admin.disputes(status ?? 'open');
  }
  @Post('disputes/:id/resolve') @HttpCode(200)
  resolve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDisputeDto) {
    return this.admin.resolveDispute(id, u.id, dto.resolution, dto.providerSharePercent, dto.note);
  }

  @Get('users')
  users(@Query('phone') phone?: string) {
    return this.admin.users(phone);
  }
  @Post('users/:id/suspend') @HttpCode(200)
  suspend(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setUserStatus(id, u.id, 'suspended');
  }
  @Post('users/:id/activate') @HttpCode(200)
  activate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.setUserStatus(id, u.id, 'active');
  }
  @Post('users/:id/roles') @HttpCode(200)
  roles(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RolesDto) {
    return this.admin.setRole(id, u.id, dto.role, dto.op);
  }

  @Get('bookings')
  bookings(@Query('status') status?: string) {
    return this.admin.bookings(status);
  }

  @Get('payments')
  paymentsList(@Query('status') status?: string) {
    return this.admin.paymentsList(status);
  }
  @Post('payments/:id/retry') @HttpCode(200)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.retry(id);
  }

  @Get('ledger')
  ledger() {
    return this.admin.ledgerBalances();
  }

  @Get('audit')
  audit() {
    return this.admin.audit();
  }
}
