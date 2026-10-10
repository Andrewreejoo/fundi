import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/auth';
import { config } from '../config';
import { DbService } from '../db/db.service';

@Controller()
export class CatalogController {
  constructor(private readonly db: DbService) {}

  /** Category list. Clients cache this for 24 h. */
  @Public() @Get('categories')
  categories() {
    return this.db.query(
      `SELECT id, slug, name_en, name_ny, name_tum, icon, pricing_unit FROM categories WHERE active ORDER BY sort, id`,
    );
  }

  /** Public marketplace settings so clients show the same fees and timers the server applies. */
  @Public() @Get('config')
  settings() {
    return {
      currency: 'MWK',
      demo: config.demoMode,
      protectionFeePercent: config.protectionFeePercent,
      protectionFeeMinMwk: config.protectionFeeMin,
      commissionPercent: config.commissionPercent,
      escrowDefaultMinMwk: config.escrowDefaultMin,
      payWindowMinutes: config.payWindowMinutes,
      autoConfirmHours: config.autoConfirmHours,
      instantReplyHours: config.instantReplyHours,
      quoteReplyHours: config.quoteReplyHours,
    };
  }

  /** District -> area list for people without GPS. */
  @Public() @Get('places')
  places(@Query('district') district?: string) {
    return this.db.query(
      `SELECT id, district, name, kind, ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng
         FROM places WHERE ($1::text IS NULL OR district = $1) ORDER BY district, name`,
      [district ?? null],
    );
  }
}
