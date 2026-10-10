import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { CatalogController } from './catalog/catalog.controller';
import { LocationService } from './catalog/location.service';
import { AuthGuard, Public } from './common/auth';
import { DbModule } from './db/db.module';
import { DbService } from './db/db.service';
import { FilesController } from './files/files.controller';
import { NotificationsService } from './notifications/notifications.service';
import { createDriver, PAYMENT_DRIVER } from './payments/driver';
import { LedgerService } from './payments/ledger.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { ProvidersController } from './providers/providers.controller';
import { ProvidersService } from './providers/providers.service';
import { SweeperService } from './scheduler/sweeper.service';

@Controller()
class HealthController {
  constructor(private readonly db: DbService) {}
  @Public() @Get('health')
  async health() {
    await this.db.query('SELECT 1');
    return { ok: true, time: new Date().toISOString() };
  }
}

@Module({
  imports: [DbModule, JwtModule.register({}), ScheduleModule.forRoot()],
  controllers: [
    HealthController, AuthController, CatalogController, FilesController, ProvidersController,
    BookingsController, PaymentsController, AdminController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: PAYMENT_DRIVER, useFactory: createDriver },
    NotificationsService, AuthService, LocationService, ProvidersService, LedgerService, PaymentsService,
    BookingsService, AdminService, SweeperService,
  ],
})
export class AppModule {}
