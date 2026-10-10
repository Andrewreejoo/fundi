// HTTP-level walkthrough of the website: drives the real pages and form actions with cookies,
// against a running API (PAYMENTS_DRIVER=fake, DEV_OTP_ECHO=true) seeded with demo data.
// Usage: WEB=http://localhost:4173 node tests/walkthrough.mjs
const WEB = process.env.WEB ?? 'http://localhost:4173';
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

class Browser {
  cookies = new Map();
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(k); else this.cookies.set(k, v);
    }
  }
  async get(path) {
    const res = await fetch(WEB + path, { headers: { cookie: this.cookieHeader(), accept: 'text/html' }, redirect: 'manual' });
    this.store(res);
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  }
  /** Submit a form the way a browser without JavaScript would. */
  async post(path, fields) {
    const body = new URLSearchParams(fields);
    const res = await fetch(WEB + path, {
      method: 'POST',
      headers: { cookie: this.cookieHeader(), 'content-type': 'application/x-www-form-urlencoded', origin: WEB, accept: 'text/html' },
      body, redirect: 'manual',
    });
    this.store(res);
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  }
  async login(phone) {
    const r1 = await this.post('/login?/request', { phone });
    const code = r1.html.match(/your code is <strong>(\d{6})<\/strong>/)?.[1];
    if (!code) throw new Error(`no dev code for ${phone}: status ${r1.status}`);
    const r2 = await this.post('/login?/verify', { phone, code, next: '/' });
    return r2;
  }
}

const rnd = () => String(Math.floor(1000000 + Math.random() * 8999999));
const CUSTOMER_PHONE = `099${rnd()}`.slice(0, 10).replace(/1$/, '2'); // wallets ending in 1 fail in the fake driver
const NEWBIE_PHONE = `088${rnd()}`.slice(0, 10);
const customer = new Browser();
const provider = new Browser();
const admin = new Browser();
const newbie = new Browser();

// Public pages
for (const p of ['/', '/search?category=plumbing&place=4', '/become-a-fundi', '/login', '/privacy', '/terms', '/manifest.webmanifest']) {
  const r = await customer.get(p);
  ok(r.status === 200, `GET ${p} -> ${r.status}`);
}
const home = await customer.get('/');
ok(home.html.includes('Mapaipi') && home.html.includes('Airtel Money'), 'home shows Chichewa trades and payment promise');
const en = await customer.post('/lang', { lang: 'en', next: '/' });
ok(en.status === 303, 'language switch redirects');
ok((await customer.get('/')).html.includes('Find a trusted fundi near you'), 'English copy after switching language');

const search = await customer.get('/search?category=plumbing&place=4');
const providerId = search.html.match(/href="\/fundi\/([0-9a-f-]{36})/)?.[1];
ok(!!providerId, 'search lists a provider near Area 25');
const profile = await customer.get(`/fundi/${providerId}`);
ok(profile.status === 200 && profile.html.includes('Leak repair'), 'provider profile shows services');
ok(!profile.html.includes('888000101'), 'profile hides the phone number');
const listingId = profile.html.match(/\/book\/[0-9a-f-]{36}\?listing=([0-9a-f-]{36})/)?.[1];

// Booking needs sign-in
const gate = await customer.get(`/book/${providerId}?listing=${listingId}`);
ok(gate.status === 303 && gate.location.startsWith('/login'), 'booking redirects to sign-in');

// Customer signs in by SMS code, is asked to set a PIN, sets it
const login = await customer.login(CUSTOMER_PHONE);
ok(login.status === 303 && login.location.startsWith('/account?setpin=1'), 'new user is asked to set a PIN');
const pin = await customer.post('/account?/pin', { pin: '2580', next: '' });
ok(pin.status === 200 && pin.html.includes('Saved'), 'PIN saved');

// Customer books the fixed-price "Toilet fitting" (MWK 15,000) with escrow
const toilet = profile.html.match(/\/book\/[0-9a-f-]{36}\?listing=([0-9a-f-]{36})/g)?.[1]?.split('listing=')[1];
const bookPage = await customer.get(`/book/${providerId}?listing=${toilet}`);
ok(bookPage.status === 200 && bookPage.html.includes('Toilet fitting'), 'booking form loads');
const today = new Date().toISOString().slice(0, 10);
const booked = await customer.post(`/book/${providerId}`, {
  listing: toilet, description: 'Toilet runs all night', date: today, slot: 'afternoon', place: '4', landmark: 'Blue gate', escrow: 'on',
});
ok(booked.status === 303 && /\/bookings\/[0-9a-f-]{36}\?new=1/.test(booked.location), 'booking created');
const bookingPath = booked.location.split('?')[0];
let page = await customer.get(booked.location);
ok(page.html.includes('Waiting for fundi') || page.html.includes('Yatumizidwa'), 'booking shows waiting status');
ok(page.html.includes('xxx'), 'provider phone masked before acceptance');

// Provider (seeded Chikondi, +265888000101) accepts from the dashboard
await provider.login('0888000101');
const dash = await provider.get('/provider');
ok(dash.status === 200 && dash.html.includes('Toilet fitting'), 'provider dashboard shows the new request');
const acc = await provider.post(`${bookingPath}?/accept`, {});
ok(acc.status === 200, 'provider accepts');

// Customer pays (fake wallet succeeds), money held
page = await customer.get(bookingPath);
ok(page.html.includes('MWK 15,300'), 'customer sees total with protection fee (15,000 + 300)');
const paid = await customer.post(`${bookingPath}?/pay`, { phone: '0990000000' });
ok(paid.status === 200, 'pay action accepted');
page = await customer.get(bookingPath);
ok(page.html.includes('Money is held safely by Fundi'), 'payment held in escrow');
ok(page.html.includes('0888 000 101'), 'provider phone revealed after payment');

// Provider marks done; customer confirms and rates
ok((await provider.post(`${bookingPath}?/complete`, {})).status === 200, 'provider marks job done');
ok((await customer.post(`${bookingPath}?/confirm`, {})).status === 200, 'customer confirms');
page = await provider.get(bookingPath);
ok(page.html.includes('MWK 13,800'), 'provider sees net payout (15,000 less 8% = 13,800)');
ok((await customer.post(`${bookingPath}?/review`, { rating: '5', text: 'Fast and tidy' })).status === 200, 'customer rates 5 stars');
page = await customer.get(bookingPath);
ok(page.html.includes('Your rating: ★★★★★'), 'rating shown on booking');

// Quote flow with a dispute, resolved by admin
const quote = await customer.post(`/book/${providerId}`, { listing: 'quote', category: '1', description: 'Geyser not heating', date: today, slot: 'morning', place: '4', escrow: 'on' });
const qPath = quote.location.split('?')[0];
ok((await provider.post(`${qPath}?/quote`, { price: '30,000', note: 'New element' })).status === 200, 'provider sends a quote');
ok((await customer.post(`${qPath}?/acceptQuote`, {})).status === 200, 'customer accepts the quote');
ok((await customer.post(`${qPath}?/pay`, { phone: CUSTOMER_PHONE })).status === 200, 'customer pays the quote');
ok((await provider.post(`${qPath}?/complete`, {})).status === 200, 'provider marks done');
ok((await customer.post(`${qPath}?/dispute`, { reason: 'Water still cold' })).status === 200, 'customer reports a problem');

await admin.login('0999000001');
const adminHome = await admin.get('/admin');
ok(adminHome.status === 200 && adminHome.html.includes('Open disputes'), 'admin overview loads');
const disputes = await admin.get('/admin/disputes');
const disputeId = disputes.html.match(/name="id" value="([0-9a-f-]{36})"/)?.[1];
ok(!!disputeId, 'dispute listed for admin');
const resolved = await admin.post('/admin/disputes?/resolve', { id: disputeId, resolution: 'split', share: '50', note: 'Half fixed' });
ok(resolved.status === 200 && resolved.html.includes('Resolved'), 'admin resolves 50/50 split');
page = await customer.get(qPath);
ok(page.html.includes('Refund') && page.html.includes('MWK 15,000'), 'customer sees 15,000 refund');
for (const p of ['/admin/verifications', '/admin/listings', '/admin/payments', '/admin/users']) {
  ok((await admin.get(p)).status === 200, `admin ${p}`);
}
ok((await customer.get('/admin')).status === 403, 'customer cannot open admin');

// A new person becomes a fundi through the website
await newbie.login(NEWBIE_PHONE);
const joined = await newbie.post('/become-a-fundi', {
  trades: 'tailoring', displayName: 'Esther Banda', place: '9', landmark: 'Limbe market', payoutPhone: NEWBIE_PHONE,
  homeVisits: 'on', serviceTitle: 'Chitenje dress', priceType: 'fixed', price: '18000', consent: 'on',
});
ok(joined.status === 303 && joined.location === '/provider?welcome=1', 'new fundi registered');
const nd = await newbie.get('/provider?welcome=1');
ok(nd.html.includes('Chitenje dress') && nd.html.includes('Being checked'), 'first service waits for review (unverified fundi)');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll website checks passed');
process.exit(failures ? 1 : 0);
