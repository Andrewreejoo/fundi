import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Operator, toLocal } from '../common/phone';
import { config } from '../config';

export type DriverStatus = 'pending' | 'success' | 'failed';
export interface DriverResult {
  status: DriverStatus;
  providerRef?: string | null;
  failureReason?: string | null;
  raw?: unknown;
}
export interface MoneyRequest {
  chargeId: string;
  msisdn: string; // E.164
  operator: Operator;
  amountMwk: number;
  firstName?: string | null;
  lastName?: string | null;
}

export interface PaymentDriver {
  /** Ask the customer's wallet to pay (customer gets a PIN prompt on their phone). */
  charge(req: MoneyRequest): Promise<DriverResult>;
  /** Re-check a charge we started. */
  verifyCharge(chargeId: string): Promise<DriverResult>;
  /** Send money to a wallet (provider payout or customer refund). */
  payout(req: MoneyRequest): Promise<DriverResult>;
  /** Verify a webhook request. Returns the parsed event or null if the signature is wrong. */
  parseWebhook(rawBody: string, signature: string | undefined): { chargeId: string; kind: 'charge' | 'payout'; status: DriverStatus; raw: unknown } | null;
}

function mapStatus(s: unknown): DriverStatus {
  const v = String(s ?? '').toLowerCase();
  if (['success', 'successful', 'completed', 'paid'].includes(v)) return 'success';
  if (['failed', 'failure', 'cancelled', 'canceled', 'declined', 'reversed', 'expired'].includes(v)) return 'failed';
  return 'pending';
}

/**
 * PayChangu (https://developer.paychangu.com). Use TEST keys for the sandbox; test wallets:
 * Airtel 0990000000 succeeds, 0990000001 fails; TNM 0899817565 succeeds, 0899817566 fails.
 */
export class PayChanguDriver implements PaymentDriver {
  private readonly log = new Logger('PayChangu');
  private operators: Record<Operator, string> | null = null;

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
    if (!config.paychanguSecretKey) throw new Error('PAYCHANGU_SECRET_KEY is not set');
    const res = await fetch(`${config.paychanguBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.paychanguSecretKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      const msg = typeof json?.message === 'string' ? json.message : JSON.stringify(json?.message ?? json);
      const err = new Error(`PayChangu ${method} ${path} -> HTTP ${res.status}: ${msg}`);
      (err as any).httpStatus = res.status;
      (err as any).body = json;
      throw err;
    }
    return json;
  }

  /** Operator ref_ids come from GET /mobile-money; cached for the process lifetime. */
  private async operatorRef(op: Operator): Promise<string> {
    if (!this.operators) {
      const json = await this.request('GET', '/mobile-money');
      const map: Partial<Record<Operator, string>> = {};
      for (const o of json?.data ?? []) {
        const name = `${o.short_code ?? ''} ${o.name ?? ''}`.toLowerCase();
        if (name.includes('airtel')) map.airtel = o.ref_id;
        if (name.includes('tnm') || name.includes('mpamba')) map.tnm = o.ref_id;
      }
      if (!map.airtel || !map.tnm) throw new Error('Could not find Airtel and TNM operators at PayChangu');
      this.operators = map as Record<Operator, string>;
    }
    return this.operators[op];
  }

  private result(json: any): DriverResult {
    const d = json?.data ?? {};
    return {
      status: mapStatus(d.status ?? json?.status),
      providerRef: d.ref_id ?? d.trans_id ?? null,
      failureReason: mapStatus(d.status) === 'failed' ? String(json?.message ?? 'Payment failed') : null,
      raw: json,
    };
  }

  private async send(path: string, req: MoneyRequest): Promise<DriverResult> {
    if (!config.paychanguSecretKey) {
      return { status: 'failed', failureReason: 'Payments are not configured yet (PAYCHANGU_SECRET_KEY missing)' };
    }
    try {
      const json = await this.request('POST', path, {
        mobile: toLocal(req.msisdn),
        mobile_money_operator_ref_id: await this.operatorRef(req.operator),
        amount: String(req.amountMwk),
        charge_id: req.chargeId,
        ...(req.firstName ? { first_name: req.firstName } : {}),
        ...(req.lastName ? { last_name: req.lastName } : {}),
      });
      return this.result(json);
    } catch (e) {
      const status = (e as any).httpStatus;
      // 4xx = rejected request (bad number, insufficient funds...). 5xx/timeouts stay pending and are re-checked.
      if (status && status >= 400 && status < 500) {
        return { status: 'failed', failureReason: (e as Error).message, raw: (e as any).body };
      }
      this.log.warn((e as Error).message);
      return { status: 'pending', failureReason: (e as Error).message };
    }
  }

  charge(req: MoneyRequest) {
    return this.send('/mobile-money/payments/initialize', req);
  }

  async verifyCharge(chargeId: string): Promise<DriverResult> {
    try {
      return this.result(await this.request('GET', `/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`));
    } catch (e) {
      this.log.warn((e as Error).message);
      return { status: 'pending', failureReason: (e as Error).message };
    }
  }

  payout(req: MoneyRequest) {
    return this.send('/mobile-money/payouts/initialize', req);
  }

  parseWebhook(rawBody: string, signature: string | undefined) {
    if (!signature || !config.paychanguWebhookSecret) return null;
    const expected = createHmac('sha256', config.paychanguWebhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature.trim());
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const body = JSON.parse(rawBody);
    const d = body?.data ?? body;
    const event = String(body?.event_type ?? d?.event_type ?? '');
    const chargeId = String(d?.charge_id ?? body?.charge_id ?? d?.reference ?? '');
    if (!chargeId) return null;
    return {
      chargeId,
      kind: (event.includes('payout') ? 'payout' : 'charge') as 'charge' | 'payout',
      status: mapStatus(d?.status ?? body?.status),
      raw: body,
    };
  }
}

/**
 * Simulated driver for automated tests and offline demos. Mirrors PayChangu's test numbers:
 * a wallet number ending in 1 fails, everything else succeeds immediately.
 */
export class FakeDriver implements PaymentDriver {
  readonly calls: { kind: string; req: MoneyRequest }[] = [];
  private outcome(msisdn: string): DriverResult {
    return msisdn.endsWith('1')
      ? { status: 'failed', failureReason: 'Insufficient funds (simulated)' }
      : { status: 'success', providerRef: `FAKE-${Date.now()}` };
  }
  async charge(req: MoneyRequest) { this.calls.push({ kind: 'charge', req }); return this.outcome(req.msisdn); }
  async verifyCharge(): Promise<DriverResult> { return { status: 'success' }; }
  async payout(req: MoneyRequest) { this.calls.push({ kind: 'payout', req }); return this.outcome(req.msisdn); }
  parseWebhook(rawBody: string, signature: string | undefined) {
    if (signature !== 'fake-signature') return null;
    const b = JSON.parse(rawBody);
    return { chargeId: b.charge_id, kind: b.kind ?? 'charge', status: mapStatus(b.status), raw: b };
  }
}

export const PAYMENT_DRIVER = Symbol('PAYMENT_DRIVER');
export function createDriver(): PaymentDriver {
  return config.paymentsDriver === 'fake' ? new FakeDriver() : new PayChanguDriver();
}
