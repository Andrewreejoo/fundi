import './helpers';
import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import request from 'supertest';
import { api, createApp, login, resetDb } from './helpers';

/**
 * End-to-end: real HTTP, real PostgreSQL/PostGIS, simulated mobile money (fake driver).
 * Wallets ending in 1 fail, others succeed (mirrors PayChangu test numbers).
 */
describe('Fundi marketplace API', () => {
  let app: INestApplication;
  let customer: string;
  let provider: string;
  let admin: string;
  let providerId: string;
  let listingId: string;
  let area25: number;

  const ledgerBalanced = async () => {
    const rows = await api(app, admin).get('/admin/ledger').expect(200);
    const sum = rows.body.reduce((s: number, r: any) => s + Number(r.balance), 0);
    expect(sum).toBe(0);
    return Object.fromEntries(rows.body.map((r: any) => [r.account, Number(r.balance)]));
  };

  beforeAll(async () => {
    await resetDb();
    app = await createApp();
    customer = await login(app, '0991234567');
    provider = await login(app, '0881234567');
    admin = await login(app, '0999000001');
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves categories and places', async () => {
    const cats = await api(app).get('/categories').expect(200);
    expect(cats.body.map((c: any) => c.slug)).toContain('plumbing');
    const places = await api(app).get('/places?district=Lilongwe').expect(200);
    area25 = places.body.find((p: any) => p.name === 'Area 25').id;
    expect(area25).toBeTruthy();
  });

  describe('auth', () => {
    it('rejects non-Malawian or malformed numbers', async () => {
      await api(app).post('/auth/otp/request', { phone: '0712345678' }).expect(400);
    });
    it('rejects a wrong OTP and rate-limits requests', async () => {
      await api(app).post('/auth/otp/request', { phone: '0997777777' }).expect(200);
      await api(app).post('/auth/otp/verify', { phone: '0997777777', code: '000000' }).expect(401);
      await api(app).post('/auth/otp/request', { phone: '0997777777' }).expect(200);
      await api(app).post('/auth/otp/request', { phone: '0997777777' }).expect(200);
      await api(app).post('/auth/otp/request', { phone: '0997777777' }).expect(429);
    });
    it('sets a PIN and signs in with it; refresh rotates tokens', async () => {
      await api(app, customer).post('/auth/pin', { pin: '1111' }).expect(400); // too easy
      await api(app, customer).post('/auth/pin', { pin: '2580' }).expect(200);
      const res = await api(app).post('/auth/pin/login', { phone: '+265 99 123 4567', pin: '2580' }).expect(200);
      await api(app).post('/auth/pin/login', { phone: '0991234567', pin: '9999' }).expect(401);
      const r2 = await api(app).post('/auth/refresh', { refreshToken: res.body.refreshToken }).expect(200);
      await api(app).post('/auth/refresh', { refreshToken: res.body.refreshToken }).expect(401); // used once
      expect(r2.body.accessToken).toBeTruthy();
    });
    it('protects private endpoints and admin routes', async () => {
      await api(app).get('/me').expect(401);
      await api(app, customer).get('/admin/overview').expect(403);
      const me = await api(app, admin).get('/me').expect(200);
      expect(me.body.roles).toContain('admin');
    });
  });

  describe('provider onboarding and search', () => {
    it('registers a provider in Area 25', async () => {
      const res = await api(app, provider)
        .post('/providers', { displayName: 'Chikondi Phiri', trades: ['plumbing'], placeId: area25, landmark: 'Behind the market' })
        .expect(201);
      providerId = res.body.id;
      expect(res.body.verification_level).toBe('basic');
      expect(res.body.payout_operator).toBe('tnm');
    });

    it('re-issues roles: provider endpoints now work', async () => {
      await api(app, provider).get('/providers/me').expect(200);
      await api(app, customer).get('/providers/me').expect(403);
    });

    it('holds a basic provider listing for review, admin approves it', async () => {
      const l = await api(app, provider)
        .post('/providers/me/listings', { categorySlug: 'plumbing', title: 'Toilet fitting', priceType: 'fixed', priceMwk: 25000 })
        .expect(201);
      listingId = l.body.id;
      expect(l.body.status).toBe('pending');
      await api(app, provider).post('/providers/me/listings', { categorySlug: 'welding', title: 'Gates', priceType: 'quote' }).expect(400);
      const pending = await api(app, admin).get('/admin/listings').expect(200);
      expect(pending.body.some((x: any) => x.id === listingId)).toBe(true);
      await api(app, admin).post(`/admin/listings/${listingId}/approve`).expect(200);
    });

    it('finds the provider near Area 25 but not from Blantyre', async () => {
      const near = await api(app).get('/providers/search?category=plumbing&lat=-13.91&lng=33.79').expect(200);
      expect(near.body.results[0].id).toBe(providerId);
      expect(near.body.results[0].from_price_mwk).toBe(25000);
      expect(near.body.results[0]).not.toHaveProperty('payout_msisdn');
      const far = await api(app).get('/providers/search?category=plumbing&lat=-15.786&lng=35.005').expect(200);
      expect(far.body.results).toHaveLength(0);
      expect(far.body.radiusKm).toBe(50);
    });

    it('shows a public profile with live listings and no phone number', async () => {
      const p = await api(app).get(`/providers/${providerId}`).expect(200);
      expect(p.body.listings).toHaveLength(1);
      expect(JSON.stringify(p.body)).not.toContain('881234567');
    });
  });

  describe('instant booking with escrow', () => {
    let bookingId: string;

    it('customer books; phone stays masked until accepted', async () => {
      const b = await api(app, customer)
        .post('/bookings', { providerId, listingId, placeId: area25, landmark: 'Blue gate', timeSlot: 'afternoon', escrow: true })
        .expect(201);
      bookingId = b.body.id;
      expect(b.body.status).toBe('requested');
      expect(b.body.type).toBe('instant');
      expect(b.body.provider_phone).toMatch(/xxx/);
      await api(app, customer).post(`/bookings/${bookingId}/accept`).expect(403);
    });

    it('provider accepts; fees are fixed; customer cannot pay from a failing wallet', async () => {
      const a = await api(app, provider).post(`/bookings/${bookingId}/accept`).expect(200);
      expect(a.body.status).toBe('accepted');
      expect(a.body.protection_fee_mwk).toBe(500); // 2% of 25,000
      expect(a.body.commission_mwk).toBe(2000); // 8%
      expect(a.body.total_mwk).toBe(25500);
      const fail = await api(app, customer).post(`/bookings/${bookingId}/pay`, { phone: '0990000001' }).expect(200);
      expect(fail.body.status).toBe('failed');
      const d = await api(app, customer).get(`/bookings/${bookingId}`).expect(200);
      expect(d.body.status).toBe('accepted');
      expect(d.body.actions).toContain('pay');
    });

    it('customer pays; money sits in escrow', async () => {
      const ok = await api(app, customer).post(`/bookings/${bookingId}/pay`, { phone: '0990000000' }).expect(200);
      expect(ok.body.status).toBe('success');
      const d = await api(app, customer).get(`/bookings/${bookingId}`).expect(200);
      expect(d.body.status).toBe('paid');
      expect(d.body.provider_phone).toBe('+265881234567');
      const bal = await ledgerBalanced();
      expect(bal.escrow).toBe(-25000);
      expect(bal.fee_revenue).toBe(-500);
    });

    it('provider marks done, customer confirms, provider is paid net of commission', async () => {
      await api(app, provider).post(`/bookings/${bookingId}/complete`).expect(200);
      const c = await api(app, customer).post(`/bookings/${bookingId}/confirm`).expect(200);
      expect(c.body.status).toBe('confirmed');
      const payout = c.body.payments.find((p: any) => p.direction === 'payout');
      expect(payout).toBeUndefined(); // customers do not see provider payouts
      const pv = await api(app, provider).get(`/bookings/${bookingId}`).expect(200);
      expect(pv.body.payments.find((p: any) => p.direction === 'payout').amount_mwk).toBe(23000);
      expect(pv.body.payments.find((p: any) => p.direction === 'payout').status).toBe('success');
      const bal = await ledgerBalanced();
      expect(bal.escrow ?? 0).toBe(0);
      expect(bal.provider_payable ?? 0).toBe(0);
      expect(bal.fee_revenue).toBe(-2500); // 500 fee + 2000 commission
      expect(bal.cash).toBe(2500);
    });

    it('customer rates once; rating appears on the profile', async () => {
      await api(app, customer).post(`/bookings/${bookingId}/review`, { rating: 5, text: 'Came on time' }).expect(200);
      await api(app, customer).post(`/bookings/${bookingId}/review`, { rating: 1 }).expect(400);
      const p = await api(app).get(`/providers/${providerId}`).expect(200);
      expect(Number(p.body.rating)).toBe(5);
      expect(p.body.jobs_completed).toBe(1);
      expect(p.body.reviews[0].text).toBe('Came on time');
    });
  });

  describe('quote booking, dispute and split', () => {
    let bookingId: string;
    it('runs request -> quote -> accept -> pay -> done -> dispute -> split 60/40', async () => {
      const b = await api(app, customer)
        .post('/bookings', { providerId, categoryId: 1, description: 'Geyser leaking', lat: -13.906, lng: 33.791 })
        .expect(201);
      bookingId = b.body.id;
      expect(b.body.type).toBe('quote');
      await api(app, provider).post(`/bookings/${bookingId}/accept`).expect(400);
      await api(app, provider).post(`/bookings/${bookingId}/quote`, { priceMwk: 40000, note: 'Includes new valve' }).expect(200);
      await api(app, customer).post(`/bookings/${bookingId}/accept-quote`).expect(200);
      await api(app, customer).post(`/bookings/${bookingId}/pay`).expect(200);
      await api(app, provider).post(`/bookings/${bookingId}/start`).expect(200);
      await api(app, provider).post(`/bookings/${bookingId}/complete`).expect(200);
      await api(app, customer).post(`/bookings/${bookingId}/dispute`, { reason: 'Still leaking after one day' }).expect(200);
      await api(app, customer).post(`/bookings/${bookingId}/confirm`).expect(400);

      const open = await api(app, admin).get('/admin/disputes').expect(200);
      const d = open.body.find((x: any) => x.booking_id === bookingId);
      await api(app, admin).post(`/admin/disputes/${d.id}/resolve`, { resolution: 'split' }).expect(400);
      await api(app, admin).post(`/admin/disputes/${d.id}/resolve`, { resolution: 'split', providerSharePercent: 60, note: 'Partly fixed' }).expect(200);

      const after = await api(app, admin).get(`/bookings/${bookingId}`).expect(200);
      expect(after.body.status).toBe('confirmed');
      const payout = after.body.payments.find((p: any) => p.direction === 'payout');
      const refund = after.body.payments.find((p: any) => p.direction === 'refund');
      expect(payout.amount_mwk).toBe(24000 - 1920); // 60% of 40,000 less 60% of the 3,200 commission
      expect(refund.amount_mwk).toBe(16000);
      const bal = await ledgerBalanced();
      expect(bal.escrow ?? 0).toBe(0);
      expect(bal.customer_refundable ?? 0).toBe(0);
    });
  });

  describe('timers', () => {
    it('expires unanswered requests and cancels unpaid accepted bookings', async () => {
      const db = app.get((await import('../src/db/db.service')).DbService);
      const bookings = app.get((await import('../src/bookings/bookings.service')).BookingsService);
      const b1 = await api(app, customer).post('/bookings', { providerId, listingId, placeId: area25 }).expect(201);
      const b2 = await api(app, customer).post('/bookings', { providerId, listingId, placeId: area25 }).expect(201);
      await api(app, provider).post(`/bookings/${b2.body.id}/accept`).expect(200);
      await db.query(`UPDATE bookings SET expires_at = now() - interval '1 minute' WHERE id = ANY($1::uuid[])`, [[b1.body.id, b2.body.id]]);
      await bookings.sweep();
      expect((await api(app, customer).get(`/bookings/${b1.body.id}`)).body.status).toBe('expired');
      expect((await api(app, customer).get(`/bookings/${b2.body.id}`)).body.status).toBe('cancelled');
    });

    it('auto-confirms after the window and releases escrow', async () => {
      const db = app.get((await import('../src/db/db.service')).DbService);
      const bookings = app.get((await import('../src/bookings/bookings.service')).BookingsService);
      const b = await api(app, customer).post('/bookings', { providerId, listingId, placeId: area25 }).expect(201);
      await api(app, provider).post(`/bookings/${b.body.id}/accept`).expect(200);
      await api(app, customer).post(`/bookings/${b.body.id}/pay`).expect(200);
      await api(app, provider).post(`/bookings/${b.body.id}/complete`).expect(200);
      await db.query(`UPDATE bookings SET auto_confirm_at = now() - interval '1 minute' WHERE id=$1`, [b.body.id]);
      const r = await bookings.sweep();
      expect(r.autoConfirmed).toBe(1);
      expect((await api(app, customer).get(`/bookings/${b.body.id}`)).body.status).toBe('confirmed');
      await ledgerBalanced();
    });

    it('provider cancelling after payment refunds everything, including the fee', async () => {
      const b = await api(app, customer).post('/bookings', { providerId, listingId, placeId: area25 }).expect(201);
      await api(app, provider).post(`/bookings/${b.body.id}/accept`).expect(200);
      await api(app, customer).post(`/bookings/${b.body.id}/pay`).expect(200);
      await api(app, customer).post(`/bookings/${b.body.id}/cancel`).expect(400);
      const r = await api(app, provider).post(`/bookings/${b.body.id}/cancel`, { reason: 'Sick' }).expect(200);
      expect(r.body.status).toBe('refunded');
      const c = await api(app, customer).get(`/bookings/${b.body.id}`).expect(200);
      expect(c.body.payments.find((p: any) => p.direction === 'refund').amount_mwk).toBe(25500);
      await ledgerBalanced();
    });
  });

  describe('verification and trust', () => {
    it('provider uploads ID privately, admin approves, profile shows verified', async () => {
      const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
      const up = async () =>
        (await request(app.getHttpServer()).post('/uploads?private=true').set('Authorization', `Bearer ${provider}`)
          .attach('file', png, { filename: 'id.png', contentType: 'image/png' }).expect(201)).body.id;
      const idFile = await up();
      const selfie = await up();
      await request(app.getHttpServer()).get(`/files/${idFile}`).expect(403);
      await request(app.getHttpServer()).get(`/files/${idFile}`).set('Authorization', `Bearer ${admin}`).expect(200);
      await api(app, provider).post('/providers/me/verification', { idFileId: idFile, selfieFileId: selfie }).expect(201);
      const q = await api(app, admin).get('/admin/verifications').expect(200);
      await api(app, admin).post(`/admin/verifications/${q.body[0].id}/approve`).expect(200);
      const p = await api(app).get(`/providers/${providerId}`).expect(200);
      expect(p.body.verification_level).toBe('id_verified');
      // Verified providers' clean listings go live without review.
      const l = await api(app, provider).post('/providers/me/listings', { categorySlug: 'plumbing', title: 'Leak repair', priceType: 'fixed', priceMwk: 8000 }).expect(201);
      expect(l.body.status).toBe('live');
    });
  });

  describe('payments webhook', () => {
    it('rejects a webhook with a bad signature', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/paychangu')
        .set('Content-Type', 'application/json')
        .set('Signature', 'nope')
        .send(JSON.stringify({ charge_id: 'x', status: 'success' }))
        .expect(401);
    });
    it('PayChangu driver accepts a correctly signed body', async () => {
      const { PayChanguDriver } = await import('../src/payments/driver');
      const body = JSON.stringify({ event_type: 'api.charge.payment', data: { charge_id: 'FD-ABC-C1', status: 'success' } });
      const sig = createHmac('sha256', 'whsec_test').update(body).digest('hex');
      const evt = new PayChanguDriver().parseWebhook(body, sig);
      expect(evt).toMatchObject({ chargeId: 'FD-ABC-C1', kind: 'charge', status: 'success' });
      expect(new PayChanguDriver().parseWebhook(body, sig.replace(/.$/, '0'))).toBeNull();
    });
  });

  it('admin overview adds up', async () => {
    const o = await api(app, admin).get('/admin/overview').expect(200);
    expect(o.body.completed_jobs).toBeGreaterThanOrEqual(3);
    expect(o.body.escrow_held_mwk).toBe(0);
  });
});
