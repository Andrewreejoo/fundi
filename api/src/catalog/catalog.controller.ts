import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/auth';
import { BODY_TYPES, FEATURES } from '../common/vehicle-constants';
import { config } from '../config';
import { DbService } from '../db/db.service';

@Controller()
export class CatalogController {
  constructor(private readonly db: DbService) {}

  /** Makes with how many cars each has live, for sale and for rent ("Shop by make"). */
  @Public() @Get('makes')
  makes() {
    return this.db.query(
      `SELECT m.id, m.slug, m.name,
              count(v.id) FILTER (WHERE v.purpose='sale') AS sale_count,
              count(v.id) FILTER (WHERE v.purpose='rent') AS rent_count
         FROM makes m LEFT JOIN vehicles v ON v.make_id=m.id AND v.status IN ('live','reserved')
        GROUP BY m.id ORDER BY m.sort, m.name`,
    );
  }

  @Public() @Get('models')
  models(@Query('make') make?: string) {
    return this.db.query(
      `SELECT md.id, md.slug, md.name, md.body_type, mk.slug AS make_slug,
              (SELECT count(*) FROM vehicles v WHERE v.model_id=md.id AND v.status IN ('live','reserved')) AS count
         FROM models md JOIN makes mk ON mk.id=md.make_id
        WHERE ($1::text IS NULL OR mk.slug=$1 OR mk.id::text=$1) ORDER BY mk.sort, md.name`,
      [make ?? null],
    );
  }

  /** Body types and features vocabularies, plus marketplace settings (fees, deposit, timers). */
  @Public() @Get('config')
  settings() {
    return {
      currency: 'MWK',
      demo: config.demoMode,
      bodyTypes: BODY_TYPES,
      features: FEATURES,
      depositPercent: config.depositPercent,
      depositMinMwk: config.depositMin,
      depositMaxMwk: config.depositMax,
      saleFeePercent: config.saleFeePercent,
      rentalCommissionPercent: config.rentalCommissionPercent,
      payWindowMinutes: config.payWindowMinutes,
      reservationHoldHours: config.reservationHoldHours,
      autoCompleteHours: config.autoCompleteHours,
    };
  }

  /** Headline numbers for the home page. */
  @Public() @Get('stats')
  async stats() {
    return this.db.one(
      `SELECT count(*) FILTER (WHERE purpose='sale' AND status IN ('live','reserved')) AS for_sale,
              count(*) FILTER (WHERE purpose='rent' AND status='live') AS for_rent,
              (SELECT count(*) FROM sellers WHERE kind='dealer' AND status='active') AS dealers,
              count(DISTINCT district) FILTER (WHERE status='live') AS districts
         FROM vehicles`,
    );
  }

  @Public() @Get('places')
  places(@Query('district') district?: string) {
    return this.db.query(
      `SELECT id, district, name, kind, ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng
         FROM places WHERE ($1::text IS NULL OR district = $1) ORDER BY district, name`,
      [district ?? null],
    );
  }
}
