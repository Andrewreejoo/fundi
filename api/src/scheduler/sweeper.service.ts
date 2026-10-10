import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * Every minute: expire unpaid orders, end reservation holds (refund the deposit), auto-complete
 * handed-over sales and finished rentals (release escrow), and reconcile mobile money payments.
 * Idempotent and guarded by row locks, so several API instances can run it safely.
 */
@Injectable()
export class SweeperService {
  private readonly log = new Logger('Sweeper');
  private running = false;

  constructor(private readonly orders: OrdersService, private readonly payments: PaymentsService) {}

  @Interval(60_000)
  async tick() {
    if (this.running || process.env.DISABLE_SCHEDULER === 'true') return;
    this.running = true;
    try {
      const r = await this.orders.sweep();
      await this.payments.reconcile();
      if (r.expired || r.lapsed || r.completed) this.log.log(`expired=${r.expired} lapsed=${r.lapsed} completed=${r.completed}`);
    } catch (e) {
      this.log.error((e as Error).stack);
    } finally {
      this.running = false;
    }
  }
}
