import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { config } from '../config';

// Return BIGINT/COUNT as JS numbers (our values are far below 2^53) and DATE as plain strings.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1082, (v) => v);
// NUMERIC (sums, averages) as JS numbers; MWK totals and ratings fit comfortably.
types.setTypeParser(1700, (v) => parseFloat(v));

export type Queryable = Pick<PoolClient, 'query'>;

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

  async query<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], client?: Queryable): Promise<T[]> {
    const res = await (client ?? this.pool).query<T>(sql, params as any[]);
    return res.rows;
  }

  async one<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], client?: Queryable): Promise<T | null> {
    const rows = await this.query<T>(sql, params, client);
    return rows[0] ?? null;
  }

  /** Run fn inside a transaction. Rolls back on any thrown error. */
  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async audit(actorId: string | null, action: string, entity: string, entityId: string, data?: unknown, client?: Queryable) {
    await this.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, data) VALUES ($1,$2,$3,$4,$5)`,
      [actorId, action, entity, entityId, data === undefined ? null : JSON.stringify(data)],
      client,
    );
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
