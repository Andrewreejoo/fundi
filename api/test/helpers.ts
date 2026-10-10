import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://fundi:fundi@localhost:5432/fundi_test';
process.env.PAYMENTS_DRIVER = 'fake';
process.env.SMS_DRIVER = 'log';
process.env.DEV_OTP_ECHO = 'true';
process.env.DISABLE_SCHEDULER = 'true';
process.env.ADMIN_PHONES = '0999000001';
process.env.UPLOAD_DIR = '/tmp/fundi-test-uploads';
process.env.PAYCHANGU_WEBHOOK_SECRET = 'whsec_test';

export async function resetDb() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await c.end();
  const { migrate } = await import('../src/db/migrate');
  await migrate(process.env.DATABASE_URL, () => undefined);
}

export async function createApp(): Promise<INestApplication> {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/main');
  const app = configureApp(await NestFactory.create(AppModule, { rawBody: true, logger: ['error'] }));
  await app.init();
  return app;
}

export async function login(app: INestApplication, phone: string) {
  const req = await request(app.getHttpServer()).post('/auth/otp/request').send({ phone }).expect(200);
  const res = await request(app.getHttpServer()).post('/auth/otp/verify').send({ phone, code: req.body.devCode }).expect(200);
  return res.body.accessToken as string;
}

export const api = (app: INestApplication, token?: string) => {
  const agent = request(app.getHttpServer());
  const wrap = (r: request.Test) => (token ? r.set('Authorization', `Bearer ${token}`) : r);
  return {
    get: (u: string) => wrap(agent.get(u)),
    post: (u: string, body?: object) => wrap(agent.post(u)).send(body ?? {}),
    patch: (u: string, body?: object) => wrap(agent.patch(u)).send(body ?? {}),
    put: (u: string, body?: object) => wrap(agent.put(u)).send(body ?? {}),
  };
};
