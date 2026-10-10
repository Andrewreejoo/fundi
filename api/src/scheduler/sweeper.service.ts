import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AdminService } from '../admin/admin.service';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * Runs every minute: expires unanswered requests, cancels unpaid bookings, auto-confirms finished jobs
 * after the confirmation window (releasing escrow), reconciles payments, and purges old ID images.
 * All work is idempotent and guarded by row locks, so running several API instances is safe.
 */
@Injectable()
export class SweeperService {
  private readonly log = new Logger('Sweeper');
  private running = false;

  constructor(
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly admin: AdminService,
  ) {}

  @Interval(60_000)
  async tick() {
    if (this.running || process.env.DISABLE_SCHEDULER === 'true') return;
    this.running = true;
    try {
      const r = await this.bookings.sweep();
      await this.payments.reconcile();
      const purged = new Date().getMinutes() === 0 ? await this.admin.purgeIdImages() : 0;
      if (r.expired || r.autoConfirmed || purged) this.log.log(`expired=${r.expired} autoConfirmed=${r.autoConfirmed} purged=${purged}`);
    } catch (e) {
      this.log.error((e as Error).stack);
    } finally {
      this.running = false;
    }
  }
}
