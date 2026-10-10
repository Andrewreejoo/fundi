import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessRequestDto, PinLoginDto, RefreshDto, RequestOtpDto, SetPinDto, UpdateMeDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly notifications: NotificationsService) {}

  @Public() @Post('auth/otp/request') @HttpCode(200)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Public() @Post('auth/otp/verify') @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public() @Post('auth/pin/login') @HttpCode(200)
  pinLogin(@Body() dto: PinLoginDto) {
    return this.auth.pinLogin(dto.phone, dto.pin);
  }

  @Public() @Post('auth/access-request') @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'idPhoto', maxCount: 1 }, { name: 'selfie', maxCount: 1 }],
      {
        storage: memoryStorage(),
        limits: { fileSize: 6 * 1024 * 1024, files: 2 },
        fileFilter: (_req, file, cb) =>
          ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
            ? cb(null, true)
            : cb(new BadRequestException('Photos must be JPG, PNG or WebP'), false),
      },
    ),
  )
  requestAccess(@Body() dto: AccessRequestDto, @UploadedFiles() files: { idPhoto?: Express.Multer.File[]; selfie?: Express.Multer.File[] }) {
    return this.auth.requestAccess(dto, files ?? {});
  }

  @Post('auth/pin') @HttpCode(200)
  setPin(@CurrentUser() user: AuthUser, @Body() dto: SetPinDto) {
    return this.auth.setPin(user.id, dto.pin);
  }

  @Public() @Post('auth/refresh') @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public() @Post('auth/logout') @HttpCode(200)
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.id, dto);
  }

  @Get('me/notifications')
  notificationsList(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Post('me/notifications/read') @HttpCode(200)
  notificationsRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markRead(user.id);
  }
}
