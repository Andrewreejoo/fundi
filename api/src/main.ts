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
  if (config.isProd && (config.jwtAccessSecret.startsWith('dev-') || config.devOtpEcho)) {
    throw new Error('Refusing to start: set real JWT secrets and DEV_OTP_ECHO=false in production');
  }
  if (config.paymentsDriver === 'paychangu' && !config.paychanguSecretKey) {
    Logger.warn('PAYMENTS_DRIVER=paychangu but PAYCHANGU_SECRET_KEY is empty: payments will fail until you add your test keys', 'Bootstrap');
  }
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Fundi API on :${config.port} (payments=${config.paymentsDriver}, sms=${config.smsDriver})`, 'Bootstrap');
}

if (require.main === module) bootstrap();
