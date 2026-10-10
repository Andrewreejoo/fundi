/* Demo data: placeholder sellers and cars in Lilongwe, Blantyre and Mzuzu, so the site has stock to browse.
 * Photos in api/demo-photos are placeholders supplied by the site owner; other demo cars show a drawn outline.
 * Prices, years and mileages are illustrative only. Demo seller phones are +265888000202 to 207 (none end in 1, which the fake payment driver fails).
 * Runs at start-up when DEMO_MODE=true (idempotent); refuses to run in production otherwise. */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { config } from '../config';
import { migrate } from './migrate';

type Seller = { phone: string; kind: 'dealer' | 'private'; name: string; district: string; area: string; verified: boolean; about: string; address?: string };
const SELLERS: Seller[] = [
  { phone: '+265888000207', kind: 'dealer', name: 'Area 47 Car Yard', district: 'Lilongwe', area: 'Area 47', verified: true,
    about: 'Japanese used cars already in Malawi, duty paid and registered. Viewing Monday to Saturday.', address: 'Area 47, Sector 4, near the filling station' },
  { phone: '+265888000202', kind: 'dealer', name: 'Limbe Auto Point', district: 'Blantyre', area: 'Limbe', verified: true,
    about: 'SUVs, pickups and family cars. Trade-ins welcome.', address: 'Masauko Chipembere Highway, Limbe' },
  { phone: '+265888000203', kind: 'dealer', name: 'Lake Road Car Hire', district: 'Blantyre', area: 'Chirimba', verified: true,
    about: 'Self-drive and chauffeur-driven car hire for weddings, trips and business.', address: 'Chirimba, Blantyre' },
  { phone: '+265888000204', kind: 'dealer', name: 'Northern Motors Mzuzu', district: 'Mzuzu', area: 'City Centre', verified: false,
    about: 'Cars and car hire in the North.', address: 'Orton Chirwa Avenue, Mzuzu' },
  { phone: '+265888000205', kind: 'private', name: 'Grace Banda', district: 'Lilongwe', area: 'Area 25', verified: false, about: 'Selling my family car.' },
  { phone: '+265888000206', kind: 'private', name: 'Thokozani Phiri', district: 'Blantyre', area: 'Ndirande', verified: false, about: 'Relocating, car must go.' },
];

type Car = {
  seller: number; purpose: 'sale' | 'rent'; make: string; model: string; variant?: string; year: number; trans: 'automatic' | 'manual';
  fuel: string; drive?: string; cc?: number; km?: number; color: string; seats?: number; doors?: number; condition?: string; plate?: string;
  price?: number; was?: number; daily?: number; driver?: number | null; selfDrive?: boolean; minDays?: number;
  features: string[]; desc: string; photos?: string[]; daysAgo: number; featured?: boolean; cof?: string;
};
const BASIC = ['air_conditioning', 'power_steering', 'power_windows', 'central_locking'];
const CARS: Car[] = [
  // ---- placeholder photos supplied by the owner
  { seller: 1, purpose: 'sale', make: 'nissan', model: 'x-trail', variant: '20X Emergency Brake', year: 2015, trans: 'automatic', fuel: 'petrol', drive: '4wd',
    cc: 2000, km: 86000, color: 'Silver', seats: 5, doors: 5, condition: 'excellent', plate: 'BZ 21851', price: 32_000_000, was: 34_500_000,
    features: [...BASIC, 'abs', 'airbags', 'alloy_wheels', 'reverse_camera', 'keyless_entry', 'push_start', 'roof_rails', 'bluetooth'],
    desc: 'Clean X-Trail, registered in Malawi, duty paid. Keyless entry with push start, reverse camera, 4WD. Serviced and ready to drive.',
    photos: ['xtrail-silver-1', 'xtrail-silver-2', 'xtrail-silver-3', 'xtrail-pair-rear'], daysAgo: 1, featured: true, cof: '2027-03-31' },
  { seller: 2, purpose: 'rent', make: 'nissan', model: 'x-trail', variant: '20X', year: 2015, trans: 'automatic', fuel: 'petrol', drive: '4wd',
    cc: 2000, km: 98000, color: 'Black', seats: 5, doors: 5, plate: 'BZ 23902', daily: 120_000, driver: 35_000, selfDrive: true,
    features: [...BASIC, 'abs', 'airbags', 'alloy_wheels', 'reverse_camera', 'keyless_entry', 'push_start', 'bluetooth'],
    desc: 'Comfortable SUV for town and trips. Self-drive (valid licence and ID required) or with our driver. Fuel not included.',
    photos: ['xtrail-black-1', 'xtrail-black-2', 'xtrail-pair-rear'], daysAgo: 2, featured: true },
  { seller: 2, purpose: 'rent', make: 'toyota', model: 'voxy', variant: 'ZS 8 seater', year: 2010, trans: 'automatic', fuel: 'petrol',
    cc: 2000, km: 142000, color: 'Silver', seats: 8, doors: 5, plate: 'NA 5906', daily: 110_000, driver: 30_000, selfDrive: true,
    features: [...BASIC, 'sliding_doors', 'third_row_seats', 'bluetooth'],
    desc: 'Eight seats, ideal for family trips, weddings and airport runs. Driver available.',
    photos: ['voxy-1', 'voxy-2', 'voxy-3', 'voxy-4'], daysAgo: 3, featured: true },
  // ---- sale stock (drawn outlines until sellers upload photos)
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'vitz', variant: '1.0 F', year: 2012, trans: 'automatic', fuel: 'petrol', cc: 1000, km: 98000, color: 'White', seats: 5, doors: 5,
    price: 12_500_000, was: 13_500_000, features: [...BASIC, 'airbags'], desc: 'Economical town car. New tyres last month.', daysAgo: 0 },
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'axio', variant: '1.5 X', year: 2014, trans: 'automatic', fuel: 'petrol', cc: 1500, km: 74000, color: 'Pearl white', seats: 5, doors: 4,
    price: 19_800_000, features: [...BASIC, 'abs', 'airbags', 'navigation', 'reverse_camera'], desc: 'Low mileage Axio, one owner since import.', daysAgo: 1, featured: true },
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'mark-x', variant: '250G', year: 2010, trans: 'automatic', fuel: 'petrol', cc: 2500, km: 112000, color: 'Black', seats: 5, doors: 4,
    price: 17_500_000, features: [...BASIC, 'abs', 'airbags', 'alloy_wheels', 'leather_seats', 'cruise_control'], desc: 'Smooth V6, leather interior.', daysAgo: 4 },
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'allion', variant: 'A15', year: 2008, trans: 'automatic', fuel: 'petrol', cc: 1500, km: 131000, color: 'Silver', seats: 5, doors: 4,
    price: 14_200_000, features: [...BASIC, 'airbags'], desc: 'Reliable family sedan.', daysAgo: 6 },
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'hilux', variant: '2.8 GD-6 Double Cab', year: 2016, trans: 'manual', fuel: 'diesel', drive: '4wd', cc: 2800, km: 89000, color: 'White', seats: 5, doors: 4,
    price: 78_000_000, features: [...BASIC, 'abs', 'airbags', 'tow_bar', 'bluetooth'], desc: 'Strong double cab, 4x4, serviced at the dealer.', daysAgo: 2, featured: true },
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'prado', variant: 'TX 2.7', year: 2012, trans: 'automatic', fuel: 'petrol', drive: '4wd', cc: 2700, km: 118000, color: 'Grey', seats: 7, doors: 5,
    price: 72_000_000, was: 76_000_000, features: [...BASIC, 'abs', 'airbags', 'alloy_wheels', 'third_row_seats', 'roof_rails', 'reverse_camera'], desc: 'Seven seats, very clean.', daysAgo: 9 },
  { seller: 0, purpose: 'sale', make: 'toyota', model: 'noah', variant: 'Si', year: 2009, trans: 'automatic', fuel: 'petrol', cc: 2000, km: 140000, color: 'Silver', seats: 8, doors: 5,
    price: 15_500_000, features: [...BASIC, 'sliding_doors', 'third_row_seats'], desc: 'Family minivan with power sliding doors.', daysAgo: 12 },
  { seller: 1, purpose: 'sale', make: 'subaru', model: 'forester', variant: '2.0XT', year: 2013, trans: 'automatic', fuel: 'petrol', drive: '4wd', cc: 2000, km: 97000, color: 'Blue', seats: 5, doors: 5,
    price: 22_500_000, features: [...BASIC, 'abs', 'airbags', 'alloy_wheels', 'cruise_control'], desc: 'Turbo, full-time AWD.', daysAgo: 3 },
  { seller: 1, purpose: 'sale', make: 'mitsubishi', model: 'pajero', variant: 'Exceed 3.2 DID', year: 2010, trans: 'automatic', fuel: 'diesel', drive: '4wd', cc: 3200, km: 156000, color: 'White', seats: 7, doors: 5,
    price: 28_000_000, features: [...BASIC, 'abs', 'airbags', 'leather_seats', 'sunroof', 'third_row_seats'], desc: 'Diesel 4x4 with sunroof.', daysAgo: 8 },
  { seller: 1, purpose: 'sale', make: 'isuzu', model: 'd-max', variant: '2.5 Single Cab', year: 2014, trans: 'manual', fuel: 'diesel', drive: '2wd', cc: 2500, km: 121000, color: 'White', seats: 2, doors: 2,
    price: 45_000_000, features: ['power_steering', 'tow_bar'], desc: 'Work truck, strong engine.', daysAgo: 5 },
  { seller: 1, purpose: 'sale', make: 'toyota', model: 'hiace', variant: 'Long Body', year: 2007, trans: 'manual', fuel: 'diesel', cc: 2500, km: 248000, color: 'White', seats: 15, doors: 4,
    price: 26_000_000, features: ['power_steering'], desc: 'Fifteen seater, good for transport business.', daysAgo: 14 },
  { seller: 1, purpose: 'sale', make: 'honda', model: 'vezel', variant: 'Hybrid Z', year: 2015, trans: 'automatic', fuel: 'hybrid', cc: 1500, km: 69000, color: 'Red', seats: 5, doors: 5,
    price: 29_500_000, features: [...BASIC, 'abs', 'airbags', 'navigation', 'reverse_camera', 'push_start', 'keyless_entry'], desc: 'Fuel-saving hybrid, top Z grade.', daysAgo: 0, featured: true },
  { seller: 1, purpose: 'sale', make: 'toyota', model: 'rav4', variant: 'Style', year: 2013, trans: 'automatic', fuel: 'petrol', drive: '4wd', cc: 2400, km: 103000, color: 'Black', seats: 5, doors: 5,
    price: 27_500_000, features: [...BASIC, 'abs', 'airbags', 'alloy_wheels'], desc: 'Practical SUV in good condition.', daysAgo: 7 },
  { seller: 1, purpose: 'sale', make: 'mercedes-benz', model: 'c-class', variant: 'C200 Kompressor', year: 2010, trans: 'automatic', fuel: 'petrol', cc: 1800, km: 117000, color: 'Silver', seats: 5, doors: 4,
    price: 21_000_000, was: 23_000_000, features: [...BASIC, 'abs', 'airbags', 'leather_seats', 'cruise_control', 'alloy_wheels'], desc: 'German comfort, full service history.', daysAgo: 16 },
  { seller: 3, purpose: 'sale', make: 'toyota', model: 'fortuner', variant: '2.8 GD-6 4x4', year: 2016, trans: 'automatic', fuel: 'diesel', drive: '4wd', cc: 2800, km: 92000, color: 'Bronze', seats: 7, doors: 5,
    price: 68_000_000, features: [...BASIC, 'abs', 'airbags', 'third_row_seats', 'reverse_camera', 'tow_bar'], desc: 'Seven-seater 4x4 for northern roads.', daysAgo: 4 },
  { seller: 3, purpose: 'sale', make: 'toyota', model: 'probox', variant: 'DX', year: 2009, trans: 'automatic', fuel: 'petrol', cc: 1500, km: 175000, color: 'White', seats: 5, doors: 5,
    price: 9_800_000, features: ['power_steering', 'air_conditioning'], desc: 'Business workhorse.', daysAgo: 10 },
  { seller: 3, purpose: 'sale', make: 'nissan', model: 'caravan', variant: 'NV350 DX', year: 2013, trans: 'manual', fuel: 'diesel', cc: 2500, km: 199000, color: 'White', seats: 3, doors: 4,
    price: 18_000_000, features: ['power_steering', 'air_conditioning'], desc: 'Panel van for deliveries.', daysAgo: 18 },
  { seller: 4, purpose: 'sale', make: 'mazda', model: 'demio', variant: '13C', year: 2013, trans: 'automatic', fuel: 'petrol', cc: 1300, km: 88000, color: 'Blue', seats: 5, doors: 5,
    price: 11_200_000, features: [...BASIC, 'airbags', 'bluetooth'], desc: 'My daily car, never had an accident. Negotiable.', daysAgo: 1 },
  { seller: 4, purpose: 'sale', make: 'honda', model: 'fit', variant: '13G', year: 2011, trans: 'automatic', fuel: 'petrol', cc: 1300, km: 109000, color: 'Silver', seats: 5, doors: 5,
    price: 11_800_000, features: [...BASIC], desc: 'Very economical, good tyres.', daysAgo: 11 },
  { seller: 5, purpose: 'sale', make: 'nissan', model: 'note', variant: '1.5 X', year: 2011, trans: 'automatic', fuel: 'petrol', cc: 1500, km: 123000, color: 'Grey', seats: 5, doors: 5,
    price: 10_500_000, features: [...BASIC], desc: 'Relocating, quick sale.', daysAgo: 2 },
  { seller: 5, purpose: 'sale', make: 'toyota', model: 'wish', variant: '1.8 X', year: 2012, trans: 'automatic', fuel: 'petrol', cc: 1800, km: 115000, color: 'White', seats: 7, doors: 5,
    price: 16_800_000, features: [...BASIC, 'third_row_seats', 'airbags'], desc: 'Seven seats, clean interior.', daysAgo: 6 },
  { seller: 0, purpose: 'sale', make: 'volkswagen', model: 'polo', variant: '1.2 TSI', year: 2014, trans: 'automatic', fuel: 'petrol', cc: 1200, km: 81000, color: 'Red', seats: 5, doors: 5,
    price: 13_900_000, features: [...BASIC, 'abs', 'airbags', 'bluetooth'], desc: 'Fun and economical.', daysAgo: 13 },
  { seller: 0, purpose: 'sale', make: 'mazda', model: 'cx-5', variant: 'XD 2.2 Diesel', year: 2013, trans: 'automatic', fuel: 'diesel', cc: 2200, km: 99000, color: 'Soul red', seats: 5, doors: 5,
    price: 26_000_000, features: [...BASIC, 'abs', 'airbags', 'alloy_wheels', 'navigation', 'reverse_camera'], desc: 'Diesel SUV with great fuel economy.', daysAgo: 5 },
  // ---- rental fleet
  { seller: 2, purpose: 'rent', make: 'toyota', model: 'axio', variant: '1.5 G', year: 2014, trans: 'automatic', fuel: 'petrol', cc: 1500, km: 120000, color: 'Silver', seats: 5, doors: 4,
    daily: 70_000, driver: 30_000, selfDrive: true, features: [...BASIC, 'airbags'], desc: 'Affordable sedan for business in town.', daysAgo: 6 },
  { seller: 0, purpose: 'rent', make: 'toyota', model: 'prado', variant: 'TX 2.7', year: 2012, trans: 'automatic', fuel: 'petrol', drive: '4wd', cc: 2700, km: 160000, color: 'White', seats: 7, doors: 5,
    daily: 180_000, driver: 40_000, selfDrive: false, minDays: 2, features: [...BASIC, 'abs', 'airbags', 'third_row_seats'], desc: 'Chauffeur-driven only. Safaris, lake trips and field work.', daysAgo: 8 },
  { seller: 0, purpose: 'rent', make: 'toyota', model: 'hiace', variant: 'Commuter 14 seater', year: 2018, trans: 'manual', fuel: 'diesel', cc: 2800, km: 140000, color: 'White', seats: 14, doors: 4,
    daily: 160_000, driver: 0, selfDrive: false, features: ['power_steering', 'air_conditioning'], desc: 'Group transport with an experienced driver (driver included).', daysAgo: 10 },
  { seller: 3, purpose: 'rent', make: 'toyota', model: 'hilux', variant: 'Double Cab 4x4', year: 2016, trans: 'manual', fuel: 'diesel', drive: '4wd', cc: 2800, km: 130000, color: 'White', seats: 5, doors: 4,
    daily: 150_000, driver: 35_000, selfDrive: true, minDays: 2, features: [...BASIC, 'abs', 'tow_bar'], desc: 'Ideal for rough northern roads.', daysAgo: 3 },
  { seller: 3, purpose: 'rent', make: 'toyota', model: 'vitz', variant: '1.3 U', year: 2011, trans: 'automatic', fuel: 'petrol', cc: 1300, km: 140000, color: 'Pink', seats: 5, doors: 5,
    daily: 55_000, driver: null, selfDrive: true, features: [...BASIC], desc: 'Cheapest way around Mzuzu. Self-drive only.', daysAgo: 12 },
];

/** Copy placeholder photos into the upload folder (free hosts wipe the disk on every deploy). */
function syncPhotos(log: (m: string) => void) {
  const src = path.resolve(__dirname, '../../demo-photos');
  if (!fs.existsSync(src)) { log('demo-photos folder missing; demo cars will show outlines'); return; }
  fs.mkdirSync(config.uploadDir, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const dest = path.join(config.uploadDir, `demo-${f}`);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(src, f), dest);
  }
}

export async function seed(log: (m: string) => void = console.log) {
  if (config.isProd && !config.demoMode) throw new Error('Refusing to seed demo data in production (set DEMO_MODE=true for a demo deployment)');
  await migrate(config.databaseUrl, log);
  syncPhotos(log);
  const c = new Client({ connectionString: config.databaseUrl });
  await c.connect();
  try {
    const done = await c.query(`SELECT 1 FROM users WHERE phone=$1`, [SELLERS[0].phone]);
    if (done.rowCount) { log('Demo data already present'); return; }
    await c.query('BEGIN');
    const ids: string[] = [];
    for (const s of SELLERS) {
      const u = await c.query(`INSERT INTO users (phone, name, roles) VALUES ($1,$2,'{customer,seller}') RETURNING id`, [s.phone, s.name]);
      const id = u.rows[0].id as string;
      ids.push(id);
      await c.query(
        `INSERT INTO sellers (user_id, kind, name, about, district, area, address, location, payout_msisdn, payout_operator, verified, created_at)
         SELECT $1,$2,$3,$4,$5,$6,$7, geog, $8, 'tnm', $9, now() - interval '200 days' FROM places WHERE district=$5 AND name=$6`,
        [id, s.kind, s.name, s.about, s.district, s.area, s.address ?? null, s.phone, s.verified],
      );
    }
    const photoIds = new Map<string, string>();
    for (const car of CARS) {
      const sellerId = ids[car.seller];
      const pids: string[] = [];
      for (const p of car.photos ?? []) {
        if (!photoIds.has(p)) {
          const file = path.join(config.uploadDir, `demo-${p}.jpg`);
          const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
          const r = await c.query(`INSERT INTO files (owner_id, mime, size_bytes, path) VALUES ($1,'image/jpeg',$2,$3) RETURNING id`, [sellerId, size, `demo-${p}.jpg`]);
          photoIds.set(p, r.rows[0].id);
        }
        pids.push(photoIds.get(p)!);
      }
      const s = SELLERS[car.seller];
      await c.query(
        `INSERT INTO vehicles (seller_id, purpose, make_id, model_id, variant, year, body_type, transmission, fuel, drive, engine_cc, mileage_km,
            color, seats, doors, condition, plate, cof_expiry, features, description, photo_ids, price_mwk, previous_price_mwk,
            daily_rate_mwk, driver_rate_mwk, self_drive, min_days, district, area, location, status, featured, published_at, created_at)
         SELECT $1,$2, mk.id, md.id, $5, $6, md.body_type, $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
                $27,$28, ST_Project(p.geog, (random()*1500)::float8, radians(random()*360))::geography, 'live', $29,
                now() - ($30 || ' days')::interval - (random() * interval '20 hours'), now() - ($30 || ' days')::interval
           FROM makes mk JOIN models md ON md.make_id=mk.id AND md.slug=$4 JOIN places p ON p.district=$27 AND p.name=$28
          WHERE mk.slug=$3`,
        [
          sellerId, car.purpose, car.make, car.model, car.variant ?? null, car.year, car.trans, car.fuel, car.drive ?? '2wd', car.cc ?? null,
          car.km ?? null, car.color, car.seats ?? null, car.doors ?? null, car.condition ?? 'good', car.plate ?? null, car.cof ?? null,
          car.features, car.desc, pids, car.price ?? null, car.was ?? null, car.daily ?? null,
          car.purpose === 'rent' ? (car.driver === undefined ? null : car.driver) : null, car.selfDrive ?? true, car.minDays ?? 1,
          s.district, s.area, car.featured ?? false, String(car.daysAgo),
        ],
      );
    }
    await c.query('COMMIT');
    log(`Demo data ready: ${SELLERS.length} sellers, ${CARS.length} cars (phones +265888000202 to 207).`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}

if (require.main === module) seed().catch((e) => { console.error(e); process.exit(1); });
