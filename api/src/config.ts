import * as fs from 'fs';
import * as path from 'path';

/** Load .env (if present) without a dependency. Existing process env wins. */
export function loadDotEnv(file = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const [, key, raw] = m;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

const str = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`Missing required env var ${k}`);
  return v;
};
const num = (k: string, d: number) => {
  const v = process.env[k];
  if (v === undefined || v === '') return d;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env var ${k} must be a number`);
  return n;
};
const bool = (k: string, d: boolean) => {
  const v = process.env[k];
  return v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(v.toLowerCase());
};

export const config = {
  get port() { return num('PORT', 3000); },
  get env() { return str('NODE_ENV', 'development'); },
  get isProd() { return this.env === 'production'; },
  get publicApiUrl() { return str('PUBLIC_API_URL', 'http://localhost:3000').replace(/\/$/, ''); },
  get corsOrigins() { return str('CORS_ORIGINS', '').split(',').map((s) => s.trim()).filter(Boolean); },
  get databaseUrl() { return str('DATABASE_URL', 'postgres://fundi:fundi@localhost:5432/fundi'); },

  get jwtAccessSecret() { return str('JWT_ACCESS_SECRET', 'dev-access-secret'); },
  get jwtRefreshSecret() { return str('JWT_REFRESH_SECRET', 'dev-refresh-secret'); },
  get accessTokenTtl() { return str('ACCESS_TOKEN_TTL', '15m'); },
  get refreshTokenDays() { return num('REFRESH_TOKEN_DAYS', 30); },
  get adminPhones() { return str('ADMIN_PHONES', '').split(',').map((s) => s.trim()).filter(Boolean); },
  get devOtpEcho() { return bool('DEV_OTP_ECHO', false) || this.demoMode; },
  /** Public demo deployment: SMS codes shown on screen, simulated payments, demo fundis. Never for real users. */
  get demoMode() { return bool('DEMO_MODE', false); },

  get smsDriver() { return str('SMS_DRIVER', 'log') as 'log' | 'africastalking'; },
  get atUsername() { return str('AT_USERNAME', 'sandbox'); },
  get atApiKey() { return str('AT_API_KEY', ''); },
  get atSenderId() { return str('AT_SENDER_ID', ''); },
  get atBaseUrl() { return str('AT_BASE_URL', 'https://api.sandbox.africastalking.com'); },

  get paymentsDriver() { return str('PAYMENTS_DRIVER', this.demoMode ? 'fake' : 'paychangu') as 'paychangu' | 'fake'; },
  get paychanguSecretKey() { return str('PAYCHANGU_SECRET_KEY', ''); },
  get paychanguWebhookSecret() { return str('PAYCHANGU_WEBHOOK_SECRET', ''); },
  get paychanguBaseUrl() { return str('PAYCHANGU_BASE_URL', 'https://api.paychangu.com').replace(/\/$/, ''); },
  get commissionPercent() { return num('COMMISSION_PERCENT', 8); },
  get protectionFeePercent() { return num('PROTECTION_FEE_PERCENT', 2); },
  get protectionFeeMin() { return num('PROTECTION_FEE_MIN_MWK', 200); },
  get escrowDefaultMin() { return num('ESCROW_DEFAULT_MIN_MWK', 20000); },

  get instantReplyHours() { return num('INSTANT_REPLY_HOURS', 2); },
  get quoteReplyHours() { return num('QUOTE_REPLY_HOURS', 24); },
  get payWindowMinutes() { return num('PAY_WINDOW_MINUTES', 30); },
  get autoConfirmHours() { return num('AUTO_CONFIRM_HOURS', 48); },
  get idImageRetentionDays() { return num('ID_IMAGE_RETENTION_DAYS', 90); },
  get disputeSlaHours() { return num('DISPUTE_SLA_HOURS', 72); },

  get uploadDir() { return path.resolve(str('UPLOAD_DIR', './uploads')); },
  get maxUploadMb() { return num('MAX_UPLOAD_MB', 3); },
};
