// HTTP-level walkthrough of the website: drives the real pages and form actions with cookies, the way a
// browser without JavaScript would, against a running API started with DEMO_MODE=true (demo cars,
// simulated payments, sign-in codes echoed).
// Usage: WEB=http://localhost:4173 node tests/walkthrough.mjs
import { readFileSync } from 'node:fs';

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
  async send(path, init) {
    const res = await fetch(WEB + path, { ...init, headers: { cookie: this.cookieHeader(), accept: 'text/html', ...(init?.headers ?? {}) }, redirect: 'manual' });
    this.store(res);
    return { status: res.status, location: res.headers.get('location'), html: await res.text() };
  }
  get(path) { return this.send(path); }
  /** Submit a urlencoded form. */
  post(path, fields) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) body.append(k, x);
    return this.send(path, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', origin: WEB } });
  }
  /** Submit a multipart form (file uploads). */
  postMultipart(path, fields, files = []) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) fd.append(k, x);
    for (const f of files) fd.append(f.name, new Blob([f.data], { type: f.type }), f.filename);
    return this.send(path, { method: 'POST', body: fd, headers: { origin: WEB } });
  }
  async login(phone, next = '/') {
    const r1 = await this.post('/login?/request', { phone });
    const code = r1.html.match(/your code is <strong>(\d{6})<\/strong>/)?.[1];
    if (!code) throw new Error(`no demo code for ${phone}: status ${r1.status}`);
    // Svelte reads {6} in an attribute as an expression; a mangled pattern blocks the form in real browsers.
    if (!r1.html.includes('pattern="[0-9]{6}"')) throw new Error('code input pattern is mangled');
    return this.post('/login?/verify', { phone, code, next });
  }
}

const rnd = () => String(Math.floor(1000000 + Math.random() * 8999999));
const phone = (prefix) => `${prefix}${rnd()}`.slice(0, 10).replace(/1$/, '2'); // wallets ending in 1 fail in demo payments
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const iso = (d) => d.toISOString().slice(0, 10);
const inDays = (n) => iso(new Date(Date.now() + n * 86_400_000));

const buyer = new Browser();
const renter2 = new Browser();
const dealer = new Browser(); // Limbe Auto Point (demo, verified) sells the silver X-Trail GM10001
const hire = new Browser(); // Lake Road Car Hire (demo) rents out the black X-Trail GM10002
const newbie = new Browser();
const admin = new Browser();

// ---------------------------------------------------------------- browsing, signed out
for (const p of ['/', '/cars', '/rent', '/cars?make=nissan', '/cars?body=suv&sort=price_asc', '/cars?priceDown=true', '/sell', '/how-it-works', '/login', '/compare', '/privacy', '/terms', '/manifest.webmanifest']) {
  const r = await buyer.get(p);
  ok(r.status === 200, `GET ${p} -> ${r.status}`);
}
const home = await buyer.get('/');
ok(home.html.includes('Rent a car') && home.html.includes('GALIMOTO YANGA'), 'home has the Buy/Rent tabs and plate logo');
const list = await buyer.get('/cars?make=nissan');
ok(list.html.includes('GM10001') && list.html.includes('X-Trail'), 'Nissan filter lists the silver X-Trail');
const search = await buyer.get('/cars?q=GM10001');
ok(search.html.includes('X-Trail'), 'search by stock number finds the car');
const rentFrom = inDays(10), rentTo = inDays(12);
const rentList = await buyer.get(`/rent?from=${rentFrom}&to=${rentTo}`);
ok(rentList.html.includes('GM10002'), 'rental search with dates shows the black X-Trail');

const detail = await buyer.get('/cars/GM10001');
ok(detail.status === 200 && detail.html.includes('Limbe Auto Point'), 'car page shows the dealer');
ok(!detail.html.includes('tel:+265888000202'), 'seller phone hidden when signed out');
ok(/\/api\/files\/[0-9a-f-]{36}/.test(detail.html), 'car page shows uploaded photos');
const carId = detail.html.match(new RegExp(`name="id" value="(${uuid.source})"`))?.[1];
ok(!!carId, 'car id found on the page');
const gate = await buyer.post('/cars/GM10001?/reserve', { id: carId });
ok(gate.status === 303 && gate.location.startsWith('/login'), 'reserving needs sign-in');
const cmp = await buyer.post('/compare?/toggle', { id: carId, next: '/compare' });
ok(cmp.status === 303, 'add to compare');
ok((await buyer.get('/compare')).html.includes('GM10001'), 'compare page lists the car');
ok((await buyer.get('/cars/GM99999')).status === 404, 'unknown stock number is a 404');

// ---------------------------------------------------------------- buyer signs in
const BUYER = phone('099');
const login = await buyer.login(BUYER, '/cars/GM10001');
ok(login.status === 303 && login.location.startsWith('/account?setpin=1'), 'new user is asked to set a PIN');
const pin = await buyer.post('/account?/pin', { pin: '2580', next: '' });
ok(pin.status === 200 && pin.html.includes('Saved'), 'PIN saved');
await buyer.post('/account?/profile', { name: 'Chikondi Walk' });
const signedIn = await buyer.get('/cars/GM10001');
ok(signedIn.html.includes('tel:+265888000202'), 'seller phone shown once signed in');

const fav = await buyer.post('/favorites?/toggle', { id: carId, next: '/cars/GM10001' });
ok(fav.status === 303, 'save car');
ok((await buyer.get('/favorites')).html.includes('GM10001'), 'saved cars lists it');

// Enquiry and reply
const inq = await buyer.post('/cars/GM10001?/inquire', { id: carId, body: 'Is the price negotiable? Any accident history?' });
ok(inq.status === 303 && /^\/messages\/[0-9a-f-]{36}\?sent=1/.test(inq.location), 'enquiry sent');
if (inq.status !== 303) console.log('  inquire ->', inq.status, (inq.html.match(/alert[^>]*>[^<]{0,200}/g) ?? []).join(' / '), inq.html.length);
const threadPath = (inq.location ?? '').split('?')[0];
await dealer.login('0888000202');
const inbox = await dealer.get('/messages');
ok(inbox.html.includes('accident history'), 'dealer sees the enquiry');
const reply = await dealer.post(`${threadPath}`, { body: 'No accidents. Small discount for cash.' });
ok(reply.status === 200, 'dealer replies');
ok((await buyer.get(threadPath)).html.includes('Small discount'), 'buyer sees the reply');

// ---------------------------------------------------------------- reserve with deposit
const res = await buyer.post('/cars/GM10001?/reserve', { id: carId });
ok(res.status === 303 && /^\/orders\/[0-9a-f-]{36}$/.test(res.location), 'reservation created');
const orderPath = res.location;
let order = await buyer.get(orderPath);
ok(order.html.includes('Waiting for payment') && order.html.includes('500,000'), 'order waits for the MWK 500,000 deposit');
const paid = await buyer.post(`${orderPath}?/pay`, { phone: BUYER });
ok(paid.status === 200 || paid.status === 303, 'payment requested');
order = await buyer.get(orderPath);
ok(order.html.includes('Reserved') && order.html.includes('held for you'), 'deposit paid, car held');
ok((await buyer.get('/cars/GM10001')).html.includes('Reserved'), 'car page shows Reserved');
const again = await renter2.login(phone('088'), '/');
ok(again.status === 303, 'second buyer signs in');
const blocked = await renter2.post('/cars/GM10001?/reserve', { id: carId });
ok(blocked.status === 400 && /reserved/i.test(blocked.html), 'second reservation refused');

const dash = await dealer.get('/seller');
ok(dash.status === 200 && dash.html.includes('Needs your attention') && dash.html.includes('Chikondi Walk'), 'dealer dashboard shows the reservation');
const sellerOrder = await dealer.get(orderPath);
// MWK 32,000,000 car: deposit capped at 500,000; fee 1% = 320,000; dealer receives 180,000 (plus the balance at handover).
ok(sellerOrder.html.includes('You receive from GalimotoYanga') && sellerOrder.html.includes('180,000'), 'dealer sees net payout of MWK 180,000');
const handover = await dealer.post(`${orderPath}?/handover`, {});
ok(handover.status === 200, 'dealer marks handed over');
const done = await buyer.post(`${orderPath}?/complete`, {});
ok(done.status === 200, 'buyer confirms purchase');
order = await buyer.get(orderPath);
ok(order.html.includes('Completed') && order.html.includes('Paid out to the seller'), 'sale completed and paid out');
ok((await buyer.get('/cars/GM10001')).html.includes('Sold'), 'car now shows Sold');

// ---------------------------------------------------------------- rent with a driver
const rentPage = await buyer.get('/cars/GM10002');
const rentId = rentPage.html.match(new RegExp(`name="id" value="(${uuid.source})"`))?.[1];
const rent = await buyer.post('/cars/GM10002?/rent', { id: rentId, start: rentFrom, end: rentTo, withDriver: 'on' });
ok(rent.status === 303 && /^\/orders\//.test(rent.location), 'rental booked');
let rorder = await buyer.get(rent.location);
ok(rorder.html.includes('310,000'), 'rental total is 2 days × (120,000 + 35,000) = MWK 310,000');
await buyer.post(`${rent.location}?/pay`, { phone: BUYER });
rorder = await buyer.get(rent.location);
ok(rorder.html.includes('Booked'), 'rental paid and booked');
ok(!(await buyer.get(`/rent?from=${rentFrom}&to=${rentTo}`)).html.includes('GM10002'), 'booked car drops out of rental search for those dates');
const clash = await renter2.post('/cars/GM10002?/rent', { id: rentId, start: inDays(11), end: inDays(13) });
ok(clash.status === 400 && /booked|available/i.test(clash.html), 'overlapping rental refused');
await hire.login('0888000203');
const hireCancel = await buyer.post(`${rent.location}?/cancel`, {});
ok(hireCancel.status === 200, 'renter cancels before the start date');
ok((await buyer.get(rent.location)).html.includes('Refunded to the buyer'), 'rental refunded in full');

// ---------------------------------------------------------------- a new private seller lists a car
await newbie.login(phone('088'), '/sell');
const become = await newbie.post('/sell', { kind: 'private', name: 'Walk Test Seller', placeId: '4', payoutPhone: '', whatsapp: 'on' });
ok(become.status === 303 && become.location === '/seller/cars/new?welcome=1', 'becomes a seller');
const newForm = await newbie.get('/seller/cars/new?welcome=1');
ok(newForm.status === 200 && newForm.html.includes('List a car'), 'listing form loads');
const modelId = newForm.html.match(/<option value="(\d+)">Toyota Vitz<\/option>/)?.[1];
ok(!!modelId, 'model list includes Toyota Vitz');
const photo = readFileSync(new URL('../static/img/hero-sale.jpg', import.meta.url));
const created = await newbie.postMultipart('/seller/cars/new', {
  purpose: 'sale', modelId, variant: 'F 1.0', year: '2012', mileageKm: '98,000', transmission: 'automatic', fuel: 'petrol', drive: '2wd',
  engineCc: '1000', color: 'White', condition: 'good', seats: '5', doors: '5', plate: 'LL 4567', registered: 'on', dutyPaid: 'on',
  priceMwk: '7,800,000', negotiable: 'on', features: ['air_conditioning', 'power_steering'], description: 'One owner, serviced at Toyota Malawi.', placeId: '',
}, [{ name: 'photos', data: photo, type: 'image/jpeg', filename: 'vitz.jpg' }]);
ok(created.status === 303 && /^\/seller\/cars\/[0-9a-f-]{36}\?saved=pending$/.test(created.location), 'car listed and waiting for checks');
const editPath = created.location.split('?')[0];
const newCarId = editPath.split('/').pop();
const mine = await newbie.get('/seller');
ok(mine.html.includes('Being checked') && mine.html.includes('Vitz'), 'seller dashboard shows the listing being checked');
const hidden = await buyer.get(`/cars/${newCarId}`);
ok(hidden.status === 404, 'unchecked listing hidden from buyers');

// ---------------------------------------------------------------- admin checks it
await admin.login('0999000001', '/admin');
for (const p of ['/admin', '/admin/listings', '/admin/sellers', '/admin/orders', '/admin/payments', '/admin/users']) {
  const r = await admin.get(p);
  ok(r.status === 200, `admin GET ${p} -> ${r.status}`);
}
ok((await admin.get('/admin/listings')).html.includes('Walk Test Seller'), 'new listing in the review queue');
const approve = await admin.post('/admin/listings?/approve', { id: newCarId });
ok(approve.status === 200, 'admin approves');
const live = await buyer.get(`/cars/${newCarId}`);
ok(live.status === 200 && live.html.includes('7,800,000'), 'approved car visible to buyers');
ok((await buyer.get('/admin')).status === 403, 'non-admins kept out of admin');
const ledger = await admin.get('/admin/payments');
ok(ledger.html.includes('Books balance'), 'ledger balances');

// ---------------------------------------------------------------- seller edits: price drop
const editForm = await newbie.get(editPath);
ok(editForm.status === 200 && editForm.html.includes('Save changes'), 'edit form loads');
const keep = editForm.html.match(new RegExp(`name="keep" value="(${uuid.source})"`))?.[1];
const edited = await newbie.postMultipart(editPath, {
  purpose: 'sale', modelId, variant: 'F 1.0', year: '2012', mileageKm: '98000', transmission: 'automatic', fuel: 'petrol', drive: '2wd',
  engineCc: '1000', color: 'White', condition: 'good', seats: '5', doors: '5', plate: 'LL 4567', registered: 'on', dutyPaid: 'on',
  priceMwk: '7500000', negotiable: 'on', features: ['air_conditioning', 'power_steering'], description: 'One owner, serviced at Toyota Malawi.',
  keep, cover: keep, placeId: '',
});
if (edited.status !== 303) console.log('  edit ->', edited.status, edited.html.match(/role="alert">([^<]*)/)?.[1]);
ok(edited.status === 303 && edited.location.endsWith('?saved=ok'), 'price lowered without going back to review');
const dropped = await buyer.get(`/cars/${newCarId}`);
ok(dropped.html.includes('7,500,000') && dropped.html.includes('7,800,000'), 'car shows new price with the old one crossed out');
const pause = await newbie.post('/seller?/status', { id: newCarId, action: 'pause' });
ok(pause.status === 200, 'seller pauses the listing');
ok((await buyer.get(`/cars/${newCarId}`)).status === 404, 'paused car hidden');

const logout = await buyer.post('/account?/logout', {});
ok(logout.status === 303 && !buyer.cookies.has('gm_at'), 'sign out clears the session');

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
