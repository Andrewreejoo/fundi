import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DbService, Queryable } from '../db/db.service';

export type Account = 'cash' | 'escrow' | 'provider_payable' | 'customer_refundable' | 'fee_revenue';
export interface Entry { account: Account; amount: number } // + debit, - credit

/**
 * Double-entry ledger. Every posting's entries must sum to zero, or nothing is written.
 *   collect:  cash +total, escrow -job, fee_revenue -protectionFee
 *   release:  escrow +job, provider_payable -net, fee_revenue -commission, customer_refundable -refundPart
 *   payout:   provider_payable +net, cash -net
 *   refund:   customer_refundable +x, cash -x
 */
@Injectable()
export class LedgerService {
  constructor(private readonly db: DbService) {}

  async post(client: Queryable, bookingId: string, memo: string, entries: Entry[]) {
    const lines = entries.filter((e) => e.amount !== 0);
    const sum = lines.reduce((s, e) => s + e.amount, 0);
    if (sum !== 0) throw new Error(`Unbalanced ledger posting "${memo}": sums to ${sum}`);
    if (!lines.length) return null;
    const txnId = randomUUID();
    for (const e of lines) {
      await this.db.query(
        `INSERT INTO ledger_entries (txn_id, booking_id, account, amount_mwk, memo) VALUES ($1,$2,$3,$4,$5)`,
        [txnId, bookingId, e.account, e.amount, memo],
        client,
      );
    }
    return txnId;
  }

  async balances(bookingId?: string) {
    return this.db.query(
      `SELECT account, sum(amount_mwk)::bigint AS balance FROM ledger_entries
        WHERE ($1::uuid IS NULL OR booking_id = $1) GROUP BY account ORDER BY account`,
      [bookingId ?? null],
    );
  }
}
