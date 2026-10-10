import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';
import { migrate } from './db/migrate';

export function configureApp(app: INestApplication) {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.corsOrigins.length ? config.corsOrigins : false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  return app;
}

async function bootstrap() {
  await migrate(config.databaseUrl, (m) => Logger.log(m, 'Migrate'));
  const app = configureApp(await NestFactory.create(AppModule, { rawBody: true }));
  if (config.isProd && config.jwtAccessSecret.startsWith('dev-')) {
    throw new Error('Refusing to start: set real JWT secrets in production');
  }
  if (config.isProd && config.devOtpEcho && !config.demoMode) {
    throw new Error('Refusing to start: DEV_OTP_ECHO is for development only (use DEMO_MODE=true for a public demo)');
  }
  if (config.demoMode) {
    Logger.warn('DEMO MODE: SMS codes are shown on screen and payments are simulated. Not for real customers.', 'Bootstrap');
    const { seed } = await import('./db/seed');
    await seed((m) => Logger.log(m, 'Seed'));
  }
  if (config.paymentsDriver === 'paychangu' && !config.paychanguSecretKey) {
    Logger.warn('PAYMENTS_DRIVER=paychangu but PAYCHANGU_SECRET_KEY is empty: payments will fail until you add your test keys', 'Bootstrap');
  }
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Galimoto API on :${config.port} (payments=${config.paymentsDriver}, sms=${config.smsDriver})`, 'Bootstrap');
}

if (require.main === module) bootstrap();
