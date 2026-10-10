import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService, Queryable } from '../db/db.service';

export interface ResolvedLocation {
  lat: number;
  lng: number;
  district: string;
  area: string;
  landmark: string | null;
}

@Injectable()
export class LocationService {
  constructor(private readonly db: DbService) {}

  /** Turn a placeId or GPS point into coordinates plus district/area names (nearest known place fills gaps). */
  async resolve(
    input: { placeId?: number; lat?: number; lng?: number; district?: string; area?: string; landmark?: string },
    client?: Queryable,
  ): Promise<ResolvedLocation> {
    if (input.placeId) {
      const p = await this.db.one(
        `SELECT district, name, ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng FROM places WHERE id=$1`,
        [input.placeId],
        client,
      );
      if (!p) throw new BadRequestException('Unknown place');
      return { lat: p.lat, lng: p.lng, district: p.district, area: input.area || p.name, landmark: input.landmark ?? null };
    }
    if (input.lat === undefined || input.lng === undefined) {
      throw new BadRequestException('Choose your area or share your location');
    }
    // Malawi bounding box (with margin): lat -17.2..-9.3, lng 32.6..36.0
    if (input.lat < -17.5 || input.lat > -9 || input.lng < 32.5 || input.lng > 36.1) {
      throw new BadRequestException('That location is outside Malawi');
    }
    const near = await this.db.one(
      `SELECT district, name FROM places ORDER BY geog <-> ST_MakePoint($2,$1)::geography LIMIT 1`,
      [input.lat, input.lng],
      client,
    );
    return {
      lat: input.lat,
      lng: input.lng,
      district: input.district || near?.district || 'Unknown',
      area: input.area || near?.name || 'Unknown',
      landmark: input.landmark ?? null,
    };
  }
}
