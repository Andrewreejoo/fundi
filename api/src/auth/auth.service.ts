import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as argon2 from 'argon2';
import { config } from '../config';
import { normalizeMwPhone } from '../common/phone';
import { otpCode, randomToken, sha256 } from '../common/util';
import { DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';

const OTP_TTL_MIN = 5;
const OTP_MAX_PER_10_MIN = 3;
const OTP_MAX_ATTEMPTS = 5;
const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MIN = 15;
const ACCESS_REQUESTS_PER_HOUR = 30;

function checkPinStrength(pin: string) {
  if (/^(\d)\1{3}$/.test(pin) || ['1234', '4321', '0000'].includes(pin)) {
    throw new BadRequestException('Choose a PIN that is harder to guess');
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  phoneOrThrow(input: string) {
    const phone = normalizeMwPhone(input);
    if (!phone) throw new BadRequestException('Enter a valid Airtel or TNM number, e.g. 0991 234 567');
    return phone;
  }

  async requestOtp(input: string) {
    const phone = this.phoneOrThrow(input);
    const recent = await this.db.one<{ n: number }>(
      `SELECT count(*) AS n FROM otp_codes WHERE phone=$1 AND created_at > now() - interval '10 minutes'`,
      [phone],
    );
    if ((recent?.n ?? 0) >= OTP_MAX_PER_10_MIN) {
      throw new HttpException('Too many codes requested. Wait 10 minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = otpCode();
    await this.db.query(
      `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' minutes')::interval)`,
      [phone, sha256(`${phone}:${code}`), String(OTP_TTL_MIN)],
    );
    await this.notifications.sms(phone, `GalimotoYanga code: ${code}. Do not share it with anyone.`);
    return { ok: true, phone, expiresInMinutes: OTP_TTL_MIN, ...(config.devOtpEcho ? { devCode: code } : {}) };
  }

  async verifyOtp(input: string, code: string) {
    const phone = this.phoneOrThrow(input);
    const otp = await this.db.one<{ id: number; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM otp_codes
        WHERE phone=$1 AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw new UnauthorizedException('Code expired. Request a new one.');
    if (otp.code_hash !== sha256(`${phone}:${code}`)) {
      await this.db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [otp.id]);
      throw new UnauthorizedException('Wrong code. Check the SMS and try again.');
    }
    await this.db.query('UPDATE otp_codes SET consumed_at = now() WHERE id=$1', [otp.id]);

    const isAdmin = config.adminPhones.map(normalizeMwPhone).includes(phone);
    let user = await this.db.one<{ id: string; roles: string[]; pin_hash: string | null; status: string }>(
      'SELECT id, roles, pin_hash, status FROM users WHERE phone=$1',
      [phone],
    );
    const isNew = !user;
    if (!user) {
      user = await this.db.one(
        `INSERT INTO users (phone, roles) VALUES ($1, $2) RETURNING id, roles, pin_hash, status`,
        [phone, isAdmin ? ['customer', 'admin'] : ['customer']],
      );
    } else if (isAdmin && !user.roles.includes('admin')) {
      await this.db.query(`UPDATE users SET roles = array_append(roles, 'admin') WHERE id=$1`, [user.id]);
    }
    if (user!.status !== 'active') throw new UnauthorizedException('This account is suspended. Contact GalimotoYanga support.');
    return { ...(await this.issueTokens(user!.id)), isNew, hasPin: !!user!.pin_hash };
  }

  async pinLogin(input: string, pin: string) {
    const phone = this.phoneOrThrow(input);
    const user = await this.db.one<{ id: string; pin_hash: string | null; status: string; pin_locked_until: Date | null }>(
      'SELECT id, pin_hash, status, pin_locked_until FROM users WHERE phone=$1',
      [phone],
    );
    if (user?.pin_locked_until && user.pin_locked_until > new Date()) {
      throw new HttpException(`Too many wrong PINs. Try again in ${PIN_LOCK_MIN} minutes, or sign in with an SMS code.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!user?.pin_hash || !(await argon2.verify(user.pin_hash, pin))) {
      if (user) {
        await this.db.query(
          `UPDATE users SET
                  pin_locked_until = CASE WHEN pin_failures + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE pin_locked_until END,
                  pin_failures = CASE WHEN pin_failures + 1 >= $2 THEN 0 ELSE pin_failures + 1 END
            WHERE id=$1`,
          [user.id, PIN_MAX_FAILURES, String(PIN_LOCK_MIN)],
        );
      } else {
        // Someone waiting for approval who types the right PIN is told where they stand.
        const req = await this.db.one<{ pin_hash: string; status: string; reason: string | null }>(
          `SELECT pin_hash, status, reason FROM access_requests WHERE phone=$1 ORDER BY created_at DESC LIMIT 1`,
          [phone],
        );
        if (req && (await argon2.verify(req.pin_hash, pin))) {
          if (req.status === 'pending') throw new UnauthorizedException('Your request is waiting for approval. We will text you when it is approved.');
          if (req.status === 'rejected') throw new UnauthorizedException(`Your request was not approved${req.reason ? `: ${req.reason}` : ''}.`);
        }
      }
      // Same message whether the user exists or not, so numbers cannot be probed.
      throw new UnauthorizedException('Wrong number or PIN');
    }
    if (user.status !== 'active') throw new UnauthorizedException('This account is suspended. Contact GalimotoYanga support.');
    await this.db.query('UPDATE users SET pin_failures=0, pin_locked_until=NULL WHERE id=$1', [user.id]);
    return this.issueTokens(user.id);
  }

  /**
   * Ask for an account without an SMS code. The person sends a photo of their national ID and a selfie;
   * both are stored privately (admins only). An admin approves; then they sign in with number + PIN.
   */
  async requestAccess(
    input: { phone: string; name: string; pin: string; note?: string },
    files: { idPhoto?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
  ) {
    const phone = this.phoneOrThrow(input.phone);
    checkPinStrength(input.pin);
    const idPhoto = files.idPhoto?.[0];
    const selfie = files.selfie?.[0];
    if (!idPhoto) throw new BadRequestException('Add a photo of your national ID');
    if (!selfie) throw new BadRequestException('Add a selfie of your face');
    const exists = await this.db.one('SELECT 1 FROM users WHERE phone=$1', [phone]);
    if (exists) throw new BadRequestException('This number already has an account. Go to Sign in.');
    const recent = await this.db.one<{ n: number }>(
      `SELECT count(*) AS n FROM access_requests WHERE created_at > now() - interval '1 hour'`,
    );
    if ((recent?.n ?? 0) >= ACCESS_REQUESTS_PER_HOUR) {
      throw new HttpException('Too many requests right now. Try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const old = await this.db.one<{ id_file_id: string | null; selfie_file_id: string | null }>(
      `SELECT id_file_id, selfie_file_id FROM access_requests WHERE phone=$1 AND status='pending'`,
      [phone],
    );
    const idFile = await this.savePrivateFile(idPhoto);
    const selfieFile = await this.savePrivateFile(selfie);
    await this.db.query(
      `INSERT INTO access_requests (phone, name, pin_hash, note, id_file_id, selfie_file_id) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (phone) WHERE status = 'pending'
       DO UPDATE SET name=EXCLUDED.name, pin_hash=EXCLUDED.pin_hash, note=EXCLUDED.note,
                     id_file_id=EXCLUDED.id_file_id, selfie_file_id=EXCLUDED.selfie_file_id, updated_at=now()`,
      [phone, input.name.trim(), await argon2.hash(input.pin), input.note?.trim() || null, idFile, selfieFile],
    );
    await this.deleteFiles([old?.id_file_id, old?.selfie_file_id]);
    const who = input.name.trim().replace(/[\r\n]+/g, ' ');
    void this.notifications.emailAdmins(
      `New sign-up request: ${who}`,
      `${who} (${phone}) asked for an account on GalimotoYanga.\n\nReview the ID photo and selfie, then approve or decline:\n${config.siteUrl}/admin/access\n`,
    );
    return { ok: true };
  }

  /** Store an uploaded image with no public access: only admins can open it. */
  private async savePrivateFile(file: Express.Multer.File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Photos must be JPG, PNG or WebP');
    }
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const name = `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`;
    await fs.promises.writeFile(path.join(config.uploadDir, name), file.buffer);
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO files (owner_id, mime, size_bytes, path, private) VALUES (NULL,$1,$2,$3,true) RETURNING id`,
      [file.mimetype, file.size, name],
    );
    return row!.id;
  }

  async deleteFiles(ids: (string | null | undefined)[]) {
    for (const id of ids.filter((x): x is string => !!x)) {
      const f = await this.db.one<{ path: string }>('DELETE FROM files WHERE id=$1 RETURNING path', [id]);
      if (f) await fs.promises.unlink(path.join(config.uploadDir, f.path)).catch(() => undefined);
    }
  }

  async setPin(userId: string, pin: string) {
    checkPinStrength(pin);
    await this.db.query('UPDATE users SET pin_hash=$2, pin_failures=0, pin_locked_until=NULL, updated_at=now() WHERE id=$1', [userId, await argon2.hash(pin)]);
    return { ok: true };
  }

  async refresh(refreshToken: string) {
    const row = await this.db.one<{ id: string; user_id: string }>(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now()
        RETURNING id, user_id`,
      [sha256(refreshToken)],
    );
    if (!row) throw new UnauthorizedException('Session expired. Sign in again.');
    return this.issueTokens(row.user_id);
  }

  async logout(refreshToken: string) {
    await this.db.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1', [sha256(refreshToken)]);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.db.one(
      `SELECT u.id, u.phone, u.name, u.roles, (u.pin_hash IS NOT NULL) AS has_pin,
              s.user_id IS NOT NULL AS is_seller, s.kind AS seller_kind, s.name AS seller_name, s.verified AS seller_verified,
              (SELECT count(*) FROM inquiry_messages m JOIN inquiries i ON i.id=m.inquiry_id
                WHERE (i.buyer_id=u.id OR i.seller_id=u.id) AND m.sender_id <> u.id AND m.read_at IS NULL) AS unread_messages,
              (SELECT count(*) FROM favorites f WHERE f.user_id=u.id) AS favorites_count
         FROM users u LEFT JOIN sellers s ON s.user_id = u.id
        WHERE u.id=$1`,
      [userId],
    );
    return user;
  }

  async updateMe(userId: string, dto: { name?: string }) {
    await this.db.query(
      `UPDATE users SET name = COALESCE($2, name), updated_at=now() WHERE id=$1`,
      [userId, dto.name ?? null],
    );
    return this.me(userId);
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      { secret: config.jwtAccessSecret, expiresIn: config.accessTokenTtl },
    );
    const refreshToken = randomToken();
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`,
      [userId, sha256(refreshToken), String(config.refreshTokenDays)],
    );
    return { accessToken, refreshToken, user: await this.me(userId) };
  }
}
