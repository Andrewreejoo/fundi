/* Demo data for local development: a handful of providers in Lilongwe, Blantyre and Mzuzu.
 * All demo phone numbers are in the +26588800xxxx range so they are easy to find and delete.
 * Refuses to run when NODE_ENV=production. */
import { Client } from 'pg';
import { config } from '../config';
import { migrate } from './migrate';

const DEMO = [
  { phone: '+265888000101', name: 'Chikondi Phiri', trades: ['plumbing'], district: 'Lilongwe', area: 'Area 25', level: 'trusted', jobs: 112, rsum: 302, rcount: 63, years: 9,
    bio: 'Plumber with 9 years in Lilongwe. Leaks, toilets, geysers and borehole pumps.',
    listings: [['Leak repair', 'fixed', 8000], ['Toilet fitting', 'fixed', 15000], ['Geyser installation', 'from', 35000]] },
  { phone: '+265888000102', name: 'Mphatso Banda', trades: ['plumbing', 'electrical'], district: 'Lilongwe', area: 'Area 47', level: 'id_verified', jobs: 31, rsum: 129, rcount: 28, years: 6,
    bio: 'Borehole pumps, solar water heaters and house wiring.',
    listings: [['Borehole pump repair', 'from', 10000], ['Solar panel installation', 'quote', null, 'electrical']] },
  { phone: '+265888000103', name: 'Grace Kalua', trades: ['tailoring'], district: 'Lilongwe', area: 'Old Town (Area 2)', level: 'id_verified', jobs: 54, rsum: 230, rcount: 49, years: 12,
    bio: 'Chitenje dresses, school uniforms and alterations. Ready in 3 days.',
    listings: [['Chitenje dress', 'fixed', 18000], ['School uniform (set)', 'fixed', 12000], ['Alterations', 'from', 2000]] },
  { phone: '+265888000104', name: 'Kondwani Jere', trades: ['welding'], district: 'Lilongwe', area: 'Kanengo', level: 'basic', jobs: 4, rsum: 18, rcount: 4, years: 5,
    bio: 'Gates, burglar bars, window frames and ox-carts.',
    listings: [['Burglar bars (per window)', 'from', 45000], ['Gate (made to measure)', 'quote', null]] },
  { phone: '+265888000105', name: 'Tamanda Nkhoma', trades: ['salon'], district: 'Lilongwe', area: 'Area 18', level: 'id_verified', jobs: 88, rsum: 400, rcount: 85, years: 7,
    bio: 'Braids, weaves and nails. Home visits on weekends.',
    listings: [['Box braids', 'fixed', 15000], ['Manicure and pedicure', 'fixed', 9000]] },
  { phone: '+265888000106', name: 'Blessings Chirwa', trades: ['mechanics'], district: 'Blantyre', area: 'Limbe', level: 'id_verified', jobs: 40, rsum: 176, rcount: 38, years: 11,
    bio: 'Toyota and Nissan specialist. Maize mill engines and generators too.',
    listings: [['Car service', 'from', 40000], ['Generator repair', 'quote', null]] },
  { phone: '+265888000107', name: 'Yamikani Mwale', trades: ['carpentry'], district: 'Blantyre', area: 'Ndirande', level: 'basic', jobs: 0, rsum: 0, rcount: 0, years: 3,
    bio: 'Doors, beds and kitchen cabinets.',
    listings: [['Door (hardwood)', 'from', 85000], ['Bed frame', 'quote', null]] },
  { phone: '+265888000108', name: 'Thokozani Gondwe', trades: ['crafts', 'carpentry'], district: 'Mzuzu', area: 'Katoto', level: 'id_verified', jobs: 22, rsum: 101, rcount: 21, years: 15,
    bio: 'Wood carving and Nkhata Bay chairs, made to order.',
    listings: [['Carved chair', 'fixed', 60000], ['Baskets (set of 3)', 'fixed', 15000]] },
  { phone: '+265888000109', name: 'Limbani Mvula', trades: ['repairs', 'electrical'], district: 'Mzuzu', area: 'City Centre', level: 'basic', jobs: 9, rsum: 41, rcount: 9, years: 4,
    bio: 'Phone screens, radios, TVs and fridges.',
    listings: [['Phone screen replacement', 'from', 20000], ['Fridge repair', 'quote', null]] },
];

async function seed() {
  if (config.isProd) throw new Error('Refusing to seed demo data in production');
  await migrate();
  const c = new Client({ connectionString: config.databaseUrl });
  await c.connect();
  try {
    await c.query('BEGIN');
    for (const d of DEMO) {
      const exists = await c.query('SELECT 1 FROM users WHERE phone=$1', [d.phone]);
      if (exists.rowCount) continue;
      const u = await c.query(`INSERT INTO users (phone, name, roles) VALUES ($1,$2,'{customer,provider}') RETURNING id`, [d.phone, d.name]);
      const id = u.rows[0].id;
      const place = await c.query(`SELECT geog FROM places WHERE district=$1 AND name=$2`, [d.district, d.area]);
      // Jitter so providers in the same area are not on one point (~up to 1 km).
      await c.query(
        `INSERT INTO provider_profiles (user_id, display_name, bio, years_experience, verification_level, badges, rating_sum, rating_count,
            jobs_completed, payout_msisdn, payout_operator, location, district, area, work_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'tnm',
                 ST_Project($11::geography, (random()*1000)::float8, radians(random()*360))::geography, $12,$13,'Mon-Sat 7:00-18:00')`,
        [id, d.name, d.bio, d.years, d.level, d.level === 'basic' ? [] : ['id_verified'], d.rsum, d.rcount, d.jobs, d.phone, place.rows[0].geog, d.district, d.area],
      );
      for (const t of d.trades) await c.query(`INSERT INTO provider_trades SELECT $1, id FROM categories WHERE slug=$2`, [id, t]);
      for (const [title, type, price, slug] of d.listings as [string, string, number | null, string?][]) {
        await c.query(
          `INSERT INTO listings (provider_id, category_id, title, price_type, price_mwk, status)
           VALUES ($1, COALESCE((SELECT id FROM categories WHERE slug=$5),
                                (SELECT c.id FROM provider_trades t JOIN categories c ON c.id=t.category_id WHERE t.provider_id=$1 AND c.slug=$6)),
                   $2, $3, $4, 'live')`,
          [id, title, type, price, slug ?? null, d.trades[0]],
        );
      }
    }
    await c.query('COMMIT');
    console.log(`Seeded ${DEMO.length} demo providers (phones +26588800010x).`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
}

seed().catch((e) => { console.error(e); process.exit(1); });
