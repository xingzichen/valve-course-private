import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { ValveRequest } from '../../common/http';
import { IS_PUBLIC_KEY } from '../../common/public.decorator';
import { SESSION_COOKIE } from './auth.constants';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<ValveRequest>();
    const session = await this.auth.authenticate(request.cookies[SESSION_COOKIE]);
    if (!session) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: '请先登录' });
    }
    request.authSession = {
      id: session.id,
      csrfToken: session.csrfToken,
      user: {
        id: session.user.id,
        username: session.user.username,
        displayName: session.user.displayName
      }
    };
    return true;
  }
}
