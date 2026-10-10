import './helpers';
import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import request from 'supertest';
import { api, createApp, login, resetDb } from './helpers';

/**
 * End-to-end: real HTTP, real PostgreSQL/PostGIS, simulated mobile money (fake driver: wallets ending in 1 fail).
 */
describe('GalimotoYanga car marketplace API', () => {
  let app: INestApplication;
  let dealer: string;   // unverified dealer, becomes verified later
  let owner: string;    // rental owner (verified by admin)
  let buyer: string;
  let buyer2: string;
  let admin: string;
  let area47: number;
  let limbe: number;
  let xtrail: number;
  let voxy: number;
  let saleCar: { id: string; stock_no: string };
  let rentCar: { id: string; stock_no: string };

  const iso = (daysFromNow: number) => new Date(Date.now() + 2 * 3600_000 + daysFromNow * 86_400_000).toISOString().slice(0, 10);
  const db = async () => app.get((await import('../src/db/db.service')).DbService);
  const ledgerBalanced = async () => {
    const rows = await api(app, admin).get('/admin/ledger').expect(200);
    expect(rows.body.reduce((s: number, r: any) => s + Number(r.balance), 0)).toBe(0);
    return Object.fromEntries(rows.body.map((r: any) => [r.account, Number(r.balance)]));
  };

  beforeAll(async () => {
    await resetDb();
    app = await createApp();
    [dealer, owner, buyer, buyer2, admin] = await Promise.all([
      login(app, '0881000005'), login(app, '0881000002'), login(app, '0991000003'), login(app, '0991000004'), login(app, '0999000001'),
    ]);
  });
  afterAll(async () => app.close());

  it('serves makes, models, places and settings', async () => {
    const makes = await api(app).get('/makes').expect(200);
    expect(makes.body.map((m: any) => m.slug)).toEqual(expect.arrayContaining(['toyota', 'nissan']));
    const nissan = await api(app).get('/models?make=nissan').expect(200);
    xtrail = nissan.body.find((m: any) => m.slug === 'x-trail').id;
    expect(nissan.body.find((m: any) => m.slug === 'x-trail').body_type).toBe('suv');
    voxy = (await api(app).get('/models?make=toyota').expect(200)).body.find((m: any) => m.slug === 'voxy').id;
    const places = await api(app).get('/places').expect(200);
    area47 = places.body.find((p: any) => p.name === 'Area 47').id;
    limbe = places.body.find((p: any) => p.name === 'Limbe').id;
    const cfg = await api(app).get('/config').expect(200);
    expect(cfg.body.bodyTypes.length).toBeGreaterThan(5);
    expect(cfg.body.depositPercent).toBe(5);
  });

  describe('sellers and listings', () => {
    it('requires a seller account to list', async () => {
      await api(app, dealer).post('/vehicles', { purpose: 'sale', modelId: xtrail, year: 2015, transmission: 'automatic', fuel: 'petrol', priceMwk: 32_000_000 }).expect(403);
    });

    it('creates a dealer and a rental owner', async () => {
      const d = await api(app, dealer).post('/sellers', { kind: 'dealer', name: 'Area 47 Car Yard', placeId: area47, address: 'Sector 4' }).expect(201);
      expect(d.body.verified).toBe(false);
      expect(d.body.payout_operator).toBe('tnm');
      await api(app, dealer).post('/sellers', { kind: 'dealer', name: 'Again', placeId: area47 }).expect(400);
      await api(app, owner).post('/sellers', { kind: 'dealer', name: 'Lake Road Car Hire', placeId: limbe }).expect(201);
      const me = await api(app, dealer).get('/me').expect(200);
      expect(me.body.is_seller).toBe(true);
      expect(me.body.roles).toContain('seller');
    });

    it('validates purpose-specific fields', async () => {
      await api(app, dealer).post('/vehicles', { purpose: 'sale', modelId: xtrail, year: 2015, transmission: 'automatic', fuel: 'petrol' }).expect(400);
      await api(app, owner).post('/vehicles', { purpose: 'rent', modelId: voxy, year: 2010, transmission: 'automatic', fuel: 'petrol', dailyRateMwk: 110_000, selfDrive: false }).expect(400);
      await api(app, dealer).post('/vehicles', { purpose: 'sale', modelId: xtrail, year: 2015, transmission: 'automatic', fuel: 'petrol', priceMwk: 32_000_000, features: ['jetpack'] }).expect(400);
    });

    it("holds an unverified seller's car for review; admin approves it", async () => {
      const v = await api(app, dealer).post('/vehicles', {
        purpose: 'sale', modelId: xtrail, variant: '20X', year: 2015, transmission: 'automatic', fuel: 'petrol', drive: '4wd',
        mileageKm: 86000, color: 'Silver', plate: 'bz 21851', priceMwk: 32_000_000, features: ['air_conditioning', 'reverse_camera'],
      }).expect(201);
      saleCar = v.body;
      expect(v.body.status).toBe('pending');
      expect(v.body.stock_no).toMatch(/^GM\d+$/);
      expect((await api(app).get('/vehicles').expect(200)).body.total).toBe(0);
      await api(app).get(`/vehicles/${saleCar.stock_no}`).expect(404); // hidden until approved
      const q = await api(app, admin).get('/admin/listings').expect(200);
      expect(q.body.map((x: any) => x.id)).toContain(saleCar.id);
      await api(app, admin).post(`/admin/listings/${saleCar.id}/approve`).expect(200);
    });

    it('verifying a seller publishes their new cars immediately', async () => {
      const s = await api(app, admin).get('/admin/sellers').expect(200);
      const ownerId = s.body.find((x: any) => x.name === 'Lake Road Car Hire').id;
      await api(app, admin).post(`/admin/sellers/${ownerId}/verify`, { on: true }).expect(200);
      const r = await api(app, owner).post('/vehicles', {
        purpose: 'rent', modelId: voxy, year: 2010, transmission: 'automatic', fuel: 'petrol', seats: 8, color: 'Silver',
        dailyRateMwk: 110_000, driverRateMwk: 30_000, selfDrive: true, minDays: 2,
      }).expect(201);
      rentCar = r.body;
      expect(r.body.status).toBe('live');
    });

    it('searches by make, body, price, purpose and keyword; shows facets', async () => {
      const all = await api(app).get('/vehicles').expect(200);
      expect(all.body.total).toBe(1);
      expect(all.body.results[0].make).toBe('Nissan');
      expect(all.body.results[0]).not.toHaveProperty('seller_phone');
      expect((await api(app).get('/vehicles?make=toyota')).body.total).toBe(0);
      expect((await api(app).get('/vehicles?body=suv,pickup&maxPrice=40000000&minYear=2014')).body.total).toBe(1);
      expect((await api(app).get('/vehicles?maxPrice=20000000')).body.total).toBe(0);
      expect((await api(app).get(`/vehicles?q=${saleCar.stock_no}`)).body.total).toBe(1);
      const rent = await api(app).get('/vehicles?purpose=rent').expect(200);
      expect(rent.body.total).toBe(1);
      expect(rent.body.facets.makes[0].slug).toBe('toyota');
    });

    it('shows the seller phone only to signed-in visitors', async () => {
      const anon = await api(app).get(`/vehicles/${saleCar.id}`).expect(200);
      expect(anon.body.seller_phone).toBeNull();
      const signed = await api(app, buyer).get(`/vehicles/${saleCar.stock_no.toLowerCase()}`).expect(200);
      expect(signed.body.seller_phone).toBe('+265881000005');
      expect(signed.body.plate).toBe('BZ 21851');
    });

    it('a price cut shows as Price down', async () => {
      await api(app, dealer).patch(`/vehicles/${saleCar.id}`, { priceMwk: 30_000_000 }).expect(200);
      const v = (await api(app).get(`/vehicles/${saleCar.id}`)).body;
      expect(v.previous_price_mwk).toBe(32_000_000);
      expect((await api(app).get('/vehicles?priceDown=true')).body.total).toBe(1);
      expect(v.status).toBe('live'); // price edits do not need review
    });
  });

  describe('favorites and inquiries', () => {
    it('saves and removes favorites', async () => {
      await api(app, buyer).put(`/me/favorites/${saleCar.id}`).expect(200);
      expect((await api(app, buyer).get('/me/favorites')).body).toHaveLength(1);
      expect((await api(app, buyer).get(`/vehicles/${saleCar.id}`)).body.is_favorite).toBe(true);
      await request(app.getHttpServer()).delete(`/me/favorites/${saleCar.id}`).set('Authorization', `Bearer ${buyer}`).expect(200);
      expect((await api(app, buyer).get('/me/favorites')).body).toHaveLength(0);
    });

    it('buyer asks a question, seller replies, unread counts update', async () => {
      await api(app, dealer).post(`/vehicles/${saleCar.id}/inquiries`, { body: 'Is it still available?' }).expect(400); // own car
      const t = await api(app, buyer).post(`/vehicles/${saleCar.id}/inquiries`, { body: 'Is the price negotiable?' }).expect(201);
      expect((await api(app, dealer).get('/me')).body.unread_messages).toBe(1);
      const thread = await api(app, dealer).get(`/inquiries/${t.body.id}`).expect(200);
      expect(thread.body.role).toBe('seller');
      expect((await api(app, dealer).get('/me')).body.unread_messages).toBe(0);
      await api(app, dealer).post(`/inquiries/${t.body.id}/messages`, { body: 'Slightly, come and see it.' }).expect(201);
      const list = await api(app, buyer).get('/inquiries').expect(200);
      expect(list.body[0].unread).toBe(1);
      await api(app, buyer2).get(`/inquiries/${t.body.id}`).expect(404);
    });
  });

  describe('reservation with deposit', () => {
    let orderId: string;

    it('reserves; deposit is 5% clamped; a second buyer is blocked', async () => {
      const r = await api(app, buyer).post(`/vehicles/${saleCar.id}/reserve`, {}).expect(201);
      orderId = r.body.id;
      expect(r.body.status).toBe('pending_payment');
      expect(r.body.amount_mwk).toBe(500_000); // 5% of 30M = 1.5M, capped at 500k
      expect(r.body.fee_mwk).toBe(300_000); // 1% of 30M
      expect(r.body.balance_due_mwk).toBe(29_500_000);
      expect(r.body.seller_phone).toMatch(/xxx/);
      await api(app, buyer2).post(`/vehicles/${saleCar.id}/reserve`, {}).expect(409);
      await api(app, dealer).post(`/vehicles/${saleCar.id}/reserve`, {}).expect(400);
    });

    it('a failed wallet leaves it unpaid; a good wallet reserves the car', async () => {
      const bad = await api(app, buyer).post(`/orders/${orderId}/pay`, { phone: '0990000001' }).expect(200);
      expect(bad.body.status).toBe('failed');
      const ok = await api(app, buyer).post(`/orders/${orderId}/pay`, { phone: '0990000000' }).expect(200);
      expect(ok.body.status).toBe('success');
      const o = (await api(app, buyer).get(`/orders/${orderId}`)).body;
      expect(o.status).toBe('reserved');
      expect(o.seller_phone).toBe('+265881000005');
      expect(o.actions).toEqual(expect.arrayContaining(['complete', 'cancel', 'dispute']));
      expect((await api(app).get(`/vehicles/${saleCar.id}`)).body.status).toBe('reserved');
      expect((await ledgerBalanced()).escrow).toBe(-500_000);
    });

    it('seller hands over, buyer confirms, deposit less fee is paid out, car is sold', async () => {
      await api(app, buyer).post(`/orders/${orderId}/handover`).expect(403);
      await api(app, dealer).post(`/orders/${orderId}/handover`).expect(200);
      const done = await api(app, buyer).post(`/orders/${orderId}/complete`).expect(200);
      expect(done.body.status).toBe('completed');
      const seller = (await api(app, dealer).get(`/orders/${orderId}`)).body;
      expect(seller.payments.find((p: any) => p.direction === 'payout')).toMatchObject({ amount_mwk: 200_000, status: 'success' });
      expect((await api(app).get(`/vehicles/${saleCar.id}`)).body.status).toBe('sold');
      expect((await api(app).get('/vehicles')).body.total).toBe(0);
      const bal = await ledgerBalanced();
      expect(bal.escrow ?? 0).toBe(0);
      expect(bal.fee_revenue).toBe(-300_000);
    });

    it('an unclaimed reservation lapses: deposit refunded, car back on sale', async () => {
      const v = await api(app, dealer).post('/vehicles', { purpose: 'sale', modelId: xtrail, year: 2014, transmission: 'automatic', fuel: 'petrol', priceMwk: 2_000_000 }).expect(201);
      await api(app, admin).post(`/admin/listings/${v.body.id}/approve`).expect(200);
      const o = await api(app, buyer2).post(`/vehicles/${v.body.id}/reserve`, {}).expect(201);
      expect(o.body.amount_mwk).toBe(100_000); // 5% of 2M = 100k, within [50k, 500k]
      await api(app, buyer2).post(`/orders/${o.body.id}/pay`, {}).expect(200);
      await (await db()).query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id=$1`, [o.body.id]);
      const orders = app.get((await import('../src/orders/orders.service')).OrdersService);
      expect((await orders.sweep()).lapsed).toBe(1);
      const after = (await api(app, buyer2).get(`/orders/${o.body.id}`)).body;
      expect(after.status).toBe('refunded');
      expect(after.payments.find((p: any) => p.direction === 'refund').amount_mwk).toBe(100_000);
      expect((await api(app).get(`/vehicles/${v.body.id}`)).body.status).toBe('live');
      await ledgerBalanced();
    });
  });

  describe('rentals', () => {
    let orderId: string;

    it('prices by days and driver, enforces minimum days and blocks overlaps', async () => {
      await api(app, buyer).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(10), endDate: iso(11) }).expect(400); // min 2 days
      await api(app, buyer).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(-1), endDate: iso(2) }).expect(400); // past
      const r = await api(app, buyer).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(10), endDate: iso(13), withDriver: true }).expect(201);
      expect(r.body.days).toBe(3);
      expect(r.body.amount_mwk).toBe(3 * (110_000 + 30_000));
      expect(r.body.fee_mwk).toBe(42_000); // 10%
      await api(app, buyer2).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(12), endDate: iso(15) }).expect(409);
      await api(app, buyer2).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(13), endDate: iso(15) }).expect(201); // return day is free
      const free = await api(app).get(`/vehicles?purpose=rent&from=${iso(11)}&to=${iso(12)}`).expect(200);
      expect(free.body.total).toBe(0);
      const later = await api(app).get(`/vehicles?purpose=rent&from=${iso(20)}&to=${iso(22)}`).expect(200);
      expect(later.body.total).toBe(1);
      orderId = r.body.id;
      const detail = await api(app).get(`/vehicles/${rentCar.id}`).expect(200);
      expect(detail.body.booked.length).toBe(2);
    });

    it('an unpaid booking expires and frees the dates', async () => {
      await (await db()).query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id=$1`, [orderId]);
      const orders = app.get((await import('../src/orders/orders.service')).OrdersService);
      expect((await orders.sweep()).expired).toBeGreaterThanOrEqual(1);
      expect((await api(app, buyer).get(`/orders/${orderId}`)).body.status).toBe('expired');
      await api(app, buyer).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(10), endDate: iso(12) }).expect(201);
    });

    it('renter cancels a paid future booking and is refunded in full', async () => {
      const r = await api(app, buyer).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(30), endDate: iso(32) }).expect(201);
      await api(app, buyer).post(`/orders/${r.body.id}/pay`, {}).expect(200);
      expect((await api(app, buyer).get(`/orders/${r.body.id}`)).body.status).toBe('confirmed');
      const c = await api(app, buyer).post(`/orders/${r.body.id}/cancel`, { reason: 'Plans changed' }).expect(200);
      expect(c.body.status).toBe('refunded');
      expect(c.body.payments.find((p: any) => p.direction === 'refund').amount_mwk).toBe(220_000);
      await ledgerBalanced();
    });

    it('a rental from today: owner marks returned, renter confirms, owner paid less 10%', async () => {
      const r = await api(app, buyer).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(0), endDate: iso(2) }).expect(201);
      await api(app, buyer).post(`/orders/${r.body.id}/pay`, {}).expect(200);
      await api(app, buyer).post(`/orders/${r.body.id}/cancel`, {}).expect(400); // already started
      await api(app, owner).post(`/orders/${r.body.id}/handover`).expect(200);
      await api(app, buyer).post(`/orders/${r.body.id}/complete`).expect(200);
      const o = (await api(app, owner).get(`/orders/${r.body.id}`)).body;
      expect(o.status).toBe('completed');
      expect(o.payments[0]).toMatchObject({ direction: 'payout', amount_mwk: 198_000 }); // 220k - 22k
      await ledgerBalanced();
    });

    it('a disputed rental is split by admin', async () => {
      const r = await api(app, buyer2).post(`/vehicles/${rentCar.id}/rent`, { startDate: iso(40), endDate: iso(42) }).expect(201);
      await api(app, buyer2).post(`/orders/${r.body.id}/pay`, {}).expect(200);
      await api(app, buyer2).post(`/orders/${r.body.id}/dispute`, { reason: 'Owner says car is not available' }).expect(200);
      const d = (await api(app, admin).get('/admin/disputes').expect(200)).body.find((x: any) => x.order_id === r.body.id);
      await api(app, admin).post(`/admin/disputes/${d.id}/resolve`, { resolution: 'split', sellerSharePercent: 50, note: 'Half each' }).expect(200);
      const o = (await api(app, admin).get(`/orders/${r.body.id}`)).body;
      expect(o.status).toBe('completed');
      expect(o.payments.find((p: any) => p.direction === 'refund').amount_mwk).toBe(110_000);
      expect(o.payments.find((p: any) => p.direction === 'payout').amount_mwk).toBe(110_000 - 11_000);
      await ledgerBalanced();
    });
  });

  describe('seller tools and admin', () => {
    it('seller dashboard shows listings and stats; pause and resume', async () => {
      const mine = await api(app, owner).get('/sellers/me/vehicles').expect(200);
      expect(mine.body).toHaveLength(1);
      await api(app, owner).post(`/vehicles/${rentCar.id}/status`, { action: 'sold' }).expect(400);
      await api(app, owner).post(`/vehicles/${rentCar.id}/status`, { action: 'pause' }).expect(200);
      expect((await api(app).get('/vehicles?purpose=rent')).body.total).toBe(0);
      await api(app, owner).post(`/vehicles/${rentCar.id}/status`, { action: 'resume' }).expect(200);
      const me = (await api(app, owner).get('/sellers/me').expect(200)).body;
      expect(me.stats.paid_out_mwk).toBeGreaterThan(0);
      const pub = await api(app).get(`/sellers/${me.id}`).expect(200);
      expect(pub.body).not.toHaveProperty('payout_msisdn');
    });

    it('protects admin routes and reports an overview', async () => {
      await api(app, buyer).get('/admin/overview').expect(403);
      const o = (await api(app, admin).get('/admin/overview').expect(200)).body;
      expect(o.live_for_rent).toBe(1);
      expect(o.escrow_held_mwk).toBeGreaterThanOrEqual(0);
    });

    it('rejects a badly signed PayChangu webhook and accepts a good signature', async () => {
      await request(app.getHttpServer()).post('/webhooks/paychangu').set('Content-Type', 'application/json').set('Signature', 'nope')
        .send(JSON.stringify({ charge_id: 'x', status: 'success' })).expect(401);
      const { PayChanguDriver } = await import('../src/payments/driver');
      const body = JSON.stringify({ event_type: 'api.charge.payment', data: { charge_id: 'GO-ABC-C1', status: 'success' } });
      const sig = createHmac('sha256', 'whsec_test').update(body).digest('hex');
      expect(new PayChanguDriver().parseWebhook(body, sig)).toMatchObject({ chargeId: 'GO-ABC-C1', status: 'success' });
    });
  });
  describe('admin-approved sign-up (no SMS code)', () => {
    const phone = '0881000077';
    const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');
    const req = (body: Record<string, string>, photos = true) => {
      let r = request(app.getHttpServer()).post('/auth/access-request');
      for (const [k, v] of Object.entries(body)) r = r.field(k, v);
      if (photos) r = r.attach('idPhoto', jpeg, 'id.jpg').attach('selfie', jpeg, 'me.jpg');
      return r;
    };

    it('rejects weak PINs and existing accounts', async () => {
      await req({ phone, name: 'Chikondi Banda', pin: '1111' }).expect(400);
      await req({ phone: '0991000003', name: 'Already Here', pin: '7391' }).expect(400);
    });

    it('needs both an ID photo and a selfie', async () => {
      const r = await req({ phone, name: 'Chikondi Banda', pin: '7391' }, false).expect(400);
      expect(r.body.message).toMatch(/national ID/);
      await request(app.getHttpServer()).post('/auth/access-request').field('phone', phone).field('name', 'Chikondi Banda').field('pin', '7391')
        .attach('idPhoto', jpeg, 'id.jpg').expect(400);
    });

    it('a request cannot sign in until an admin approves it', async () => {
      await req({ phone, name: 'Chikondi Banda', pin: '7391', note: 'Car yard in Blantyre' }).expect(200);
      const r = await api(app).post('/auth/pin/login', { phone, pin: '7391' }).expect(401);
      expect(r.body.message).toMatch(/waiting for approval/);
      const wrong = await api(app).post('/auth/pin/login', { phone, pin: '2580' }).expect(401);
      expect(wrong.body.message).toBe('Wrong number or PIN');
      await api(app, buyer).get('/admin/access-requests').expect(403);
    });

    it('admin approves; the person signs in with number and PIN', async () => {
      const list = (await api(app, admin).get('/admin/access-requests').expect(200)).body;
      const mine = list.find((x: any) => x.name === 'Chikondi Banda');
      expect(mine).toBeTruthy();
      // ID photo and selfie open for admins only
      await api(app).get(`/files/${mine.id_file_id}`).expect(403);
      await api(app, buyer).get(`/files/${mine.selfie_file_id}`).expect(403);
      await api(app, admin).get(`/files/${mine.id_file_id}`).expect(200);
      expect((await api(app, admin).get('/admin/overview').expect(200)).body.pending_access).toBe(1);
      await api(app, admin).post(`/admin/access-requests/${mine.id}/approve`).expect(200);
      await api(app, admin).post(`/admin/access-requests/${mine.id}/approve`).expect(400);
      const ok = await api(app).post('/auth/pin/login', { phone, pin: '7391' }).expect(200);
      expect(ok.body.user.name).toBe('Chikondi Banda');
      expect(ok.body.user.roles).toEqual(['customer']);
    });

    it('a rejected request says so', async () => {
      const p2 = '0881000078';
      await req({ phone: p2, name: 'Test Person', pin: '7391' }).expect(200);
      const mine = (await api(app, admin).get('/admin/access-requests').expect(200)).body.find((x: any) => x.name === 'Test Person');
      await api(app, admin).post(`/admin/access-requests/${mine.id}/reject`, { reason: 'We could not verify you' }).expect(200);
      await api(app, admin).get(`/files/${mine.id_file_id}`).expect(404); // rejected: photos are deleted
      const r = await api(app).post('/auth/pin/login', { phone: p2, pin: '7391' }).expect(401);
      expect(r.body.message).toMatch(/not approved: We could not verify you/);
    });

    it('locks PIN sign-in after five wrong tries', async () => {
      for (let i = 0; i < 5; i++) await api(app).post('/auth/pin/login', { phone, pin: '0852' }).expect(401);
      await api(app).post('/auth/pin/login', { phone, pin: '7391' }).expect(429);
    });
  });
});
