import { Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Clients poll this after starting a payment, until status leaves "pending". */
  @Get('payments/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.get(id, user.roles.includes('admin') ? undefined : user.id);
  }

  /** Register https://<api>/webhooks/paychangu in the PayChangu dashboard (Settings > API & Webhooks). */
  @Public() @Post('webhooks/paychangu') @HttpCode(200)
  webhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('signature') signature?: string) {
    const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body ?? {});
    return this.payments.handleWebhook(raw, signature);
  }
}
