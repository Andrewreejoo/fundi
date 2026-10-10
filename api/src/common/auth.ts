import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { config } from '../config';
import { DbService } from '../db/db.service';

export type Role = 'customer' | 'provider' | 'admin' | 'agent';
export interface AuthUser {
  id: string;
  phone: string;
  roles: Role[];
}

const ROLES_KEY = 'roles';
const PUBLIC_KEY = 'public';
/** Endpoint needs one of these roles (in addition to being signed in). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Endpoint is reachable without a token. If a token is sent, req.user is still populated. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest().user;
});

/** Global guard: verifies the Bearer access token, loads fresh roles/status from the DB, enforces @Roles. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly db: DbService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { secret: config.jwtAccessSecret });
        const user = await this.db.one<{ id: string; phone: string; roles: Role[]; status: string }>(
          'SELECT id, phone, roles, status FROM users WHERE id = $1',
          [payload.sub],
        );
        if (user && user.status === 'active') req.user = { id: user.id, phone: user.phone, roles: user.roles };
        else if (!isPublic) throw new UnauthorizedException('Account not active');
      } catch (e) {
        if (!isPublic) throw e instanceof UnauthorizedException ? e : new UnauthorizedException('Invalid or expired token');
      }
    }

    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Sign in required');

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.some((r) => req.user.roles.includes(r))) {
      throw new ForbiddenException('You do not have access to this');
    }
    return true;
  }
}
